
// const db = require('../../models');
// const fs = require('fs');
// const path = require('path');
// const { v4: uuidv4 } = require('uuid');

// class ImageController {
//   /**
//    * Upload apartment images
//    * POST /api/apartments/:id/images
//    */
//   async uploadImages(req, res) {
//     try {
//       const apartmentId = req.params.id;
//       const userId = req.userId;
//       const files = req.files;

//       console.log(`📸 Uploading images for apartment ${apartmentId}`);

//       // 1. Verify apartment exists and user is the landlord
//       const apartment = await db.Apartment.findByPk(apartmentId);
      
//       if (!apartment) {
//         // Clean up uploaded files
//         files?.forEach(file => {
//           if (fs.existsSync(file.path)) {
//             fs.unlinkSync(file.path);
//           }
//         });
        
//         return res.status(404).json({
//           success: false,
//           error: 'Apartment not found'
//         });
//       }

//       // Check authorization
//       if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
//         // Clean up uploaded files
//         files?.forEach(file => {
//           if (fs.existsSync(file.path)) {
//             fs.unlinkSync(file.path);
//           }
//         });
        
//         return res.status(403).json({
//           success: false,
//           error: 'Only the landlord can upload images'
//         });
//       }

//       if (!files || files.length === 0) {
//         return res.status(400).json({
//           success: false,
//           error: 'No images provided'
//         });
//       }

//       // 2. Process each image
//       const uploadedImages = [];
//       let primarySet = false;

//       // Check if there's already a primary image
//       const existingPrimary = await db.ApartmentImage.findOne({
//         where: {
//           apartment_id: apartmentId,
//           is_primary: true,
//           status: 'active'
//         }
//       });

//       for (const file of files) {
//         try {
//           // Generate unique filename for storage
//           const uniqueFilename = `apartment-${apartmentId}-${uuidv4()}${path.extname(file.originalname)}`;
          
//           // In production, upload to Cloudinary/S3 here
//           // For now, we'll use local paths
//           const imageUrl = `/uploads/apartment-images/${uniqueFilename}`;
//           const filePath = path.join('uploads/apartment-images', uniqueFilename);

//           // Move/rename the file
//           fs.renameSync(file.path, filePath);

//           // Determine if this should be primary
//           const isPrimary = !existingPrimary && !primarySet && uploadedImages.length === 0;

//           // Create image record
//           const image = await db.ApartmentImage.create({
//             apartment_id: apartmentId,
//             image_url: imageUrl,
//             image_name: file.originalname,
//             image_size: file.size,
//             mime_type: file.mimetype,
//             is_primary: isPrimary,
//             display_order: uploadedImages.length,
//             uploaded_by: userId,
//             status: 'active'
//           });

//           if (isPrimary) {
//             primarySet = true;
//           }

//           uploadedImages.push({
//             id: image.id,
//             image_url: imageUrl,
//             is_primary: image.is_primary,
//             display_order: image.display_order
//           });

//         } catch (fileError) {
//           console.error('Error processing file:', fileError);
//           // Continue with other files
//         }
//       }

//       console.log(`✅ Uploaded ${uploadedImages.length} images for apartment ${apartmentId}`);

//       res.status(201).json({
//         success: true,
//         message: `Successfully uploaded ${uploadedImages.length} image(s)`,
//         data: {
//           images: uploadedImages,
//           total_uploaded: uploadedImages.length
//         }
//       });

//     } catch (error) {
//       console.error('❌ Upload images error:', error);
      
//       // Clean up any uploaded files
//       if (req.files) {
//         req.files.forEach(file => {
//           if (fs.existsSync(file.path)) {
//             fs.unlinkSync(file.path);
//           }
//         });
//       }
      
//       res.status(500).json({
//         success: false,
//         error: 'Failed to upload images',
//         details: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Get all images for an apartment
//    * GET /api/apartments/:id/images
//    */
//   async getApartmentImages(req, res) {
//     try {
//       const apartmentId = req.params.id;

//       const images = await db.ApartmentImage.findAll({
//         where: {
//           apartment_id: apartmentId,
//           status: 'active'
//         },
//         order: [
//           ['is_primary', 'DESC'],
//           ['display_order', 'ASC'],
//           ['created_at', 'DESC']
//         ],
//         attributes: [
//           'id', 'image_url', 'thumbnail_url', 'is_primary', 
//           'display_order', 'created_at', 'uploaded_by'
//         ]
//       });

//       res.json({
//         success: true,
//         data: {
//           images,
//           count: images.length
//         }
//       });

//     } catch (error) {
//       console.error('❌ Get images error:', error);
//       res.status(500).json({
//         success: false,
//         error: 'Failed to fetch images'
//       });
//     }
//   }

//   /**
//    * Set primary image
//    * PUT /api/apartments/:id/images/:imageId/set-primary
//    */
//   async setPrimaryImage(req, res) {
//     try {
//       const { id: apartmentId, imageId } = req.params;
//       const userId = req.userId;

//       // 1. Verify apartment exists and user is landlord
//       const apartment = await db.Apartment.findByPk(apartmentId);
      
//       if (!apartment) {
//         return res.status(404).json({
//           success: false,
//           error: 'Apartment not found'
//         });
//       }

//       if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
//         return res.status(403).json({
//           success: false,
//           error: 'Only the landlord can set primary image'
//         });
//       }

//       // 2. Find the image
//       const image = await db.ApartmentImage.findOne({
//         where: {
//           id: imageId,
//           apartment_id: apartmentId,
//           status: 'active'
//         }
//       });

//       if (!image) {
//         return res.status(404).json({
//           success: false,
//           error: 'Image not found'
//         });
//       }

//       // 3. Start transaction
//       const transaction = await db.sequelize.transaction();

//       try {
//         // 4. Remove primary status from all other images
//         await db.ApartmentImage.update(
//           { is_primary: false },
//           {
//             where: {
//               apartment_id: apartmentId,
//               is_primary: true
//             },
//             transaction
//           }
//         );

//         // 5. Set this image as primary
//         await image.update(
//           { is_primary: true },
//           { transaction }
//         );

//         // 6. Commit transaction
//         await transaction.commit();

//         console.log(`✅ Set image ${imageId} as primary for apartment ${apartmentId}`);

//         res.json({
//           success: true,
//           message: 'Primary image updated successfully',
//           data: {
//             image_id: imageId,
//             is_primary: true
//           }
//         });

//       } catch (transactionError) {
//         await transaction.rollback();
//         throw transactionError;
//       }

//     } catch (error) {
//       console.error('❌ Set primary image error:', error);
//       res.status(500).json({
//         success: false,
//         error: 'Failed to set primary image'
//       });
//     }
//   }

//   /**
//    * Reorder images
//    * PUT /api/apartments/:id/images/reorder
//    */
//   async reorderImages(req, res) {
//     try {
//       const apartmentId = req.params.id;
//       const userId = req.userId;
//       const { imageOrder } = req.body; // Array of image IDs in desired order

//       if (!Array.isArray(imageOrder)) {
//         return res.status(400).json({
//           success: false,
//           error: 'imageOrder must be an array of image IDs'
//         });
//       }

//       // 1. Verify apartment exists and user is landlord
//       const apartment = await db.Apartment.findByPk(apartmentId);
      
//       if (!apartment) {
//         return res.status(404).json({
//           success: false,
//           error: 'Apartment not found'
//         });
//       }

//       if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
//         return res.status(403).json({
//           success: false,
//           error: 'Only the landlord can reorder images'
//         });
//       }

//       // 2. Update display order for each image
//       const transaction = await db.sequelize.transaction();

//       try {
//         for (let i = 0; i < imageOrder.length; i++) {
//           const imageId = imageOrder[i];
          
//           await db.ApartmentImage.update(
//             { display_order: i },
//             {
//               where: {
//                 id: imageId,
//                 apartment_id: apartmentId
//               },
//               transaction
//             }
//           );
//         }

//         await transaction.commit();

//         console.log(`✅ Reordered images for apartment ${apartmentId}`);

//         res.json({
//           success: true,
//           message: 'Images reordered successfully'
//         });

//       } catch (transactionError) {
//         await transaction.rollback();
//         throw transactionError;
//       }

//     } catch (error) {
//       console.error('❌ Reorder images error:', error);
//       res.status(500).json({
//         success: false,
//         error: 'Failed to reorder images'
//       });
//     }
//   }

//   /**
//    * Delete an image
//    * DELETE /api/apartments/:id/images/:imageId
//    */
//   async deleteImage(req, res) {
//     try {
//       const { id: apartmentId, imageId } = req.params;
//       const userId = req.userId;

//       // 1. Verify apartment exists and user is landlord
//       const apartment = await db.Apartment.findByPk(apartmentId);
      
//       if (!apartment) {
//         return res.status(404).json({
//           success: false,
//           error: 'Apartment not found'
//         });
//       }

//       if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
//         return res.status(403).json({
//           success: false,
//           error: 'Only the landlord can delete images'
//         });
//       }

//       // 2. Find the image
//       const image = await db.ApartmentImage.findOne({
//         where: {
//           id: imageId,
//           apartment_id: apartmentId,
//           status: 'active'
//         }
//       });

//       if (!image) {
//         return res.status(404).json({
//           success: false,
//           error: 'Image not found'
//         });
//       }

//       const transaction = await db.sequelize.transaction();

//       try {
//         // 3. Soft delete the image
//         await image.update(
//           { status: 'deleted' },
//           { transaction }
//         );

//         // 4. If this was the primary image, set a new one
//         if (image.is_primary) {
//           const newPrimary = await db.ApartmentImage.findOne({
//             where: {
//               apartment_id: apartmentId,
//               id: { [db.Sequelize.Op.not]: imageId },
//               status: 'active'
//             },
//             order: [['display_order', 'ASC']],
//             transaction
//           });

//           if (newPrimary) {
//             await newPrimary.update(
//               { is_primary: true },
//               { transaction }
//             );
//           }
//         }

//         await transaction.commit();

//         console.log(`✅ Deleted image ${imageId} from apartment ${apartmentId}`);

//         res.json({
//           success: true,
//           message: 'Image deleted successfully'
//         });

//       } catch (transactionError) {
//         await transaction.rollback();
//         throw transactionError;
//       }

//     } catch (error) {
//       console.error('❌ Delete image error:', error);
//       res.status(500).json({
//         success: false,
//         error: 'Failed to delete image'
//       });
//     }
//   }

//   /**
//    * Update apartment with images from frontend
//    * This would be called when apartment is created/updated with images
//    */
//   async processApartmentImages(apartmentId, imagesData, userId) {
//     try {
//       // imagesData should be an array of image URLs from frontend
//       // For now, we'll create placeholder records
//       const createdImages = [];

//       for (let i = 0; i < imagesData.length; i++) {
//         const imageData = imagesData[i];
        
//         const image = await db.ApartmentImage.create({
//           apartment_id: apartmentId,
//           image_url: imageData.url || '/images/default-apartment.jpg',
//           image_name: imageData.name || `image-${i + 1}`,
//           is_primary: i === 0, // First image is primary
//           display_order: i,
//           uploaded_by: userId,
//           status: 'active'
//         });

//         createdImages.push(image);
//       }

//       return createdImages;
//     } catch (error) {
//       console.error('Process images error:', error);
//       return [];
//     }
//   }
// }

// module.exports = new ImageController();


const db = require('../../models');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ImageController {
  /**
   * Upload apartment images
   * POST /api/apartments/:id/images
   */
  async uploadImages(req, res) {
    try {
      const apartmentId = req.params.id;
      const userId = req.userId;
      const files = req.files;
      
      console.log(`📸 Uploading images for apartment ${apartmentId}`);

      // 1. Verify apartment exists and user is the landlord
      const apartment = await db.Apartment.findByPk(apartmentId);
      
      if (!apartment) {
        // Clean up uploaded files
        files?.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        
        return res.status(404).json({
          success: false,
          error: 'Apartment not found'
        });
      }

      // Check authorization
      if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
        // Clean up uploaded files
        files?.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Only the landlord can upload images'
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images provided'
        });
      }

      // 2. Process each image
      const uploadedImages = [];
      let primarySet = false;
      
      // Check if there's already a primary image
      const existingPrimary = await db.ApartmentImage.findOne({
        where: {
          apartment_id: apartmentId,
          is_primary: true,
          status: 'active'
        }
      });

      for (const file of files) {
        try {
          // Generate unique filename for storage
          const uniqueFilename = `apartment-${apartmentId}-${uuidv4()}${path.extname(file.originalname)}`;
          
          // In production, upload to Cloudinary/S3 here
          // For now, we'll use local paths
          const imageUrl = `/uploads/apartment-images/${uniqueFilename}`;
          const filePath = path.join('uploads/apartment-images', uniqueFilename);
          
          // Move/rename the file
          fs.renameSync(file.path, filePath);
          
          // Determine if this should be primary
          const isPrimary = !existingPrimary && !primarySet && uploadedImages.length === 0;
          
          // Create image record
          const image = await db.ApartmentImage.create({
            apartment_id: apartmentId,
            image_url: imageUrl,
            image_name: file.originalname,
            image_size: file.size,
            mime_type: file.mimetype,
            is_primary: isPrimary,
            display_order: uploadedImages.length,
            uploaded_by: userId,
            status: 'active'
          });

          if (isPrimary) {
            primarySet = true;
          }

          uploadedImages.push({
            id: image.id,
            image_url: imageUrl,
            is_primary: image.is_primary,
            display_order: image.display_order
          });
        } catch (fileError) {
          console.error('Error processing file:', fileError);
          // Continue with other files
        }
      }

      console.log(`✅ Uploaded ${uploadedImages.length} images for apartment ${apartmentId}`);
      
      res.status(201).json({
        success: true,
        message: `Successfully uploaded ${uploadedImages.length} image(s)`,
        data: {
          images: uploadedImages,
          total_uploaded: uploadedImages.length
        }
      });
    } catch (error) {
      console.error('❌ Upload images error:', error);
      
      // Clean up any uploaded files
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to upload images',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all images for an apartment
   * GET /api/apartments/:id/images
   */
  async getApartmentImages(req, res) {
    try {
      const apartmentId = req.params.id;
      
      const images = await db.ApartmentImage.findAll({
        where: {
          apartment_id: apartmentId,
          status: 'active'
        },
        order: [
          ['is_primary', 'DESC'],
          ['display_order', 'ASC'],
          ['created_at', 'DESC']
        ],
        attributes: [
          'id', 'image_url', 'thumbnail_url', 'is_primary',
          'display_order', 'created_at', 'uploaded_by'
        ]
      });

      res.json({
        success: true,
        data: {
          images,
          count: images.length
        }
      });
    } catch (error) {
      console.error('❌ Get images error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch images'
      });
    }
  }

  /**
   * Set primary image
   * PUT /api/apartments/:id/images/:imageId/set-primary
   */
  async setPrimaryImage(req, res) {
    try {
      const { id: apartmentId, imageId } = req.params;
      const userId = req.userId;
      
      // 1. Verify apartment exists and user is landlord
      const apartment = await db.Apartment.findByPk(apartmentId);
      
      if (!apartment) {
        return res.status(404).json({
          success: false,
          error: 'Apartment not found'
        });
      }

      if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only the landlord can set primary image'
        });
      }

      // 2. Find the image
      const image = await db.ApartmentImage.findOne({
        where: {
          id: imageId,
          apartment_id: apartmentId,
          status: 'active'
        }
      });

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      // 3. Start transaction
      const transaction = await db.sequelize.transaction();
      
      try {
        // 4. Remove primary status from all other images
        await db.ApartmentImage.update(
          { is_primary: false },
          {
            where: {
              apartment_id: apartmentId,
              is_primary: true
            },
            transaction
          }
        );

        // 5. Set this image as primary
        await image.update(
          { is_primary: true },
          { transaction }
        );

        // 6. Commit transaction
        await transaction.commit();
        
        console.log(`✅ Set image ${imageId} as primary for apartment ${apartmentId}`);
        
        res.json({
          success: true,
          message: 'Primary image updated successfully',
          data: {
            image_id: imageId,
            is_primary: true
          }
        });
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } catch (error) {
      console.error('❌ Set primary image error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set primary image'
      });
    }
  }

  /**
   * Reorder images
   * PUT /api/apartments/:id/images/reorder
   */
  async reorderImages(req, res) {
    try {
      const apartmentId = req.params.id;
      const userId = req.userId;
      const { imageOrder } = req.body; // Array of image IDs in desired order
      
      if (!Array.isArray(imageOrder)) {
        return res.status(400).json({
          success: false,
          error: 'imageOrder must be an array of image IDs'
        });
      }

      // 1. Verify apartment exists and user is landlord
      const apartment = await db.Apartment.findByPk(apartmentId);
      
      if (!apartment) {
        return res.status(404).json({
          success: false,
          error: 'Apartment not found'
        });
      }

      if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only the landlord can reorder images'
        });
      }

      // 2. Update display order for each image
      const transaction = await db.sequelize.transaction();
      
      try {
        for (let i = 0; i < imageOrder.length; i++) {
          const imageId = imageOrder[i];
          
          await db.ApartmentImage.update(
            { display_order: i },
            {
              where: {
                id: imageId,
                apartment_id: apartmentId
              },
              transaction
            }
          );
        }

        await transaction.commit();
        
        console.log(`✅ Reordered images for apartment ${apartmentId}`);
        
        res.json({
          success: true,
          message: 'Images reordered successfully'
        });
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } catch (error) {
      console.error('❌ Reorder images error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reorder images'
      });
    }
  }

  /**
   * Delete an image
   * DELETE /api/apartments/:id/images/:imageId
   */
  async deleteImage(req, res) {
    try {
      const { id: apartmentId, imageId } = req.params;
      const userId = req.userId;
      
      // 1. Verify apartment exists and user is landlord
      const apartment = await db.Apartment.findByPk(apartmentId);
      
      if (!apartment) {
        return res.status(404).json({
          success: false,
          error: 'Apartment not found'
        });
      }

      if (apartment.landlord_id !== userId && req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only the landlord can delete images'
        });
      }

      // 2. Find the image
      const image = await db.ApartmentImage.findOne({
        where: {
          id: imageId,
          apartment_id: apartmentId,
          status: 'active'
        }
      });

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      const transaction = await db.sequelize.transaction();
      
      try {
        // 3. Soft delete the image
        await image.update(
          { status: 'deleted' },
          { transaction }
        );

        // 4. If this was the primary image, set a new one
        if (image.is_primary) {
          const newPrimary = await db.ApartmentImage.findOne({
            where: {
              apartment_id: apartmentId,
              id: { [db.Sequelize.Op.not]: imageId },
              status: 'active'
            },
            order: [['display_order', 'ASC']],
            transaction
          });

          if (newPrimary) {
            await newPrimary.update(
              { is_primary: true },
              { transaction }
            );
          }
        }

        await transaction.commit();
        
        console.log(`✅ Deleted image ${imageId} from apartment ${apartmentId}`);
        
        res.json({
          success: true,
          message: 'Image deleted successfully'
        });
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    } catch (error) {
      console.error('❌ Delete image error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  }

  /**
   * Process apartment images from frontend
   */
  async processApartmentImages(apartmentId, imagesData, userId) {
    try {
      // imagesData should be an array of image URLs from frontend
      const createdImages = [];
      
      for (let i = 0; i < imagesData.length; i++) {
        const imageData = imagesData[i];
        
        const image = await db.ApartmentImage.create({
          apartment_id: apartmentId,
          image_url: imageData.url || '/images/default-apartment.jpg',
          image_name: imageData.name || `image-${i + 1}`,
          is_primary: i === 0, // First image is primary
          display_order: i,
          uploaded_by: userId,
          status: 'active'
        });

        createdImages.push(image);
      }

      return createdImages;
    } catch (error) {
      console.error('Process images error:', error);
      return [];
    }
  }
}

module.exports = new ImageController();