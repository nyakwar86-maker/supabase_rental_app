

const { body, param } = require('express-validator');

exports.createConversation = [
  body('apartment_id')
    .isUUID()
    .withMessage('Valid apartment ID is required')
];

exports.sendMessage = [
  param('id')
    .isUUID()
    .withMessage('Valid conversation ID is required'),
  
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('message_type')
    .optional()
    .isIn(['text', 'image', 'offer', 'acceptance', 'payment', 'location_pin'])
    .withMessage('Invalid message type')
];

exports.makeOffer = [
  param('conversation_id')
    .isUUID()
    .withMessage('Valid conversation ID is required'),
  
  body('offered_rent')
    .optional()
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

exports.shareLocation = [
  param('id')
    .isUUID()
    .withMessage('Valid conversation ID is required'),
  
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  
  body('meeting_time')
    .optional()
    .isISO8601()
    .withMessage('Valid meeting time is required')
];

// ✅ ADD THIS VALIDATOR
exports.markAsRead = [
  param('id')
    .isUUID()
    .withMessage('Valid conversation ID is required')
];