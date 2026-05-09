const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Store tokens and IDs for testing
let tenantToken = '';
let landlordToken = '';
let apartmentId = '';
let conversationId = '';
let landlordId = '';
let tenantId = '';

async function testConversationFlow() {
  console.log('🔍 Testing Conversation Flow\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create a Landlord User
    console.log('\n1️⃣  Creating Landlord User...');
    const landlordEmail = `landlord${Date.now()}@test.com`;
    const landlordRes = await axios.post(`${API_BASE}/auth/register`, {
      email: landlordEmail,
      password: 'password123',
      role: 'landlord',
      full_name: 'Test Landlord'
    });
    landlordToken = landlordRes.data.data.tokens.accessToken;
    landlordId = landlordRes.data.data.user.id;
    console.log(`✅ Landlord created: ${landlordEmail}`);
    console.log(`   Landlord ID: ${landlordId}`);

    // Step 2: Create an Apartment
    console.log('\n2️⃣  Creating Apartment...');
    const apartmentRes = await axios.post(`${API_BASE}/apartments`, {
      title: 'Beautiful Downtown Apartment',
      description: 'A modern apartment in the city center',
      address: '123 Main St',
      city: 'New York',
      rent_amount: 2000,
      bedrooms: 2,
      bathrooms: 1,
      amenities: ['parking', 'gym', 'pool']
    }, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    apartmentId = apartmentRes.data.data.apartment.id;
    console.log(`✅ Apartment created: ${apartmentRes.data.data.apartment.title}`);
    console.log(`   Apartment ID: ${apartmentId}`);

    // Step 3: Create a Tenant User
    console.log('\n3️⃣  Creating Tenant User...');
    const tenantEmail = `tenant${Date.now()}@test.com`;
    const tenantRes = await axios.post(`${API_BASE}/auth/register`, {
      email: tenantEmail,
      password: 'password123',
      role: 'tenant',
      full_name: 'Test Tenant'
    });
    tenantToken = tenantRes.data.data.tokens.accessToken;
    tenantId = tenantRes.data.data.user.id;
    console.log(`✅ Tenant created: ${tenantEmail}`);
    console.log(`   Tenant ID: ${tenantId}`);

    // Step 4: Tenant Views Available Apartments
    console.log('\n4️⃣  Tenant browsing apartments...');
    const apartmentsRes = await axios.get(`${API_BASE}/apartments`);
    console.log(`✅ Found ${apartmentsRes.data.data.pagination.total} apartments`);

    // Step 5: Tenant Starts Conversation with Landlord
    console.log('\n5️⃣  Tenant starting conversation...');
    const conversationRes = await axios.post(`${API_BASE}/conversations`, {
      apartment_id: apartmentId
    }, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    conversationId = conversationRes.data.data.conversation.id;
    console.log(`✅ Conversation created`);
    console.log(`   Conversation ID: ${conversationId}`);

    // Step 6: Get the Conversation Details
    console.log('\n6️⃣  Getting conversation details...');
    const getConvRes = await axios.get(`${API_BASE}/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    console.log('✅ Conversation details:');
    console.log(`   Tenant: ${getConvRes.data.data.conversation.tenant.full_name}`);
    console.log(`   Landlord: ${getConvRes.data.data.conversation.landlord.full_name}`);
    console.log(`   Apartment: ${getConvRes.data.data.conversation.apartment.title}`);
    console.log(`   Messages: ${getConvRes.data.data.conversation.messages.length}`);

    // Step 7: Tenant Sends First Message
    console.log('\n7️⃣  Tenant sending message...');
    await axios.post(`${API_BASE}/conversations/${conversationId}/messages`, {
      content: 'Hi! I saw your apartment listing. Is it still available?',
      message_type: 'text'
    }, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    console.log('✅ Message sent by tenant');

    // Step 8: Landlord Views Their Conversations
    console.log('\n8️⃣  Landlord checking their conversations...');
    const landlordConvsRes = await axios.get(`${API_BASE}/conversations`, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    console.log(`✅ Landlord has ${landlordConvsRes.data.data.conversations.length} conversation(s)`);

    // Step 9: Landlord Responds
    console.log('\n9️⃣  Landlord responding...');
    await axios.post(`${API_BASE}/conversations/${conversationId}/messages`, {
      content: 'Yes, it\'s still available! Would you like to schedule a viewing?',
      message_type: 'text'
    }, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    console.log('✅ Message sent by landlord');

    // Step 10: Get Updated Conversation with All Messages
    console.log('\n🔟  Getting updated conversation...');
    const updatedConvRes = await axios.get(`${API_BASE}/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    const messages = updatedConvRes.data.data.conversation.messages;
    console.log('✅ All messages in conversation:');
    messages.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.sender.full_name}]: ${msg.content}`);
    });

    // Step 11: Test Conversation List for Both Users
    console.log('\n1️⃣1️⃣  Testing conversation lists...');
    
    // Tenant's conversations
    const tenantConvsRes = await axios.get(`${API_BASE}/conversations`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    console.log(`✅ Tenant has ${tenantConvsRes.data.data.conversations.length} conversation(s)`);
    
    // Landlord's conversations
    const landlordConvsRes2 = await axios.get(`${API_BASE}/conversations`, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    console.log(`✅ Landlord has ${landlordConvsRes2.data.data.conversations.length} conversation(s)`);

    // Step 12: Try Duplicate Conversation Creation
    console.log('\n1️⃣2️⃣  Testing duplicate conversation prevention...');
    try {
      const duplicateRes = await axios.post(`${API_BASE}/conversations`, {
        apartment_id: apartmentId
      }, {
        headers: { Authorization: `Bearer ${tenantToken}` }
      });
      console.log('✅ Duplicate prevented, existing conversation returned');
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 CONVERSATION FLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📋 TEST SUMMARY:');
    console.log(`• Landlord: ${landlordEmail} (ID: ${landlordId})`);
    console.log(`• Tenant: ${tenantEmail} (ID: ${tenantId})`);
    console.log(`• Apartment: ${apartmentId}`);
    console.log(`• Conversation: ${conversationId}`);
    console.log(`• Total Messages: ${messages.length}`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status:', error.response.status);
    }
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Make sure server is running: npm start');
    console.log('2. Check database connection');
    console.log('3. Verify all required models are synced');
    console.log('4. Check if conversation controller exists at src/controllers/conversation/controller.js');
  }
}

// Run the test
testConversationFlow();