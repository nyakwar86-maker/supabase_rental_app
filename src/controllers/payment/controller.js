// src/controllers/payment.controller.js
const db = require('../models');
const crypto = require('crypto');

// Mock payment service - replace with real payment provider like Stripe, Paystack, etc.
class MockPaymentService {
  static async initializePayment(amount, email, metadata) {
    // In real implementation, integrate with payment provider
    // This is a mock implementation
    const transactionId = `tx_${crypto.randomBytes(8).toString('hex')}`;
    const paymentLink = `http://localhost:5000/api/payments/mock-pay/${transactionId}`;
    
    return {
      success: true,
      transactionId,
      paymentLink,
      amount,
      status: 'pending',
      metadata
    };
  }

  static async verifyPayment(transactionId) {
    // Mock verification - in real app, verify with payment provider
    return {
      success: true,
      transactionId,
      status: 'paid',
      paidAt: new Date()
    };
  }
}

exports.initializeCommissionPayment = async (req, res) => {
  try {
    const { rental_offer_id } = req.body;

    // Get rental offer and verify ownership
    const rentalOffer = await db.RentalOffer.findOne({
      where: {
        id: rental_offer_id,
        landlord_id: req.userId,
        status: 'accepted'
      },
      include: [{
        model: db.Apartment,
        as: 'apartment'
      }, {
        model: db.User,
        as: 'tenant',
        attributes: ['id', 'full_name', 'email']
      }]
    });

    if (!rentalOffer) {
      return res.status(404).json({
        success: false,
        error: 'Rental offer not found or not authorized'
      });
    }

    // Check if commission already paid
    if (rentalOffer.commission_paid) {
      return res.status(400).json({
        success: false,
        error: 'Commission already paid'
      });
    }

    // Get or create commission transaction
    let commissionTransaction = await db.CommissionTransaction.findOne({
      where: { rental_offer_id }
    });

    if (!commissionTransaction) {
      commissionTransaction = await db.CommissionTransaction.create({
        rental_offer_id,
        landlord_id: req.userId,
        apartment_id: rentalOffer.apartment_id,
        amount: rentalOffer.commission_amount,
        commission_rate: 5.00,
        payment_status: 'pending'
      });
    } else if (commissionTransaction.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Commission already paid'
      });
    }

    // Get landlord info
    const landlord = await db.User.findByPk(req.userId);

    // Initialize payment with payment provider
    const paymentResult = await MockPaymentService.initializePayment(
      commissionTransaction.amount,
      landlord.email,
      {
        rental_offer_id,
        apartment_id: rentalOffer.apartment_id,
        landlord_id: req.userId,
        tenant_id: rentalOffer.tenant_id,
        transaction_id: commissionTransaction.id
      }
    );

    // Update transaction with payment provider info
    await commissionTransaction.update({
      transaction_id: paymentResult.transactionId,
      payment_details: paymentResult
    });

    res.json({
      success: true,
      message: 'Payment initialized',
      data: {
        commission_transaction: commissionTransaction,
        payment: {
          amount: commissionTransaction.amount,
          payment_link: paymentResult.paymentLink,
          transaction_id: paymentResult.transactionId
        }
      }
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize payment'
    });
  }
};

exports.verifyCommissionPayment = async (req, res) => {
  try {
    const { transaction_id, reference } = req.body;

    // Find commission transaction
    const commissionTransaction = await db.CommissionTransaction.findOne({
      where: { transaction_id: transaction_id || reference },
      include: [{
        model: db.RentalOffer,
        as: 'rental_offer',
        include: [{
          model: db.Conversation,
          as: 'conversation'
        }]
      }]
    });

    if (!commissionTransaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Verify payment with payment provider
    const verification = await MockPaymentService.verifyPayment(transaction_id || reference);

    if (verification.success) {
      // Update commission transaction
      await commissionTransaction.update({
        payment_status: 'paid',
        paid_at: verification.paidAt,
        payment_details: {
          ...commissionTransaction.payment_details,
          verification
        }
      });

      // Update rental offer
      await db.RentalOffer.update(
        { commission_paid: true },
        { where: { id: commissionTransaction.rental_offer_id } }
      );

      // Send notification message
      if (commissionTransaction.rental_offer?.conversation) {
        await db.Message.create({
          conversation_id: commissionTransaction.rental_offer.conversation.id,
          sender_id: commissionTransaction.landlord_id,
          content: `Commission payment confirmed! Location can now be shared.`,
          message_type: 'system'
        });
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          commission_transaction: commissionTransaction,
          location_shareable: true
        }
      });
    } else {
      await commissionTransaction.update({ payment_status: 'failed' });
      
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

exports.getCommissionPayment = async (req, res) => {
  try {
    const { transaction_id } = req.params;

    const commissionTransaction = await db.CommissionTransaction.findOne({
      where: { transaction_id },
      include: [
        {
          model: db.RentalOffer,
          as: 'rental_offer',
          include: [
            {
              model: db.Apartment,
              as: 'apartment',
              attributes: ['id', 'title', 'address']
            },
            {
              model: db.User,
              as: 'tenant',
              attributes: ['id', 'full_name']
            }
          ]
        },
        {
          model: db.User,
          as: 'landlord',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    if (!commissionTransaction) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Check authorization (landlord or admin)
    if (commissionTransaction.landlord_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this payment'
      });
    }

    res.json({
      success: true,
      data: { commission_transaction: commissionTransaction }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment details'
    });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const where = { landlord_id: req.userId };
    if (status) where.payment_status = status;

    const { count, rows: payments } = await db.CommissionTransaction.findAndCountAll({
      where,
      include: [
        {
          model: db.RentalOffer,
          as: 'rental_offer',
          include: [{
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title']
          }]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Calculate summary
    const summary = {
      total_paid: await db.CommissionTransaction.sum('amount', {
        where: { landlord_id: req.userId, payment_status: 'paid' }
      }) || 0,
      total_pending: await db.CommissionTransaction.sum('amount', {
        where: { landlord_id: req.userId, payment_status: 'pending' }
      }) || 0,
      total_transactions: count
    };

    res.json({
      success: true,
      data: {
        payments,
        summary,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

// Admin functions
exports.getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.payment_status = status;
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) where.createdAt[Op.gte] = new Date(start_date);
      if (end_date) where.createdAt[Op.lte] = new Date(end_date);
    }

    const { count, rows: payments } = await db.CommissionTransaction.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: 'landlord',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: db.RentalOffer,
          as: 'rental_offer',
          include: [{
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'city']
          }]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Admin summary
    const summary = {
      total_revenue: await db.CommissionTransaction.sum('amount', {
        where: { payment_status: 'paid' }
      }) || 0,
      pending_amount: await db.CommissionTransaction.sum('amount', {
        where: { payment_status: 'pending' }
      }) || 0,
      total_transactions: await db.CommissionTransaction.count()
    };

    res.json({
      success: true,
      data: {
        payments,
        summary,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const payment = await db.CommissionTransaction.findByPk(id, {
      include: [{
        model: db.RentalOffer,
        as: 'rental_offer'
      }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Update payment
    await payment.update({
      payment_status: status,
      payment_details: {
        ...payment.payment_details,
        admin_notes: notes,
        updated_by: req.userId,
        updated_at: new Date()
      }
    });

    // If marking as paid, update rental offer
    if (status === 'paid' && payment.rental_offer) {
      await db.RentalOffer.update(
        { commission_paid: true },
        { where: { id: payment.rental_offer_id } }
      );
    }

    res.json({
      success: true,
      message: 'Payment status updated',
      data: { payment }
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
};