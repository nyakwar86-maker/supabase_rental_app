// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user/controller');
const { authenticate } = require('../../middleware/auth/middleware');

// All user routes require authentication
router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/change-password', userController.changePassword);

// Landlord specific
router.get('/landlord/stats', userController.getLandlordStats);

// Admin only
router.get('/', userController.getAllUsers); // Admin only
router.put('/:id/verify', userController.verifyUser); // Admin only

module.exports = router;