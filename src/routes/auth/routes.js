
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth/controller');
const { authenticate } = require('../../middleware/auth/middleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected route (requires authentication)
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
