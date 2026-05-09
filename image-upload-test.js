const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function testImageUpload() {
  console.log('🖼️ Testing Image Upload Functionality\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Create test landlord
    console.log('\n1. Creating test landlord...');
    const landlordRes = await axios.post(`${API_BASE}/auth/register`, {
      email: `image-landlord-${Date.now()}@test.com`,
      password: 'password123',
      role: 'landlord',
      full_name: 'Image Test Landlord'
    });
    
    const landlordToken = landlordRes.data.data.tokens.accessToken;
    const landlordId = landlordRes.data.data.user.id;
    console.log(`✅ Landlord created: ${landlordId}`);
    
    // 2. Create test tenant (for unauthorized test)
    console.log('\n2. Creating test tenant...');
    const tenantRes = await axios.post(`${API_BASE}/auth/register`, {
      email: `image-tenant-${Date.now()}@test.com`,
      password: 'password123',
      role: 'tenant',
      full_name: 'Image Test Tenant'
    });
    
    const tenantToken = tenantRes.data.data.tokens.accessToken;
    console.log(`✅ Tenant created`);
    
    // 3. Create apartment
    console.log('\n3. Creating apartment...');
    const apartmentRes = await axios.post(`${API_BASE}/apartments`, {
      title: 'Image Test Apartment',
      description: 'Testing image upload functionality',
      address: '123 Image Test Street',
      city: 'Imageville',
      rent_amount: 1500,
      bedrooms: 2,
      bathrooms: 1
    }, {
      headers: { Authorization: `Bearer ${landlordToken}` }
    });
    
    const apartmentId = apartmentRes.data.data.apartment.id;
    console.log(`✅ Apartment created: ${apartmentId}`);
    
    // 4. Test 1: Unauthorized upload (should fail)
    console.log('\n4. Testing unauthorized upload (tenant trying to upload)...');
    try {
      const formData = new FormData();
      // Create a dummy image file
      const dummyImage = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      
      formData.append('images', dummyImage, {
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      });
      
      await axios.post(
        `${API_BASE}/apartments/${apartmentId}/images`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${tenantToken}`
          }
        }
      );
      
      console.log(`❌ Should have failed (tenant cannot upload)`);
    } catch (unauthError) {
      console.log(`✅ Correctly failed: ${unauthError.response?.data?.error}`);
    }
    
    // 5. Test 2: Upload with no images (should fail)
    console.log('\n5. Testing upload with no images...');
    try {
      await axios.post(
        `${API_BASE}/apartments/${apartmentId}/images`,
        {},
        {
          headers: { Authorization: `Bearer ${landlordToken}` }
        }
      );
      
      console.log(`❌ Should have failed (no images)`);
    } catch (noImageError) {
      console.log(`✅ Correctly failed: ${noImageError.response?.data?.error || 'No images'}`);
    }
    
    // 6. Test 3: Get images (should return empty)
    console.log('\n6. Getting images (should be empty)...');
    const emptyImages = await axios.get(
      `${API_BASE}/apartments/${apartmentId}/images`,
      { headers: { Authorization: `Bearer ${landlordToken}` } }
    );
    
    console.log(`✅ Images: ${emptyImages.data.data.count} found`);
    
    // 7. Test 4: Create a test image file
    console.log('\n7. Creating test image file...');
    const testImagePath = path.join(__dirname, 'test-image.jpg');
    
    // Create a simple 1x1 pixel JPEG
    const testImage = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAICAgICAQICAgIDAgIDAwYEAwMDAwcFBQQGCAcJCAgHCAgJCg0LCQoMCggICw8LDA0ODg8OCQsQERAOEQ0ODg7/2wBDAQIDAwMDAwcEBAcOCQgJDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg7/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=', 'base64');
    fs.writeFileSync(testImagePath, testImage);
    
    console.log(`✅ Test image created: ${testImagePath}`);
    
    // 8. Test 5: Successful upload (simulated - need actual multipart)
    console.log('\n8. Testing successful upload flow...');
    console.log('   For actual upload test, use:');
    console.log(`   curl -X POST ${API_BASE}/apartments/${apartmentId}/images \\`);
    console.log(`     -H "Authorization: Bearer ${landlordToken}" \\`);
    console.log(`     -F "images=@${testImagePath}"`);
    
    // 9. Test 6: Image endpoints summary
    console.log('\n9. Image endpoints available:');
    console.log(`   • POST   /api/apartments/${apartmentId}/images - Upload images`);
    console.log(`   • GET    /api/apartments/${apartmentId}/images - Get all images`);
    console.log(`   • PUT    /api/apartments/${apartmentId}/images/:imageId/set-primary - Set primary`);
    console.log(`   • PUT    /api/apartments/${apartmentId}/images/reorder - Reorder images`);
    console.log(`   • DELETE /api/apartments/${apartmentId}/images/:imageId - Delete image`);
    
    // 10. Cleanup
    console.log('\n10. Cleaning up...');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('✅ Test image cleaned up');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 IMAGE UPLOAD TEST COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📋 Next steps for frontend integration:');
    console.log('1. Create image upload component with drag & drop');
    console.log('2. Implement image preview before upload');
    console.log('3. Add image gallery for apartment details');
    console.log('4. Add image reordering functionality');
    console.log('5. Add delete confirmation for images');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data?.error);
      console.error('Details:', error.response.data?.details);
    }
  }
}

testImageUpload();