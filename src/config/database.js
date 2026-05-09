



const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use the URI string if available, otherwise fallback to local parts
const databaseUrl = process.env.DATABASE_URL;

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Database connection configuration
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD, 
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    
    // Connection pool configuration
    pool: {
      max: isProduction ? 10 : 5,      // More connections in production
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    
    // Global model settings
    define: {
      timestamps: true,
      underscored: true,
      //createdAt: 'created_at',
      //updatedAt: 'updated_at'
    },
    
    // SSL Configuration - CRITICAL for Supabase
    dialectOptions: isProduction ? {
      ssl: {
        require: true,
        rejectUnauthorized: false  // Required for Supabase
      }
    } : {}
  }
);



// Test connection function with better error handling
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully.');
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 SSL: ${isProduction ? 'Enabled' : 'Disabled'}`);
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your .env file credentials');
    console.log('   2. For Supabase: Verify connection string is correct');
    console.log('   3. For local: Make sure PostgreSQL is running');
    console.log('   4. Check if IP is whitelisted (Supabase requires this)');
    
    if (error.message.includes('SSL')) {
      console.log('\n🔧 SSL Issue: Make sure dialectOptions.ssl is configured correctly');
    }
    if (error.message.includes('password authentication failed')) {
      console.log('\n🔑 Password Error: Check DB_PASSWORD in your .env file');
    }
    if (error.message.includes('does not exist')) {
      console.log('\n💾 Database Error: Make sure the database name is correct');
    }
    
    return false;
  }
};

// Graceful shutdown handling
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('📴 Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Handle application termination
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = { sequelize, testConnection, closeConnection };


