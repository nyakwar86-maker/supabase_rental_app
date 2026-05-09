// scripts/supabase-setup.js
require('dotenv').config();
const { sequelize, testConnection } = require('../config/database'); // Adjust path as needed

const setupSupabase = async () => {
  console.log('🚀 Testing Supabase Connection...\n');
  
  const isConnected = await testConnection();
  
  if (isConnected) {
    console.log('\n✅ Success! Your database is ready for deployment.');
    console.log('\n📊 Next steps:');
    console.log('   1. Run migrations: npm run db:migrate');
    console.log('   2. Run seeders: npm run db:seed');
    console.log('   3. Deploy to Render');
  } else {
    console.log('\n❌ Connection failed. Please check:');
    console.log('   - DB_HOST is correct (ends with .supabase.co)');
    console.log('   - DB_PASSWORD matches Supabase project password');
    console.log('   - Database exists (default is "postgres")');
  }
  
  process.exit(0);
};

setupSupabase();