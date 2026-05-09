
const express = require('express');
const router = express.Router();
const stripeController = require('../../controllers/payment/stripe/controller');
const { authenticate, authorize } = require('../../middleware/auth/middleware');

// Stripe webhook (needs raw body, no authentication)
router.post('/webhook', 
  express.raw({ type: 'application/json' }),
  stripeController.handleWebhook
);

// All other payment routes require authentication
router.use(authenticate);

// Payment intent flow
router.post('/create-intent', stripeController.createPaymentIntent);
router.post('/confirm', stripeController.confirmPayment);
router.get('/status/:payment_intent_id', stripeController.getPaymentStatus);

// Checkout session flow (alternative)
router.post('/create-checkout', stripeController.createCheckoutSession);

// Test endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test', (req, res) => {
    res.json({
      message: 'Stripe payment system is running',
      stripe_configured: !!process.env.STRIPE_SECRET_KEY,
      currency: process.env.STRIPE_CURRENCY || 'usd',
      commission_percentage: process.env.STRIPE_COMMISSION_PERCENTAGE || 5
    });
  });
}

module.exports = router;