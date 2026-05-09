

const express = require('express');
const router = express.Router();
const conversationController = require('../../controllers/conversation/controller');
const offerController = require('../../controllers/offer/controller');
const { authenticate, authorize } = require('../../middleware/auth/middleware');
const { validate } = require('../../middleware/validation/middleware');
const conversationValidators = require('../../validators/conversation/validator');


// All routes require authentication
router.use(authenticate);

// ========== CONVERSATION ROUTES ==========
router.get('/', conversationController.getMyConversations);

router.post('/', 
  validate(conversationValidators.createConversation),
  conversationController.createConversation
);

router.get('/:id', conversationController.getConversation);

router.post('/:id/messages',
  validate(conversationValidators.sendMessage),
  conversationController.sendMessage
);

// ✅ ADD THIS ROUTE FOR MARKING MESSAGES AS READ
router.put('/:id/read', conversationController.markMessagesAsRead);
// router.put('/:id/read',
//   validate(conversationValidators.markAsRead), 
//   conversationController.markMessagesAsRead
// );

// ========== OFFER SYSTEM ROUTES ==========

// Get offer details
router.get('/:conversation_id/offer', offerController.getOfferDetails);

// Landlord creates offer
router.post('/:conversation_id/offer',
  authorize(['landlord']),
  validate(conversationValidators.makeOffer),
  offerController.makeOffer
);

// Landlord withdraws offer
router.post('/:conversation_id/offer/withdraw',
  authorize(['landlord']),
  offerController.withdrawOffer
);

// Tenant accepts offer
router.post('/:conversation_id/offer/accept',
  authorize(['tenant']),
  offerController.acceptOffer
);

// Tenant rejects offer
router.post('/:conversation_id/offer/reject',
  authorize(['tenant']),
  offerController.rejectOffer
);

// Pay commission (tenant or landlord)
router.post('/:conversation_id/offer/pay-commission',
  offerController.payCommission
);

// Landlord shares location after commission payment
router.post('/:conversation_id/share-location',
  authorize(['landlord']),
  validate(conversationValidators.shareLocation),
  conversationController.shareLocation
);

// ========== GLOBAL OFFER ROUTES ==========
router.get('/user/my-offers', offerController.getMyOffers);

module.exports = router;