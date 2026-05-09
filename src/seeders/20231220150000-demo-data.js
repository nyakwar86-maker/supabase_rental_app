
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert test users
    await queryInterface.bulkInsert('users', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'tenant@example.com',
        password: '$2a$10$YourHashedPasswordHere', // password: tenant123
        role: 'tenant',
        full_name: 'John Tenant',
        phone: '+1234567890',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'landlord@example.com',
        password: '$2a$10$YourHashedPasswordHere', // password: landlord123
        role: 'landlord',
        full_name: 'Jane Landlord',
        phone: '+1234567891',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'admin@example.com',
        password: '$2a$10$YourHashedPasswordHere', // password: admin123
        role: 'admin',
        full_name: 'Admin User',
        phone: '+1234567892',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    // Insert test apartments
    await queryInterface.bulkInsert('apartments', [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        landlord_id: '22222222-2222-2222-2222-222222222222',
        title: 'Modern 2-Bedroom Apartment in City Center',
        description: 'Beautiful modern apartment with great views',
        address: '123 Main Street, Nairobi',
        city: 'Nairobi',
        rent_amount: 50000,
        bedrooms: 2,
        bathrooms: 2,
        status: 'available',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        landlord_id: '22222222-2222-2222-2222-222222222222',
        title: 'Cozy Studio Apartment',
        description: 'Perfect for singles or couples, fully furnished',
        address: '456 Oak Avenue, Nairobi',
        city: 'Nairobi',
        rent_amount: 25000,
        bedrooms: 1,
        bathrooms: 1,
        status: 'available',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('apartments', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
