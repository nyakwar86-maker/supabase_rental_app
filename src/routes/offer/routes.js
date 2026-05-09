// routes/offer.routes.js
const express = require('express');
const router = express.Router();
const offerController = require('../../controllers/offer/controller');
const { authenticate, authorize } = require('../../middleware/auth/middleware');
const { validate } = require('../../middleware/validation/middleware');
const offerValidators = require('../../validators/offer/validator');


// All routes require authentication
router.use(authenticate);

// ========== OFFER MANAGEMENT ==========

// Get offer details for a conversation
router.get('/conversations/:conversation_id/offer', 
  offerController.getOfferDetails
);

// Landlord makes an offer
router.post('/conversations/:conversation_id/offer',
  authorize(['landlord']),
  validate(offerValidators.makeOffer),
  offerController.makeOffer
);

// Landlord withdraws an offer
router.post('/conversations/:conversation_id/offer/withdraw',
  authorize(['landlord']),
  offerController.withdrawOffer
);

// Tenant accepts an offer
router.post('/conversations/:conversation_id/offer/accept',
  authorize(['tenant']),
  offerController.acceptOffer
);

// Tenant rejects an offer
router.post('/conversations/:conversation_id/offer/reject',
  authorize(['tenant']),
  validate(offerValidators.rejectOffer),
  offerController.rejectOffer
);

// Pay commission for accepted offer
router.post('/conversations/:conversation_id/offer/pay-commission',
  offerController.payCommission
);

// ========== USER OFFERS ==========

// Get user's offers
router.get('/offers/my-offers', 
  offerController.getMyOffers
);

// Get offer statistics
router.get('/offers/stats',
  offerController.getOfferStats
);

module.exports = router;