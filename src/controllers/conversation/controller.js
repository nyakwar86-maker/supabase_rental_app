const { Op } = require('sequelize');
const db = require('../../models');

class ConversationController {
  
  async getMyConversations(req, res) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    
    let whereClause = {};
    
    if (userRole === 'tenant') {
      whereClause.tenant_id = userId;
    } else if (userRole === 'landlord') {
      whereClause.landlord_id = userId;
    }

    const conversations = await db.Conversation.findAll({
      where: whereClause,
      include: [
        {
          model: db.User,
          as: userRole === 'tenant' ? 'landlord' : 'tenant',
          attributes: ['id', 'full_name', 'avatar_url', 'email', 'phone']
        },
        {
          model: db.Apartment,
          as: 'apartment',
          attributes: ['id', 'title', 'address', 'rent_amount', 'city', 'neighborhood']
        },
        {
          model: db.Message,
          as: 'messages',
          limit: 1, // ✅ KEEP limit: 1 for sidebar preview
          order: [['created_at', 'DESC']], // Get latest message
          include: [{
            model: db.User,
            as: 'sender',
            attributes: ['id', 'full_name', 'avatar_url']
          }]
        },
        {
          model: db.RentalOffer,
          as: 'offers',
          where: { status: 'accepted' },
          required: false,
          limit: 1
        }
      ],
      order: [['last_message_at', 'DESC']]
    });

    console.log(`📁 Loaded ${conversations.length} conversations for user ${userId}`);

    res.json({
      success: true,
      data: { conversations }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
}

  async createConversation(req, res) {
    try {
      const { apartment_id } = req.body;
      const tenantId = req.userId;

      // Check if user is tenant
      if (req.userRole !== 'tenant') {
        return res.status(403).json({
          success: false,
          error: 'Only tenants can start conversations'
        });
      }

      // Check apartment exists
      const apartment = await db.Apartment.findByPk(apartment_id, {
        include: [{
          model: db.User,
          as: 'landlord',
          attributes: ['id']
        }]
      });

      if (!apartment) {
        return res.status(404).json({
          success: false,
          error: 'Apartment not found'
        });
      }

      // Check if conversation already exists
      const existingConversation = await db.Conversation.findOne({
        where: {
          tenant_id: tenantId,
          apartment_id: apartment_id,
          landlord_id: apartment.landlord.id
        }
      });

      if (existingConversation) {
        return res.json({
          success: true,
          message: 'Conversation already exists',
          data: { conversation: existingConversation }
        });
      }

      // Create new conversation
      const conversation = await db.Conversation.create({
        tenant_id: tenantId,
        landlord_id: apartment.landlord.id,
        apartment_id: apartment_id,
        status: 'active',
        last_message_at: new Date()
      });

      // Send initial message
      const initialMessage = await db.Message.create({
        conversation_id: conversation.id,
        sender_id: tenantId,
        content: 'Hello, I\'m interested in this apartment!',
        message_type: 'text'
      });

      // ⭐ Socket.io: Notify landlord
      const io = req.app.get('io');
      if (io) {
        // Notify landlord about new conversation
        io.to(`user_${apartment.landlord.id}`).emit('new_conversation', {
          conversationId: conversation.id,
          tenantId: tenantId,
          apartmentId: apartment_id,
          apartmentTitle: apartment.title
        });
      }

      res.status(201).json({
        success: true,
        message: 'Conversation started successfully',
        data: { conversation }
      });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
        message: error.message
      });
    }
  }

  async getConversation(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      console.log(`🔍 Fetching conversation ${id} with all messages for user ${userId}`);

      const conversation = await db.Conversation.findByPk(id, {
        include: [
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'avatar_url', 'email', 'phone', 'is_verified']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'avatar_url', 'email', 'phone', 'is_verified']
          },
          {
            model: db.Apartment,
            as: 'apartment',
            attributes: ['id', 'title', 'address', 'rent_amount', 'city', 'neighborhood', 'bedrooms', 'bathrooms', 'square_feet', 'amenities']
          },
          {
            model: db.Message,
            as: 'messages',
            include: [{
              model: db.User,
              as: 'sender',
              attributes: ['id', 'full_name', 'avatar_url']
            }],
            order: [['created_at', 'ASC']] // ✅ CHANGED TO ASC for chronological order
            // ✅ REMOVED limit: 1 to get ALL messages
          },
          {
            model: db.RentalOffer,
            as: 'offers',
            include: [
              {
                model: db.User,
                as: 'tenant',
                attributes: ['id', 'full_name', 'email']
              },
              {
                model: db.User,
                as: 'landlord',
                attributes: ['id', 'full_name', 'email']
              }
            ],
            order: [['created_at', 'DESC']]
          }
        ]
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Check authorization
      if (conversation.tenant_id !== userId && conversation.landlord_id !== userId && req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this conversation'
        });
      }

      // Mark unread messages as read for current user
      await db.Message.update(
        { is_read: true },
        {
          where: {
            conversation_id: id,
            sender_id: { [Op.ne]: userId },
            is_read: false
          }
        }
      );

      console.log(`✅ Loaded conversation with ${conversation.messages?.length || 0} messages`);

      res.json({
        success: true,
        data: { conversation }
      });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation'
      });
    }
  }
  async sendMessage(req, res) {
    try {
      const { id } = req.params;
      const { content, message_type = 'text' } = req.body;
      const senderId = req.userId;

      // Check conversation exists and user is participant
      const conversation = await db.Conversation.findByPk(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      if (conversation.tenant_id !== senderId && conversation.landlord_id !== senderId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to send messages in this conversation'
        });
      }

      // Create message
      const message = await db.Message.create({
        conversation_id: id,
        sender_id: senderId,
        content,
        message_type
      });

      // Update conversation last_message_at
      await conversation.update({
        last_message_at: new Date()
      });

      // Get the message with sender details
      const messageWithSender = await db.Message.findByPk(message.id, {
        include: [{
          model: db.User,
          as: 'sender',
          attributes: ['id', 'full_name', 'avatar_url']
        }]
      });

      // ⭐ Socket.io: Emit real-time message
      const io = req.app.get('io');
      if (io) {
        // Send to conversation room
        io.to(`conversation_${id}`).emit('new_message', messageWithSender);

        // Notify the other participant if they're not in conversation room
        const otherUserId = conversation.tenant_id === senderId
          ? conversation.landlord_id
          : conversation.tenant_id;

        io.to(`user_${otherUserId}`).emit('new_message_notification', {
          conversationId: id,
          messageId: message.id,
          content: content.substring(0, 100), // Preview
          sender: messageWithSender.sender,
          conversation: {
            id: conversation.id,
            apartment_title: conversation.apartment_id // You might want to fetch this
          }
        });
      }

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: { message: messageWithSender }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
        message: error.message
      });
    }
  }

  async shareLocation(req, res) {
    try {
      const { id } = req.params;
      const { latitude, longitude, address, notes } = req.body;
      const landlordId = req.userId;

      // Check conversation exists and user is landlord
      const conversation = await db.Conversation.findByPk(id, {
        include: [{
          model: db.RentalOffer,
          as: 'offers',
          where: {
            status: 'accepted',
            commission_paid: true
          },
          required: true
        }]
      });

      if (!conversation || conversation.landlord_id !== landlordId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to share location or commission not paid'
        });
      }

      // Create location message
      const message = await db.Message.create({
        conversation_id: id,
        sender_id: landlordId,
        content: notes || `Location shared: ${address}`,
        message_type: 'location_pin',
        location_data: {
          latitude,
          longitude,
          address,
          shared_at: new Date().toISOString(),
          shared_by: landlordId
        }
      });

      // Update conversation
      await conversation.update({
        last_message_at: new Date()
      });

      // ⭐ Socket.io: Notify tenant
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${id}`).emit('new_message', message);
        io.to(`user_${conversation.tenant_id}`).emit('location_shared', {
          conversationId: id,
          address,
          coordinates: { latitude, longitude },
          sharedAt: new Date().toISOString()
        });
      }

      res.status(201).json({
        success: true,
        message: 'Location shared successfully',
        data: { message }
      });
    } catch (error) {
      console.error('Share location error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to share location'
      });
    }
  }

  async markMessagesAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const conversation = await db.Conversation.findByPk(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Check authorization
      if (conversation.tenant_id !== userId && conversation.landlord_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      }

      // Mark all messages from other user as read
      const result = await db.Message.update(
        { is_read: true },
        {
          where: {
            conversation_id: id,
            sender_id: { [db.Sequelize.Op.ne]: userId },
            is_read: false
          }
        }
      );

      // ⭐ Socket.io: Notify other user that messages were read
      const io = req.app.get('io');
      if (io) {
        const otherUserId = conversation.tenant_id === userId
          ? conversation.landlord_id
          : conversation.tenant_id;

        io.to(`user_${otherUserId}`).emit('messages_read', {
          conversationId: id,
          readBy: userId,
          readAt: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Messages marked as read',
        data: { updatedCount: result[0] }
      });
    } catch (error) {
      console.error('Mark messages as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark messages as read'
      });
    }
  }


  async markMessagesAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      console.log(`📖 [DEBUG] markMessagesAsRead called:`);
      console.log(`   Conversation ID: ${id}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   User Role: ${req.userRole}`);

      // Check if conversation ID is valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.error(`❌ Invalid conversation ID format: ${id}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID format'
        });
      }

      // Find conversation
      console.log(`🔍 Looking for conversation ${id}...`);
      const conversation = await db.Conversation.findByPk(id, {
        include: [
          {
            model: db.User,
            as: 'tenant',
            attributes: ['id', 'full_name', 'email']
          },
          {
            model: db.User,
            as: 'landlord',
            attributes: ['id', 'full_name', 'email']
          }
        ]
      });

      console.log(`🔍 Conversation found: ${!!conversation}`);

      if (!conversation) {
        console.error(`❌ Conversation ${id} not found`);
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      console.log(`🔍 Conversation details:`);
      console.log(`   Tenant ID: ${conversation.tenant_id}`);
      console.log(`   Landlord ID: ${conversation.landlord_id}`);
      console.log(`   Current User ID: ${userId}`);

      // Check authorization
      const isAuthorized = conversation.tenant_id === userId || conversation.landlord_id === userId;
      console.log(`🔐 Authorization check: ${isAuthorized ? 'PASSED' : 'FAILED'}`);

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to mark messages as read'
        });
      }

      // Count unread messages before update
      const unreadCountBefore = await db.Message.count({
        where: {
          conversation_id: id,
          sender_id: { [Op.ne]: userId },
          is_read: false
        }
      });

      console.log(`📊 Found ${unreadCountBefore} unread messages to mark as read`);

      // Mark all messages from other user as read
      console.log(`🔄 Updating messages...`);
      const [updatedCount] = await db.Message.update(
        { is_read: true },
        {
          where: {
            conversation_id: id,
            sender_id: { [Op.ne]: userId },
            is_read: false
          }
        }
      );

      console.log(`✅ Updated ${updatedCount} messages as read`);

      // Double-check the update
      const unreadCountAfter = await db.Message.count({
        where: {
          conversation_id: id,
          sender_id: { [Op.ne]: userId },
          is_read: false
        }
      });

      console.log(`📊 Remaining unread messages: ${unreadCountAfter}`);

      // Get updated conversation with latest messages
      const updatedConversation = await db.Conversation.findByPk(id, {
        include: [
          {
            model: db.Message,
            as: 'messages',
            limit: 20,
            order: [['created_at', 'DESC']],
            include: [{
              model: db.User,
              as: 'sender',
              attributes: ['id', 'full_name', 'avatar_url']
            }]
          }
        ]
      });

      // Socket.io notification
      const io = req.app.get('io');
      if (io) {
        const otherUserId = conversation.tenant_id === userId
          ? conversation.landlord_id
          : conversation.tenant_id;

        console.log(`🔔 Sending socket notification to user ${otherUserId}`);

        io.to(`user_${otherUserId}`).emit('messages_read', {
          conversationId: id,
          readBy: userId,
          readAt: new Date().toISOString(),
          updatedCount
        });
      }

      res.json({
        success: true,
        message: `Marked ${updatedCount} message${updatedCount !== 1 ? 's' : ''} as read`,
        data: {
          updatedCount,
          conversation: updatedConversation
        }
      });

    } catch (error) {
      console.error('❌ [ERROR] markMessagesAsRead failed:');
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);

      // Check for specific Sequelize errors
      if (error.name === 'SequelizeDatabaseError') {
        console.error('   SQL Error:', error.parent?.sql);
        console.error('   SQL Parameters:', error.parent?.parameters);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to mark messages as read',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        errorType: error.name
      });
    }
  }

}

module.exports = new ConversationController();