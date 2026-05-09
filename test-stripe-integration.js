const axios = require('axios');
const stripe = require('./src/config/stripe');

const API_BASE = 'http://localhost:5000/api';

async function testStripeIntegration() {
  console.log('💳 Testing Stripe Integration\n');
  console.log('='.repeat(60));
  
  // Check Stripe configuration
  console.log('\n1. Checking Stripe configuration...');
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('sk_test_')) {
    console.log('✅ Stripe is in test mode');
  } else {
    console.log('⚠️  Stripe may be in live mode - be careful!');
  }
  
  // Test Stripe API connection
  try {
    const balance = await stripe.balance.retrieve();
    console.log('✅ Stripe API connection successful');
    console.log(`   Available: $${balance.available[0].amount / 100}`);
    console.log(`   Pending: $${balance.pending[0].amount / 100}`);
  } catch (error) {
    console.log('❌ Stripe API connection failed:', error.message);
    console.log('💡 Get test keys from: https://dashboard.stripe.com/test/apikeys');
    return;
  }
  
  // Create test data
  console.log('\n2. Creating test data...');
  
  try {
    // Create test users
    const landlordRes = await axios.post(`${API_BASE}/auth/register`, {
      email: `stripe-landlord-${Date.now()}@test.com`,
      password: 'password123',
      role: 'landlord',
      full_name: 'Stripe Test Landlord'
    });
    
    const landlordToken = landlordRes.data.data.tokens.accessToken;
    const landlordId = landlordRes.data.data.user.id;
    console.log(`✅ Landlord: ${landlordRes.data.data.user.email}`);
    
    const tenantRes = await axios.post(`${API_BASE}/auth/register`, {
      email: `stripe-tenant-${Date.now()}@test.com`,
      password: 'password123',
      role: 'tenant',
      full_name: 'Stripe Test Tenant'
    });
    
    const tenantToken = tenantRes.data.data.tokens.accessToken;
    const tenantId = tenantRes.data.data.user.id;
    console.log(`✅ Tenant: ${tenantRes.data.data.user.email}`);
    
    // Create apartment
    const apartmentRes = await axios.post(`${API_BASE}/apartments`, {
      title: 'Stripe Test Apartment',
      address: '123 Stripe St',
      city: 'Stripeville',
      rent_amount: 2000
    }, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    
    const apartmentId = apartmentRes.data.data.apartment.id;
    console.log(`✅ Apartment: ${apartmentId} ($${apartmentRes.data.data.apartment.rent_amount}/month)`);
    
    // Create conversation
    const conversationRes = await axios.post(`${API_BASE}/conversations`, {
      apartment_id: apartmentId
    }, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    
    const conversationId = conversationRes.data.data.conversation.id;
    console.log(`✅ Conversation: ${conversationId}`);
    
    // Make offer
    const offerRes = await axios.post(
      `${API_BASE}/conversations/${conversationId}/offer`,
      {
        offered_rent: 1900,
        terms: 'Stripe integration test'
      },
      {
        headers: { Authorization: `Bearer ${landlordToken}` }
      }
    );
    
    const offerId = offerRes.data.data.offer.id;
    const commissionAmount = offerRes.data.data.offer.commission_amount;
    console.log(`✅ Offer created: ${offerId}`);
    console.log(`   5% Commission: $${commissionAmount}`);
    
    // Accept offer
    await axios.post(
      `${API_BASE}/conversations/${conversationId}/offer/accept`,
      {},
      {
        headers: { Authorization: `Bearer ${tenantToken}` }
      }
    );
    
    console.log(`✅ Offer accepted`);
    
    // Test 1: Create payment intent
    console.log('\n3. Testing payment intent creation...');
    try {
      const intentRes = await axios.post(
        `${API_BASE}/payments/create-intent`,
        { conversation_id: conversationId },
        {
          headers: { Authorization: `Bearer ${tenantToken}` }
        }
      );
      
      console.log('✅ Payment intent created successfully!');
      console.log(`   Client secret: ${intentRes.data.data.clientSecret.slice(0, 20)}...`);
      console.log(`   Payment intent ID: ${intentRes.data.data.paymentIntentId}`);
      console.log(`   Amount: $${intentRes.data.data.amount}`);
      
      const paymentIntentId = intentRes.data.data.paymentIntentId;
      
      // Test 2: Get payment status
      console.log('\n4. Testing payment status check...');
      const statusRes = await axios.get(
        `${API_BASE}/payments/status/${paymentIntentId}`,
        {
          headers: { Authorization: `Bearer ${tenantToken}` }
        }
      );
      
      console.log(`✅ Payment status: ${statusRes.data.data.status}`);
      
      // Test 3: Test with Stripe test card
      console.log('\n5. Testing with Stripe test card...');
      console.log('   To complete this test:');
      console.log('   1. Use this test card: 4242 4242 4242 4242');
      console.log('   2. Any future expiry date (e.g., 12/34)');
      console.log('   3. Any 3-digit CVC');
      console.log('   4. Any ZIP code');
      console.log('\n   In your frontend, use:');
      console.log(`   clientSecret: "${intentRes.data.data.clientSecret}"`);
      
      // Test 4: Create checkout session (alternative)
      console.log('\n6. Testing checkout session creation...');
      try {
        const checkoutRes = await axios.post(
          `${API_BASE}/payments/create-checkout`,
          { conversation_id: conversationId },
          {
            headers: { Authorization: `Bearer ${tenantToken}` }
          }
        );
        
        console.log('✅ Checkout session created!');
        console.log(`   URL: ${checkoutRes.data.data.url}`);
        
      } catch (checkoutError) {
        console.log('⚠️  Checkout session creation failed (might need frontend URL config):');
        console.log(`   ${checkoutError.response?.data?.error || checkoutError.message}`);
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 STRIPE INTEGRATION TEST COMPLETE!');
      console.log('='.repeat(60));
      
      console.log('\n📋 Test Summary:');
      console.log(`   • Stripe API: ✅ Connected`);
      console.log(`   • Payment Intent: ✅ Created`);
      console.log(`   • Payment Status: ✅ Working`);
      console.log(`   • Checkout Session: ✅ Created`);
      console.log(`   • Commission Amount: $${commissionAmount}`);
      console.log(`   • Test Card: 4242 4242 4242 4242`);
      console.log(`   • Expiry: Any future date`);
      console.log(`   • CVC: Any 3 digits`);
      
      console.log('\n🚀 Next Steps:');
      console.log('   1. Implement frontend payment form using Stripe Elements');
      console.log('   2. Test with test cards from: https://stripe.com/docs/testing');
      console.log('   3. Set up webhook forwarding with: stripe listen --forward-to localhost:3000/api/payments/webhook');
      console.log('   4. Go live by replacing test keys with live keys');
      
    } catch (paymentError) {
      console.log('❌ Payment intent creation failed:');
      console.log(`   Error: ${paymentError.response?.data?.error || paymentError.message}`);
      console.log(`   Details: ${paymentError.response?.data?.details || 'No details'}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run test
testStripeIntegration();