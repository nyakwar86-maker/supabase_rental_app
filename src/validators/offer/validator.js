// validators/offer.validator.js
const { body, param } = require('express-validator');

exports.makeOffer = [
  param('conversation_id')
    .isUUID()
    .withMessage('Valid conversation ID is required'),

  body('offered_rent')
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Offer amount must be between $1 and $100,000'),

  body('terms')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Terms cannot exceed 1000 characters'),

  body('expires_in_hours')
    .optional()
    .isInt({ min: 1, max: 720 }) // 1 hour to 30 days
    .withMessage('Expiry must be between 1 and 720 hours (30 days)')
];

exports.rejectOffer = [
  param('conversation_id')
    .isUUID()
    .withMessage('Valid conversation ID is required'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];