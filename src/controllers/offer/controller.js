


// controllers/offer.controller.js
const db = require('../../models');
const { Op } = require('sequelize');

class OfferController {
  
  // Landlord makes a rental offer
  async makeOffer(req, res) {
    try {
      const { conversation_id } = req.params;
      const { offered_rent, terms, expires_in_hours = 72 } = req.body;
      const landlordId = req.userId;

      console.log(`💰 Landlord ${landlordId} making offer for conversation ${conversation_id}`);
      console.log(req.body)

      // Validate input
      if (!offered_rent || offered_rent <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid rent amount is required' 
        });
      }

      // Find conversation
      const conversation = await db.Conversation.findByPk(conversation_id, {
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'rent_amount', 'landlord_id']
          },
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Verify landlord owns the apartment
      if (conversation.apartment.landlord_id !== landlordId) {
        return res.status(403).json({
          success: false,
          error: 'You can only make offers for your own apartments'
        });
      }

      // Check if there's already a pending or accepted offer
      const existingOffer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          status: {
            [Op.in]: ['pending', 'accepted']
          }
        }
      });

      if (existingOffer) {
        return res.status(400).json({
          success: false,
          error: existingOffer.status === 'pending' 
            ? 'There is already a pending offer for this conversation' 
            : 'There is already an accepted offer for this conversation'
        });
      }

      // Calculate commission (5% of offered rent)
      const commissionAmount = parseFloat((offered_rent * 0.05).toFixed(2));
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expires_in_hours));

      // Create the offer
      const offer = await db.RentalOffer.create({
        conversation_id,
        apartment_id: conversation.apartment_id,
        landlord_id: landlordId,
        tenant_id: conversation.tenant_id,
        offered_rent:offered_rent,
        terms,
        commission_amount: commissionAmount,
        expires_at: expiresAt,
        status: 'pending'
      });

      // Create offer message
      const message = await db.Message.create({
        conversation_id,
        sender_id: landlordId,
        content: `📄 **New Rental Offer Made!**\n\n**Offered Rent:** $${offered_rent}/month\n**Commission (5%):** $${commissionAmount}\n**Expires:** ${expiresAt.toLocaleString()}\n${terms ? `**Terms:** ${terms}` : ''}\n\nPlease respond by accepting or rejecting this offer.`,
        message_type: 'offer'
      });

      // Update conversation last message
      await conversation.update({
        last_message_at: new Date()
      });

      // Get offer with details
      const offerWithDetails = await db.RentalOffer.findByPk(offer.id, {
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'address']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'email']
          },
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        // Notify tenant about new offer
        io.to(`user_${conversation.tenant_id}`).emit('new_offer', {
          conversationId: conversation_id,
          offer: offerWithDetails,
          message: message
        });
        
        // Also send to conversation room
        io.to(`conversation_${conversation_id}`).emit('new_message', message);
      }

      console.log(`✅ Offer created: ${offer.id} for $${offered_rent}`);

      res.status(201).json({
        success: true,
        message: 'Offer created successfully',
        data: {
          offer: offerWithDetails,
          message
        }
      });

    } catch (error) {
      console.error('Make offer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create offer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Tenant accepts an offer
  async acceptOffer(req, res) {
    try {
      const { conversationId } = req.params;
      const tenantId = req.userId;

      console.log(`✅ Tenant ${tenantId} accepting offer for conversation ${conversationId}`);

      // Find the pending offer
      const offer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          tenant_id: tenantId,
          status: 'pending'
        },
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'address']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'No pending offer found or you are not authorized'
        });
      }

      // Check if offer is expired
      if (new Date() > new Date(offer.expires_at)) {
        await offer.update({ status: 'expired' });
        return res.status(400).json({
          success: false,
          error: 'This offer has expired'
        });
      }

      // Update offer status
      await offer.update({
        status: 'accepted',
        accepted_at: new Date()
      });

      // Create acceptance message
      const message = await db.Message.create({
        conversation_id,
        sender_id: tenantId,
        content: `✅ **Offer Accepted!**\n\nThe rental offer for $${offer.offered_rent}/month has been accepted.\n\nNext step: Pay the commission fee of $${offer.commission_amount} to get the exact property location.`,
        message_type: 'acceptance'
      });

      // Update conversation
      const conversation = await db.Conversation.findByPk(conversation_id);
      await conversation.update({
        last_message_at: new Date()
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        // Notify landlord
        io.to(`user_${offer.landlord_id}`).emit('offer_accepted', {
          conversationId: conversation_id,
          offer,
          message
        });
        
        // Send to conversation room
        io.to(`conversation_${conversation_id}`).emit('new_message', message);
      }

      console.log(`✅ Offer ${offer.id} accepted by tenant`);

      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offer,
          message
        }
      });

    } catch (error) {
      console.error('Accept offer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to accept offer'
      });
    }
  }

  // Tenant rejects an offer
  async rejectOffer(req, res) {
    try {
      const { conversation_id } = req.params;
      const { reason } = req.body;
      const tenantId = req.userId;

      console.log(`❌ Tenant ${tenantId} rejecting offer for conversation ${conversation_id}`);

      // Find the pending offer
      const offer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          tenant_id: tenantId,
          status: 'pending'
        }
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'No pending offer found or you are not authorized'
        });
      }

      // Update offer status
      await offer.update({
        status: 'rejected',
        rejected_at: new Date(),
        notes: reason || 'No reason provided'
      });

      // Create rejection message
      const message = await db.Message.create({
        conversation_id,
        sender_id: tenantId,
        content: `❌ **Offer Rejected**\n\nThe rental offer for $${offer.offered_rent}/month has been rejected.${reason ? `\n**Reason:** ${reason}` : ''}`,
        message_type: 'text'
      });

      // Update conversation
      const conversation = await db.Conversation.findByPk(conversation_id);
      await conversation.update({
        last_message_at: new Date()
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        // Notify landlord
        io.to(`user_${offer.landlord_id}`).emit('offer_rejected', {
          conversationId: conversation_id,
          offer,
          reason,
          message
        });
        
        // Send to conversation room
        io.to(`conversation_${conversation_id}`).emit('new_message', message);
      }

      console.log(`❌ Offer ${offer.id} rejected by tenant`);

      res.json({
        success: true,
        message: 'Offer rejected successfully',
        data: {
          offer,
          message
        }
      });

    } catch (error) {
      console.error('Reject offer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject offer'
      });
    }
  }

  // Landlord withdraws an offer
  async withdrawOffer(req, res) {
    try {
      const { conversation_id } = req.params;
      const landlordId = req.userId;

      console.log(`↩️ Landlord ${landlordId} withdrawing offer for conversation ${conversation_id}`);

      // Find the pending offer
      const offer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          landlord_id: landlordId,
          status: 'pending'
        }
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'No pending offer found or you are not authorized'
        });
      }

      // Update offer status
      await offer.update({
        status: 'withdrawn',
        notes: 'Withdrawn by landlord'
      });

      // Create withdrawal message
      const message = await db.Message.create({
        conversation_id,
        sender_id: landlordId,
        content: `↩️ **Offer Withdrawn**\n\nThe rental offer for $${offer.offered_rent}/month has been withdrawn by the landlord.`,
        message_type: 'text'
      });

      // Update conversation
      const conversation = await db.Conversation.findByPk(conversation_id);
      await conversation.update({
        last_message_at: new Date()
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        // Notify tenant
        io.to(`user_${offer.tenant_id}`).emit('offer_withdrawn', {
          conversationId: conversation_id,
          offer,
          message
        });
        
        // Send to conversation room
        io.to(`conversation_${conversation_id}`).emit('new_message', message);
      }

      console.log(`↩️ Offer ${offer.id} withdrawn by landlord`);

      res.json({
        success: true,
        message: 'Offer withdrawn successfully',
        data: {
          offer,
          message
        }
      });

    } catch (error) {
      console.error('Withdraw offer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to withdraw offer'
      });
    }
  }

  // Get offer details for a conversation
  async getOfferDetails(req, res) {
    try {
      const { conversation_id } = req.params;
      const userId = req.userId;

      console.log(`📋 Getting offer details for conversation ${conversation_id}`);

      // Find conversation to verify authorization
      const conversation = await db.Conversation.findByPk(conversation_id);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Check if user is part of the conversation
      if (conversation.tenant_id !== userId && conversation.landlord_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this offer'
        });
      }

      // Find offers for this conversation (latest first)
      const offers = await db.RentalOffer.findAll({
        where: { conversation_id },
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'address', 'rent_amount']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'email', 'avatar_url']
          },
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'email', 'avatar_url']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Get current active offer (pending or accepted)
      const activeOffer = offers.find(offer => 
        offer.status === 'pending' || offer.status === 'accepted'
      );

      res.json({
        success: true,
        data: {
          offers,
          active_offer: activeOffer || null,
          total_offers: offers.length
        }
      });

    } catch (error) {
      console.error('Get offer details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch offer details'
      });
    }
  }

  // Get user's offers (both as landlord and tenant)
  async getMyOffers(req, res) {
    try {
      const userId = req.userId;
      const { status, role } = req.query;

      console.log(`📋 Getting offers for user ${userId}`);

      let whereClause = {};

      // Filter by role (landlord offers or tenant offers)
      if (role === 'landlord') {
        whereClause.landlord_id = userId;
      } else if (role === 'tenant') {
        whereClause.tenant_id = userId;
      } else {
        // Get all offers where user is either landlord or tenant
        whereClause = {
          [Op.or]: [
            { landlord_id: userId },
            { tenant_id: userId }
          ]
        };
      }

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      const offers = await db.RentalOffer.findAll({
        where: whereClause,
        include: [
          {
            model: db.Conversation,
            as: 'conversation',
            attributes: ['id']
          },
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'address', 'city']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'email', 'avatar_url']
          },
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'email', 'avatar_url']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 50
      });

      // Calculate summary
      const summary = {
        total: offers.length,
        pending: offers.filter(o => o.status === 'pending').length,
        accepted: offers.filter(o => o.status === 'accepted').length,
        rejected: offers.filter(o => o.status === 'rejected').length,
        expired: offers.filter(o => o.status === 'expired').length
      };

      res.json({
        success: true,
        data: {
          offers,
          summary
        }
      });

    } catch (error) {
      console.error('Get my offers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch offers'
      });
    }
  }

  // Pay commission for an accepted offer
  async payCommission(req, res) {
    try {
      const { conversation_id } = req.params;
      const userId = req.userId;

      console.log(`💰 Processing commission payment for conversation ${conversation_id}`);

      // Find accepted offer
      const offer = await db.RentalOffer.findOne({
        where: {
          conversation_id,
          status: 'accepted',
          [Op.or]: [
            { landlord_id: userId },
            { tenant_id: userId }
          ]
        },
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title']
          }
        ]
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: 'No accepted offer found or you are not authorized'
        });
      }

      if (offer.commission_paid) {
        return res.status(400).json({
          success: false,
          error: 'Commission already paid' 
        });
      }

      // Here you would integrate with your payment service (Stripe, etc.)
      // For now, we'll just mark it as paid
      await offer.update({
        commission_paid: true,
        commission_paid_at: new Date(),
        payment_method: 'stripe' // This would come from payment service
      });

      // Create payment message
      const message = await db.Message.create({ 
        conversation_id,
        sender_id: userId,
        content: `✅ **Commission Paid!**\n\nThe commission fee of $${offer.commission_amount} has been paid successfully.\n\nThe landlord can now share the exact property location.`,
        message_type: 'payment'
      });

      // Update conversation
      const conversation = await db.Conversation.findByPk(conversation_id);
      await conversation.update({
        last_message_at: new Date()
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversation_id}`).emit('new_message', message);
        
        // Notify both users
        io.to(`user_${offer.landlord_id}`).emit('commission_paid', {
          conversationId: conversation_id,
          offer,
          message
        });
        
        io.to(`user_${offer.tenant_id}`).emit('commission_paid', {
          conversationId: conversation_id,
          offer,
          message
        });
      }

      console.log(`✅ Commission paid for offer ${offer.id}`);

      res.json({
        success: true,
        message: 'Commission payment processed successfully',
        data: {
          offer,
          message,
          location_shareable: true
        }
      });

    } catch (error) {
      console.error('Pay commission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process commission payment'
      });
    }
  }

  // Get offer statistics for dashboard
  async getOfferStats(req, res) {
    try {
      const userId = req.userId;
      const userRole = req.userRole;

      let whereClause = {};

      if (userRole === 'landlord') {
        whereClause.landlord_id = userId;
      } else if (userRole === 'tenant') {
        whereClause.tenant_id = userId;
      }

      // Get counts by status
      const counts = await db.RentalOffer.findAll({
        where: whereClause,
        attributes: [
          'status',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
          [db.sequelize.fn('SUM', db.sequelize.col('commission_amount')), 'total_commission']
        ],
        group: ['status']
      });

      // Calculate total commission earned (for landlords) or paid (for tenants)
      const totalCommission = counts.reduce((sum, item) => {
        return sum + parseFloat(item.dataValues.total_commission || 0);
      }, 0);

      // Get recent offers
      const recentOffers = await db.RentalOffer.findAll({
        where: whereClause,
        include: [
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title']
          },
          {
            model: db.User,
            as: userRole === 'landlord' ? 'tenant' : 'landlord',
            attributes: ['id', 'full_name', 'avatar_url']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      });

      res.json({
        success: true,
        data: {
          counts,
          total_commission: totalCommission,
          recent_offers: recentOffers,
          summary: {
            total_offers: counts.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0),
            pending_offers: counts.find(c => c.status === 'pending')?.dataValues.count || 0,
            accepted_offers: counts.find(c => c.status === 'accepted')?.dataValues.count || 0
          }
        }
      });

    } catch (error) {
      console.error('Get offer stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch offer statistics'
      });
    }
  }
}

module.exports = new OfferController();