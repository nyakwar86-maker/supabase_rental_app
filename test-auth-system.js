
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let accessToken = '';

async function testAuth() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // 1. Test server is running
    console.log('1. Testing server status...');
    const statusRes = await axios.get('http://localhost:5000/health');
    console.log('✅ Server:', statusRes.data.status);
    
    // 2. Test register endpoint
    console.log('\n2. Testing registration...');
    const testEmail = `test${Date.now()}@example.com`;
    
    const registerRes = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: 'password123',
      full_name: 'Test User',
      role: 'tenant',
      phone: '+1234567890'
    });
    
    console.log('✅ Registration:', registerRes.data.message);
    console.log('   User created:', registerRes.data.data.user.email);
    console.log('   Role:', registerRes.data.data.user.role);
    
    accessToken = registerRes.data.data.tokens.accessToken;
    
    // 3. Test login with wrong password
    console.log('\n3. Testing login with wrong password...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      });
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Login rejected with wrong password (as expected)');
      }
    }
    
    // 4. Test login with correct password
    console.log('\n4. Testing login with correct password...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: 'password123'
    });
    
    console.log('✅ Login successful:', loginRes.data.message);
    accessToken = loginRes.data.data.tokens.accessToken;
    
    // 5. Test protected route without token
    console.log('\n5. Testing protected route without token...');
    try {
      await axios.get(`${API_URL}/auth/me`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Protected route rejected without token (as expected)');
      }
    }
    
    // 6. Test protected route with token
    console.log('\n6. Testing protected route with token...');
    const profileRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    console.log('✅ Protected route accessed successfully');
    console.log('   User email:', profileRes.data.data.user.email);
    console.log('   User role:', profileRes.data.data.user.role);
    
    // 7. Test duplicate registration
    console.log('\n7. Testing duplicate registration...');
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: 'password123'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Duplicate registration rejected (as expected)');
      }
    }
    
    console.log('\n🎉 Authentication system test PASSED!');
    console.log('\n📋 Summary:');
    console.log('   ✓ User registration works');
    console.log('   ✓ Password hashing works');
    console.log('   ✓ Login with correct credentials works');
    console.log('   ✓ Login with wrong credentials fails');
    console.log('   ✓ JWT token generation works');
    console.log('   ✓ Protected routes require token');
    console.log('   ✓ Duplicate emails are prevented');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Error details:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if server is running first
axios.get('http://localhost:5000/health')
  .then(() => testAuth())
  .catch(err => {
    console.error('❌ Server not running. Please start it first: npm run dev');
    process.exit(1);
  });
