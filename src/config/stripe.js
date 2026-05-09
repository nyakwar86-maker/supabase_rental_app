const Stripe = require('stripe');
require('dotenv').config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is missing in .env file');
  console.error('💡 Get your keys from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Use latest stable version
  appInfo: {
    name: 'Rental Marketplace',
    version: '1.0.0'
  }
});

module.exports = stripe;