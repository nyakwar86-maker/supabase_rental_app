// src/app.js - UPDATED VERSION
const express = require('express');
// const cors = require('cors');
const path = require('path');
require('dotenv').config();

const cors = require('cors');
const { corsOptions } = require('./config/cors');



// Import database
const { sequelize } = require('./config/database');
const db = require('./models');

// Import routes - UPDATED: Added conversation routes
const routes = require('./routes');
const authRoutes = require('./routes/auth/routes');
const apartmentRoutes = require('./routes/apartment/routes');
const conversationRoutes = require('./routes/conversation/routes');
const paymentRoutes = require('./routes/payment/routes');
const imageRoutes = require('./routes/image/routes');

const app = express();

app.set('io', null); // Will be set in server.js

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Test database connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Use simple sync - no alter
    await db.sequelize.sync();
    console.log('✅ Database tables ready');

  } catch (error) {
    console.error('❌ Database error:', error.message);

    // If sync fails, try creating tables manually
    console.log('🔄 Trying to create tables manually...');
    try {
      // Force create tables
      await db.sequelize.sync({ force: true });
      console.log('✅ Tables created fresh');
    } catch (innerError) {
      console.error('❌ Could not create tables:', innerError.message);
    }
  }
})();


// Routes
app.use('/api', routes);
app.use('/api', imageRoutes);
app.get('/', (req, res) => {
  res.json({
    message: 'Rental Marketplace API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me (requires token)'
      },
      apartments: {
        list: 'GET /api/apartments',
        single: 'GET /api/apartments/:id',
        nearby: 'GET /api/apartments/search/nearby',
        create: 'POST /api/apartments (landlord token required)',
        update: 'PUT /api/apartments/:id (owner token required)',
        delete: 'DELETE /api/apartments/:id (owner token required)',
        'my-apartments': 'GET /api/apartments/landlord/my-apartments (landlord token required)'
      },
      // ADD THIS SECTION:
      conversations: {
        list: 'GET /api/conversations',
        create: 'POST /api/conversations',
        single: 'GET /api/conversations/:id',
        messages: 'POST /api/conversations/:id/messages',
        'make-offer': 'POST /api/conversations/:conversation_id/offer (landlord only)',
        'accept-offer': 'POST /api/conversations/:conversation_id/offer/accept (tenant only)',
        'share-location': 'POST /api/conversations/:conversation_id/share-location (landlord only)'
      },
      payments: {
        'create-intent': 'POST /api/payments/create-intent',
        'confirm': 'POST /api/payments/confirm',
        'status': 'GET /api/payments/status/:payment_intent_id',
        'create-checkout': 'POST /api/payments/create-checkout',
        'webhook': 'POST /api/payments/webhook (Stripe webhook)'
      }
    }
  });
});

// Update API documentation to include images
app.get('/', (req, res) => {
  res.json({
    message: 'Rental Marketplace API',
    version: '1.0.0',
    endpoints: {
      // ... existing endpoints ...
      images: {
        'upload': 'POST /api/apartments/:id/images (landlord only)',
        'list': 'GET /api/apartments/:id/images',
        'set-primary': 'PUT /api/apartments/:id/images/:imageId/set-primary (landlord only)',
        'reorder': 'PUT /api/apartments/:id/images/reorder (landlord only)',
        'delete': 'DELETE /api/apartments/:id/images/:imageId (landlord only)'
      }
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();

    // Get counts
    const userCount = await db.User.count();
    const apartmentCount = await db.Apartment.count();

    res.json({
      status: 'healthy',
      database: 'connected',
      counts: {
        users: userCount,
        apartments: apartmentCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});


// API routes - UPDATED: Added conversation routes
app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/conversations', conversationRoutes); // ADD THIS LINE
app.use('/api/payments', paymentRoutes);



// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;