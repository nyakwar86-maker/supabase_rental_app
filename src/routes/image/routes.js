const express = require('express');
const router = express.Router();
const imageController = require('../../controllers/image/controller');
const upload = require('../../config/upload');
const { authenticate, authorize } = require('../../middleware/auth/middleware');

// All routes require authentication
router.use(authenticate);

// Upload images (multiple files)
router.post('/apartments/:id/images',
  authorize(['landlord', 'admin']),
  upload.array('images', 10), // Max 10 images
  imageController.uploadImages
);

// Get all images for an apartment
router.get('/apartments/:id/images',
  imageController.getApartmentImages
);

// Set primary image
router.put('/apartments/:id/images/:imageId/set-primary',
  authorize(['landlord', 'admin']),
  imageController.setPrimaryImage
);

// Reorder images
router.put('/apartments/:id/images/reorder',
  authorize(['landlord', 'admin']),
  imageController.reorderImages
);

// Delete image
router.delete('/apartments/:id/images/:imageId',
  authorize(['landlord', 'admin']),
  imageController.deleteImage
);

module.exports = router;