const stripe = require('../../../config/stripe');
const db = require('../../../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

class StripePaymentController {
  /**
   * Create Stripe Payment Intent for commission
   * POST /api/payments/create-intent
   */

  async createPaymentIntent(req, res) {
  try {
    const { conversation_id } = req.body;
    const userId = req.userId;

    console.log(`💳 Creating payment intent for conversation: ${conversation_id}`);

    // 1. Validate input
    if (!conversation_id) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID is required'
      });
    }

    // 2. Find the accepted offer
    const offer = await db.RentalOffer.findOne({
      where: {
        conversation_id,
        status: 'accepted',
        [Op.or]: [
          { tenant_id: userId },
          { landlord_id: userId }
        ]
      },
      include: [
        {
          model: db.Apartment,
          as: 'apartment',
          attributes: ['id', 'title', 'address']
        },
        {
          model: db.User,
          as: 'tenant',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'No accepted offer found or you are not authorized'
      });
    }

    // 3. Check if commission already paid
    if (offer.commission_paid) {
      return res.status(400).json({
        success: false,
        error: 'Commission already paid'
      });
    }

    // 4. Validate and calculate commission amount
    let commissionAmount = parseFloat(offer.commission_amount);
    
    // If commission amount is invalid, calculate 5% of offered rent
    if (!commissionAmount || isNaN(commissionAmount) || commissionAmount <= 0) {
      console.log('⚠️  Invalid commission amount, calculating 5% of offered rent');
      commissionAmount = parseFloat((offer.offered_rent * 0.05).toFixed(2));
      
      // Update the database
      await offer.update({ commission_amount: commissionAmount });
    }
    
    console.log(`💰 Commission amount: $${commissionAmount}`);

    // 5. Calculate amount in cents
    const amountInCents = Math.round(commissionAmount * 100);
    
    console.log(`💸 Amount in cents: ${amountInCents}`);

    // Validate amount
    if (amountInCents < 50) {
      return res.status(400).json({
        success: false,
        error: `Payment amount is too small: $${commissionAmount}. Minimum is $0.50.`
      });
    }

    // 6. Create or get Stripe customer
    let customerId = offer.stripe_customer_id;
    
    if (!customerId && offer.tenant && offer.tenant.email) {
      try {
        const customer = await stripe.customers.create({
          email: offer.tenant.email,
          name: offer.tenant.full_name || 'Customer',
          metadata: {
            user_id: offer.tenant_id,
            offer_id: offer.id,
            conversation_id: conversation_id
          }
        });
        
        customerId = customer.id;
        await offer.update({ stripe_customer_id: customerId });
        console.log(`✅ Stripe customer created: ${customerId}`);
      } catch (customerError) {
        console.log('⚠️ Customer creation optional, continuing...');
      }
    }

    // 7. Generate idempotency key
    const { v4: uuidv4 } = require('uuid');
    const idempotencyKey = uuidv4();

    console.log(`🔑 Idempotency key: ${idempotencyKey}`);

    // 8. Create payment intent - CORRECT WAY
    const paymentIntentData = {
      amount: amountInCents,
      currency: process.env.STRIPE_CURRENCY || 'usd',
      customer: customerId,
      metadata: {
        offer_id: offer.id,
        conversation_id: conversation_id,
        tenant_id: offer.tenant_id,
        landlord_id: offer.landlord_id,
        apartment_id: offer.apartment_id,
        commission_amount: commissionAmount.toFixed(2),
        user_id: userId
      },
      description: `Commission payment for ${offer.apartment?.title || 'apartment rental'}`,
      automatic_payment_methods: {
        enabled: true
      }
    };

    console.log('📤 Creating payment intent with data:', paymentIntentData);

    // Correct way to pass idempotency key in Stripe v8+
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData, {
      idempotencyKey: idempotencyKey
    });

    console.log(`✅ Payment intent created: ${paymentIntent.id}`);

    // 9. Save payment intent ID to offer
    await offer.update({
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: 'pending'
    });

    // 10. Return response
    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: commissionAmount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        offerDetails: {
          apartmentTitle: offer.apartment?.title,
          commissionPercentage: '5%'
        }
      }
    });

  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    
    // Provide better error messages
    let errorMessage = 'Failed to create payment intent';
    let statusCode = 500;
    
    if (error.type === 'StripeInvalidRequestError') {
      statusCode = 400;
      errorMessage = `Stripe error: ${error.message}`;
      
      if (error.param) {
        errorMessage += ` (Parameter: ${error.param})`;
      }
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  /**
   * Confirm payment completion
   * POST /api/payments/confirm
   */
  async confirmPayment(req, res) {
    try {
      const { payment_intent_id } = req.body;
      const userId = req.userId;

      console.log(`✅ Confirming payment: ${payment_intent_id}`);

      if (!payment_intent_id) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        });
      }

      // 1. Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

      // 2. Find the offer associated with this payment intent
      const offer = await db.RentalOffer.findOne({
        where: {
          stripe_payment_intent_id: payment_intent_id,
          [Op.or]: [
            { tenant_id: userId },
            { landlord_id: userId }
          ]
        }
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'Offer not found for this payment'
        });
      }

      // 3. Check payment intent status
      switch (paymentIntent.status) {
        case 'succeeded':
          // Payment successful
          await this.handleSuccessfulPayment(offer, paymentIntent);
          break;
          
        case 'processing':
          // Payment is processing
          return res.json({
            success: true,
            status: 'processing',
            message: 'Payment is processing. We will notify you when completed.'
          });
          
        case 'requires_action':
          // Requires additional action
          return res.status(400).json({
            success: false,
            error: 'Payment requires additional action',
            requiresAction: true,
            clientSecret: paymentIntent.client_secret
          });
          
        case 'requires_payment_method':
          // Payment failed
          return res.status(400).json({
            success: false,
            error: 'Payment failed. Please try with a different payment method.'
          });
          
        case 'canceled':
          // Payment canceled
          return res.status(400).json({
            success: false,
            error: 'Payment was canceled'
          });
          
        default:
          return res.status(400).json({
            success: false,
            error: `Unexpected payment status: ${paymentIntent.status}`
          });
      }

      // 4. Return success response
      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          offer_id: offer.id,
          commission_amount: offer.commission_amount,
          commission_paid: true,
          paid_at: new Date().toISOString(),
          receipt_url: paymentIntent.charges.data[0]?.receipt_url
        }
      });

    } catch (error) {
      console.error('❌ Confirm payment error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to confirm payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment(offer, paymentIntent) {
    console.log(`💰 Payment succeeded for offer: ${offer.id}`);
    
    // Update offer with payment details
    await offer.update({
      commission_paid: true,
      commission_paid_at: new Date(),
      payment_method: paymentIntent.payment_method_types?.[0] || 'card',
      payment_status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: paymentIntent.latest_charge,
      transaction_id: paymentIntent.latest_charge,
      receipt_url: paymentIntent.charges.data[0]?.receipt_url
    });

    // Create payment success message in conversation
    await db.Message.create({
      conversation_id: offer.conversation_id,
      sender_id: offer.tenant_id,
      message_type: 'payment',
      content: `✅ **Commission Payment Successful!**\n\n` +
               `Amount: $${offer.commission_amount}\n` +
               `Transaction ID: ${paymentIntent.latest_charge?.slice(-8) || 'N/A'}\n` +
               `Payment Method: ${paymentIntent.payment_method_types?.[0] || 'card'}\n\n` +
               `The landlord can now share the exact property location.`
    });

    // Update conversation
    await db.Conversation.update(
      { last_message_at: new Date() },
      { where: { id: offer.conversation_id } }
    );
  }

  /**
   * Get payment status
   * GET /api/payments/status/:payment_intent_id
   */
  
  async getPaymentStatus(req, res) {
  console.log('📊 [FIXED] Getting payment status');
  
  try {
    const { payment_intent_id } = req.params;
    const userId = req.userId;

    console.log(`   Payment intent: ${payment_intent_id}, User: ${userId}`);

    // 1. First check our database
    const offer = await db.RentalOffer.findOne({
      where: {
        stripe_payment_intent_id: payment_intent_id
      },
      raw: true
    });

    console.log(`   Offer found in DB: ${!!offer}`);
    
    if (!offer) {
      console.log('   ❌ Offer not found in database');
      return res.status(404).json({
        success: false,
        error: 'Payment not found in our system',
        debug: `No offer found with stripe_payment_intent_id: ${payment_intent_id}`
      });
    }

    console.log(`   Offer details: ID=${offer.id}, Tenant=${offer.tenant_id}, Landlord=${offer.landlord_id}`);

    // 2. Check authorization
    if (offer.tenant_id !== userId && offer.landlord_id !== userId) {
      console.log(`   ❌ Authorization failed: User ${userId} not tenant (${offer.tenant_id}) or landlord (${offer.landlord_id})`);
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this payment',
        debug: `User ${userId} is not tenant ${offer.tenant_id} or landlord ${offer.landlord_id}`
      });
    }

    console.log(`   ✅ User authorized`);

    // 3. If already marked as paid in our DB
    if (offer.commission_paid) {
      console.log(`   ✅ Already marked as paid in DB`);
      return res.json({
        success: true,
        data: {
          status: 'succeeded',
          commission_paid: true,
          commission_amount: offer.commission_amount,
          paid_at: offer.commission_paid_at,
          source: 'database'
        }
      });
    }

    console.log(`   Not paid in DB, checking Stripe...`);

    // 4. Check with Stripe
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
      
      console.log(`   ✅ Stripe status: ${paymentIntent.status}`);
      console.log(`   Stripe amount: ${paymentIntent.amount}, currency: ${paymentIntent.currency}`);
      
      let commissionPaid = false;
      
      // If payment succeeded, update our DB
      if (paymentIntent.status === 'succeeded') {
        console.log(`   ✅ Payment succeeded on Stripe, updating DB...`);
        
        await db.sequelize.query(`
          UPDATE rental_offers 
          SET commission_paid = true,
              commission_paid_at = NOW(),
              payment_status = 'completed',
              stripe_charge_id = '${paymentIntent.latest_charge || ''}'
          WHERE id = '${offer.id}'
        `);
        
        commissionPaid = true;
        
        // Also update the local offer object
        offer.commission_paid = true;
        offer.commission_paid_at = new Date();
      }
      
      res.json({
        success: true,
        data: {
          status: paymentIntent.status,
          commission_paid: commissionPaid,
          commission_amount: offer.commission_amount,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          source: 'stripe',
          stripe_data: {
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            charges: paymentIntent.charges?.data?.length || 0
          }
        }
      });
      
    } catch (stripeError) {
      console.error(`   ❌ Stripe retrieval error: ${stripeError.message}`);
      console.error(`   Stripe error type: ${stripeError.type}`);
      
      // Return what we have in our DB
      res.json({
        success: true,
        data: {
          status: 'stripe_error',
          commission_paid: offer.commission_paid || false,
          commission_amount: offer.commission_amount,
          source: 'database_fallback',
          stripe_error: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
        }
      });
    }

  } catch (error) {
    console.error('❌ [FIXED] Get status error:', error.message);
    console.error('Stack:', error.stack);
    
    // Check for specific errors
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database error:', error.original?.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      error_type: process.env.NODE_ENV === 'development' ? error.name : undefined
    });
  }
}

  /**
   * Create Stripe Checkout Session (alternative to payment intents)
   * POST /api/payments/create-checkout
   */
  async createCheckoutSession(req, res) {
    try {
      const { conversation_id } = req.body;
      const userId = req.userId;

      console.log(`🛒 Creating checkout session for conversation: ${conversation_id}`);

      // Find the offer
      const offer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          status: 'accepted',
          [Op.or]: [
            { tenant_id: userId },
            { landlord_id: userId }
          ]
        },
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['title', 'address']
          }
        ]
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'No accepted offer found'
        });
      }

      if (offer.commission_paid) {
        return res.status(400).json({
          success: false,
          error: 'Commission already paid'
        });
      }

      // Calculate amount
      const amountInCents = Math.round(offer.commission_amount * 100);
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: process.env.STRIPE_CURRENCY || 'usd',
              product_data: {
                name: `Commission for ${offer.apartment.title}`,
                description: `5% commission payment for rental agreement`,
                metadata: {
                  offer_id: offer.id,
                  apartment: offer.apartment.title
                }
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}${process.env.FRONTEND_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&offer_id=${offer.id}`,
        cancel_url: `${process.env.FRONTEND_URL}${process.env.FRONTEND_CANCEL_URL}?offer_id=${offer.id}`,
        metadata: {
          offer_id: offer.id,
          conversation_id: conversation_id,
          tenant_id: offer.tenant_id,
          landlord_id: offer.landlord_id
        },
        customer_email: req.user.email, // Assuming user email is in req.user
        client_reference_id: offer.id
      });

      // Save session ID to offer
      await offer.update({
        stripe_checkout_session_id: session.id
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url
        }
      });

    } catch (error) {
      console.error('❌ Create checkout error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create checkout session'
      });
    }
  }

  /**
   * Handle Stripe webhook events
   * POST /api/payments/webhook
   */
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🔔 Webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object);
        break;
        
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  }

  /**
   * Handle successful payment intent from webhook
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      const offer = await db.RentalOffer.findOne({
        where: { stripe_payment_intent_id: paymentIntent.id }
      });

      if (offer && !offer.commission_paid) {
        await this.handleSuccessfulPayment(offer, paymentIntent);
        console.log(`✅ Webhook: Payment succeeded for offer ${offer.id}`);
      }
    } catch (error) {
      console.error('❌ Webhook payment succeeded handler error:', error);
    }
  }

  /**
   * Handle failed payment intent
   */
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      const offer = await db.RentalOffer.findOne({
        where: { stripe_payment_intent_id: paymentIntent.id }
      });

      if (offer) {
        await offer.update({
          payment_status: 'failed',
          payment_error: paymentIntent.last_payment_error?.message || 'Payment failed'
        });
        
        console.log(`❌ Webhook: Payment failed for offer ${offer.id}`);
      }
    } catch (error) {
      console.error('❌ Webhook payment failed handler error:', error);
    }
  }

  /**
   * Handle completed checkout session
   */
  async handleCheckoutSessionCompleted(session) {
    try {
      const offer = await db.RentalOffer.findOne({
        where: { stripe_checkout_session_id: session.id }
      });

      if (offer && !offer.commission_paid) {
        // Retrieve payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        await this.handleSuccessfulPayment(offer, paymentIntent);
        console.log(`✅ Webhook: Checkout completed for offer ${offer.id}`);
      }
    } catch (error) {
      console.error('❌ Webhook checkout completed handler error:', error);
    }
  }

  /**
   * Handle refund
   */
  async handleChargeRefunded(charge) {
    try {
      const offer = await db.RentalOffer.findOne({
        where: { stripe_charge_id: charge.id }
      });

      if (offer) {
        await offer.update({
          commission_paid: false,
          payment_status: 'refunded',
          refunded_at: new Date(),
          refund_amount: charge.amount_refunded / 100
        });
        
        // Create refund message
        await db.Message.create({
          conversation_id: offer.conversation_id,
          sender_id: offer.landlord_id,
          message_type: 'payment',
          content: `↩️ **Commission Refunded**\n\n` +
                   `Amount: $${charge.amount_refunded / 100}\n` +
                   `Reason: ${charge.refund_reason || 'Not specified'}\n` +
                   `Status: ${charge.refund_status || 'completed'}`
        });
        
        console.log(`↩️ Webhook: Charge refunded for offer ${offer.id}`);
      }
    } catch (error) {
      console.error('❌ Webhook charge refunded handler error:', error);
    }
  }
}

module.exports = new StripePaymentController();