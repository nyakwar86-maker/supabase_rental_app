// tests/apartment-basic.test.js
const axios = require('axios');

console.log('\n🏠 BASIC APARTMENT FETCH TESTS (No Associations)\n');

const API_BASE_URL = 'http://localhost:5000/api';
let testData = {};

function logStep(step, message) {
  console.log(`\n${step} ${message}`);
}

function logSuccess(message) {
  console.log(`   ✅ ${message}`);
}

function logError(message, error) {
  console.log(`   ❌ ${message}`);
  if (error) {
    if (error.response) {
      console.log(`      Status: ${error.response.status}`);
      console.log(`      Error: ${error.response.data?.error || 'Unknown error'}`);
      if (error.response.data?.message) {
        console.log(`      Message: ${error.response.data.message}`);
      }
    } else {
      console.log(`      Error: ${error.message}`);
    }
  }
}

async function runBasicTests() {
  console.log('='.repeat(60));
  console.log('🏠 STARTING BASIC APARTMENT TESTS');
  console.log('='.repeat(60) + '\n');
  
  try {
    // ==================== SETUP ====================
    logStep('[SETUP]', 'Checking server health');
    
    try {
      const health = await axios.get('http://localhost:5000/health');
      logSuccess(`Server is ${health.data.status}`);
    } catch (error) {
      logError('Server not running');
      console.log('Please start server with: npm start');
      return;
    }
    
    // ==================== TEST 1: GET ALL APARTMENTS WITHOUT ASSOCIATIONS ====================
    logStep('[TEST 1]', 'GET /api/apartments - Simple fetch (no include)');
    
    // First, let's test without any filters
    try {
      const response = await axios.get(`${API_BASE_URL}/apartments`);
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${response.data.success}`);
      
      if (response.data.success) {
        const apartments = response.data.data?.apartments || [];
        const pagination = response.data.data?.pagination || {};
        
        logSuccess(`Found ${apartments.length} apartments`);
        
        if (apartments.length > 0) {
          console.log('\n   Sample apartments:');
          apartments.slice(0, 2).forEach((apt, index) => {
            console.log(`   ${index + 1}. ${apt.title || 'No title'} - $${apt.rent_amount} - ${apt.city || 'No city'}`);
            console.log(`      ID: ${apt.id}`);
            console.log(`      Status: ${apt.status}`);
          });
        }
      } else {
        logError('API returned unsuccessful');
        console.log('   Full response:', JSON.stringify(response.data, null, 2));
      }
    } catch (error) {
      logError('Failed to fetch apartments', error);
    }
    
    // ==================== TEST 2: CREATE APARTMENT THEN FETCH ====================
    logStep('[TEST 2]', 'Create apartment then fetch it');
    
    try {
      // First create a landlord user
      const landlordRes = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: `test-landlord-${Date.now()}@apartment-test.com`,
        password: 'password123',
        role: 'landlord',
        full_name: 'Apartment Test Landlord'
      });
      
      if (landlordRes.data.success) {
        testData.landlordToken = landlordRes.data.data.tokens.accessToken;
        logSuccess('Landlord created');
        
        // Create apartment WITHOUT landlord association initially
        const apartmentRes = await axios.post(`${API_BASE_URL}/apartments`, {
          title: 'Test Fetch Apartment',
          description: 'Testing apartment fetching',
          address: '123 Test Street',
          city: 'Test City',
          rent_amount: 1500,
          bedrooms: 2,
          bathrooms: 1
        }, {
          headers: {
            'Authorization': `Bearer ${testData.landlordToken}`
          }
        });
        
        if (apartmentRes.data.success) {
          testData.apartmentId = apartmentRes.data.data.apartment.id;
          logSuccess(`Apartment created: ${testData.apartmentId}`);
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now fetch it
          const fetchRes = await axios.get(`${API_BASE_URL}/apartments/${testData.apartmentId}`);
          
          if (fetchRes.data.success) {
            logSuccess('Successfully fetched created apartment');
            console.log(`   Title: ${fetchRes.data.data.apartment.title}`);
            console.log(`   Rent: $${fetchRes.data.data.apartment.rent_amount}`);
            console.log(`   City: ${fetchRes.data.data.apartment.city}`);
          } else {
            logError('Failed to fetch created apartment');
          }
        } else {
          logError('Failed to create apartment');
        }
      } else {
        logError('Failed to create landlord');
      }
    } catch (error) {
      logError('Test 2 failed', error);
    }
    
    // ==================== TEST 3: TEST WITHOUT INCLUDE PARAMETER ====================
    logStep('[TEST 3]', 'Debug: Check if include is causing the issue');
    
    try {
      // Try a very simple query first
      const simpleResponse = await axios.get(`${API_BASE_URL}/apartments?limit=1`);
      
      if (simpleResponse.data.success) {
        logSuccess('Simple query works');
        
        // Check what's in the response
        const apartment = simpleResponse.data.data.apartments[0];
        if (apartment) {
          console.log('\n   Apartment fields available:');
          Object.keys(apartment).forEach(key => {
            console.log(`   - ${key}: ${typeof apartment[key]}`);
          });
          
          // Check if landlord field exists
          if (apartment.landlord) {
            console.log('\n   Landlord field exists:', apartment.landlord);
          } else {
            console.log('\n   ⚠️  No landlord field in response');
          }
        }
      }
    } catch (error) {
      logError('Simple query failed', error);
    }
    
    // ==================== TEST 4: CHECK DATABASE DIRECTLY ====================
    logStep('[TEST 4]', 'Debug: Check raw database state');
    
    console.log('\n   To debug the association issue:');
    console.log('   1. Check if landlord_id column exists in apartments table');
    console.log('   2. Check if landlord_id values match user ids');
    console.log('   3. Check Sequelize model associations');
    
    // ==================== SUMMARY ====================
    console.log('\n' + '='.repeat(60));
    console.log('🛠️  DEBUGGING SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\nThe error "User is not associated to Apartment!" means:');
    console.log('1. Sequelize association between User and Apartment is not set up');
    console.log('2. OR the association name in the include statement is wrong');
    console.log('3. OR the models are not properly initialized');
    
    console.log('\n💡 Quick fixes to try:');
    console.log('1. Remove the include from getAllApartments method temporarily');
    console.log('2. Check that User.associate and Apartment.associate methods exist');
    console.log('3. Make sure models/index.js calls the associate methods');
    
    if (testData.apartmentId) {
      console.log('\n📋 Test data created:');
      console.log(`   Apartment ID: ${testData.apartmentId}`);
      console.log(`   Test URL: ${API_BASE_URL}/apartments/${testData.apartmentId}`);
    }
    
  } catch (error) {
    console.error('\n💥 UNEXPECTED ERROR:', error.message);
  }
}

// Run the tests
runBasicTests();