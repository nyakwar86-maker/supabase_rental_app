
const axios = require('axios');

async function quickTest() {
  console.log('🧪 Quick Test...\n');
  
  try {
    // 1. Create user
    console.log('1. Creating landlord...');
    const register = await axios.post('http://localhost:5000/api/auth/register', {
      email: `test${Date.now()}@example.com`,
      password: 'password123',
      full_name: 'Test User',
      role: 'landlord'
    });
    
    const token = register.data.data.tokens.accessToken;
    console.log('✅ User created, token received');
    
    // 2. Create apartment
    console.log('\n2. Creating apartment...');
    const apt = await axios.post('http://localhost:5000/api/apartments', {
      title: 'Simple Test Apartment',
      address: '123 Test St',
      city: 'Nairobi',
      rent_amount: 40000
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Apartment created!');
    console.log('   Title:', apt.data.data.apartment.title);
    console.log('   Landlord ID:', apt.data.data.apartment.landlord_id);
    
    // 3. Check tables
    console.log('\n3. Checking database...');
    const health = await axios.get('http://localhost:5000/health');
    console.log('✅ Database counts:');
    console.log('   Users:', health.data.counts?.users || 0);
    console.log('   Apartments:', health.data.counts?.apartments || 0);
    
    console.log('\n🎉 Test PASSED!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.message?.includes('landlord_profiles')) {
      console.error('\n💡 PROBLEM: Foreign key still points to landlord_profiles table');
      console.error('💡 SOLUTION: Run the manual cleanup steps above');
    }
    process.exit(1);
  }
}

// Wait for server
setTimeout(() => {
  axios.get('http://localhost:5000/health')
    .then(() => quickTest())
    .catch(() => {
      console.error('❌ Server not running. Start with: npm run dev');
      process.exit(1);
    });
}, 2000);
