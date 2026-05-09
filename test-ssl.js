// test-ssl.js
const { Sequelize } = require('sequelize');

const configs = [
  { name: 'Option 1: ssl: true', ssl: true },
  { name: 'Option 2: ssl: { require: true }', ssl: { require: true } },
  { name: 'Option 3: ssl: { require: true, rejectUnauthorized: false }', ssl: { require: true, rejectUnauthorized: false } },
  { name: 'Option 4: No SSL', ssl: false }
];

async function testConfig(config) {
  console.log(`\n📝 Testing ${config.name}...`);
  
  const sequelize = new Sequelize('postgres', 'postgres.taguyeeadqtgfhhrgcmj', '2030Kolaz!!', {
    host: 'aws-1-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    dialect: 'postgres',
    dialectOptions: config.ssl ? { ssl: config.ssl } : {},
    logging: false
  });
  
  try {
    await sequelize.authenticate();
    console.log(`   ✅ WORKING! Use this configuration`);
    await sequelize.close();
    return true;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    await sequelize.close();
    return false;
  }
}

async function runTests() {
  console.log('🔍 Testing SSL configurations for Supabase...');
  
  for (const config of configs) {
    const worked = await testConfig(config);
    if (worked) {
      console.log('\n🎉 Found working configuration!');
      console.log(`Use: ${config.name}`);
      break;
    }
  }
}

runTests();