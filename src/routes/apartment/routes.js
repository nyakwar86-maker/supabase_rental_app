
const express = require('express');
const router = express.Router();
const apartmentController = require('../../controllers/apartment/controller');
const imageController = require('../../controllers/image/controller');
const { authenticate, authorize } = require('../../middleware/auth/middleware');
const upload = require('../../config/upload');

// ====================
// PUBLIC ROUTES
// ====================

// Get all apartments with basic filters
router.get('/', apartmentController.getAllApartments);

// Search apartments with advanced filters
router.get('/search', apartmentController.searchApartments);

// Get available filters for frontend
router.get('/filters', apartmentController.getAvailableFilters);

// Get nearby apartments by location
router.get('/nearby', apartmentController.getNearbyApartments);

// Get single apartment by ID
router.get('/:id', apartmentController.getApartmentById);

// ====================
// PROTECTED ROUTES
// ====================
router.use(authenticate);

// ====================
// LANDLORD ROUTES
// ====================

// Create new apartment
router.post('/', 
  authorize(['landlord', 'admin']), 
  apartmentController.createApartment
);

// Edit apartment page (get apartment data for editing)
router.get('/:id/edit',
  authorize(['landlord', 'admin']),
  apartmentController.editApartmentPage
);

// Update apartment
router.put('/:id',
  authorize(['landlord', 'admin']),
  apartmentController.updateApartment
);

// Delete apartment
router.delete('/:id',
  authorize(['landlord', 'admin']),
  apartmentController.deleteApartment
);

// Get landlord's own apartments
router.get('/landlord/my-apartments',
  authorize(['landlord', 'admin']),
  apartmentController.getMyApartments
);

// ====================
// IMAGE ROUTES
// ====================

// Upload apartment images
router.post('/:id/images',
  authorize(['landlord', 'admin']),
  upload.array('images', 10), // Max 10 images
  imageController.uploadImages
);

// Get all images for an apartment
router.get('/:id/images',
  imageController.getApartmentImages
);

// Set primary image
router.put('/:id/images/:imageId/set-primary',
  authorize(['landlord', 'admin']),
  imageController.setPrimaryImage
);

// Reorder images
router.put('/:id/images/reorder',
  authorize(['landlord', 'admin']),
  imageController.reorderImages
);

// Delete image
router.delete('/:id/images/:imageId',
  authorize(['landlord', 'admin']),
  imageController.deleteImage
);

module.exports = router;