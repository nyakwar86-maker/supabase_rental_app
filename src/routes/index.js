// src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth/routes');
const userRoutes = require('./user/routes');
const apartmentRoutes = require('./apartment/routes');
const conversationRoutes = require('./conversation/routes');


// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/apartments', apartmentRoutes);
router.use('/conversations', conversationRoutes); // ADD THIS LINE

// API Documentation
router.get('/', (req, res) => {
  res.json({
    name: 'Rental Marketplace API',
    version: '1.0.0',
    description: 'Rental marketplace with commission-based model',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      apartments: '/api/apartments',
      conversations: '/api/conversations' // ADD THIS
    }
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;