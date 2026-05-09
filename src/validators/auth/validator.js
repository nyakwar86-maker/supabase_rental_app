// src/validators/auth.validator.js
const { body } = require('express-validator');

exports.register = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('role')
    .optional()
    .isIn(['tenant', 'landlord', 'admin'])
    .withMessage('Role must be tenant, landlord, or admin'),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Full name must be at least 2 characters long'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[0-9\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number')
];

exports.login = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];