// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All admin routes require admin role
router.use(authenticate);
router.use(authorize(['admin']));

// Dashboard statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/verify', adminController.verifyUser);
router.patch('/users/:id/status', adminController.updateUserStatus);

// Apartment verification
router.get('/apartments/pending', adminController.getPendingApartments);
router.patch('/apartments/:id/verify', adminController.verifyApartment);
router.patch('/apartments/:id/reject', adminController.rejectApartment);

// Commission management
router.get('/commissions/pending', adminController.getPendingCommissions);
router.get('/commissions/overview', adminController.getCommissionsOverview);

// Reports
router.get('/reports/monthly', adminController.getMonthlyReport);
router.get('/reports/export', adminController.exportReport);

module.exports = router;