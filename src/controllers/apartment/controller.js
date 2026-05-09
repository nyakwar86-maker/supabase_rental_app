

const db = require('../../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

// Get all apartments with basic filters
exports.getAllApartments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      city,
      minRent,
      maxRent,
      bedrooms,
      status = 'available'
    } = req.query;
    const where = { status };
    if (city) where.city = city;

    // Handle price range
    if (minRent || maxRent) {
      where.rent_amount = {};
      if (minRent) where.rent_amount[Op.gte] = parseFloat(minRent);
      if (maxRent) where.rent_amount[Op.lte] = parseFloat(maxRent);
    }

    if (bedrooms) where.bedrooms = bedrooms;
    const offset = (page - 1) * limit;
    const { count, rows: apartments } = await db.Apartment.findAndCountAll({
      where,
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });
    res.json({
      success: true,
      data: {
        apartments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get apartments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch apartments',
      message: error.message
    });
  }
};

// Advanced search with multiple filters
exports.searchApartments = async (req, res) => {
  try {
    const {
      city,
      neighborhood,
      apartmentType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      minSquareFeet,
      status = 'available',
      amenities,
      is_verified,
      has_parking,
      has_pool,
      has_gym,
      pets_allowed,
      search,
      page = 1,
      limit = 20
    } = req.query;
    let where = { status };

    // Text search
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { address: { [Op.iLike]: `%${search}%` } },
        { neighborhood: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Location filters
    if (city) where.city = city;
    if (neighborhood) where.neighborhood = neighborhood;

    // Price range
    if (minPrice || maxPrice) {
      where.rent_amount = {};
      if (minPrice) where.rent_amount[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.rent_amount[Op.lte] = parseFloat(maxPrice);
    }

    // Apartment type filter
    if (apartmentType) {
      if (apartmentType === 'Studio') {
        where.bedrooms = 0;
      } else if (apartmentType === '1 Bedroom') {
        where.bedrooms = 1;
      } else if (apartmentType === '2 Bedrooms') {
        where.bedrooms = 2;
      } else if (apartmentType === '3 Bedrooms') {
        where.bedrooms = 3;
      } else if (apartmentType === '4+ Bedrooms') {
        where.bedrooms = { [Op.gte]: 4 };
      }
    } else if (bedrooms) {
      where.bedrooms = { [Op.gte]: parseInt(bedrooms) };
    }

    // Other filters
    if (bathrooms) where.bathrooms = { [Op.gte]: parseInt(bathrooms) };
    if (minSquareFeet) where.square_feet = { [Op.gte]: parseInt(minSquareFeet) };

    // Boolean filters
    if (is_verified === 'true') where.is_verified = true;
    if (has_parking === 'true') where['features.parking'] = true;
    if (has_pool === 'true') where['features.pool'] = true;
    if (has_gym === 'true') where['features.gym'] = true;
    if (pets_allowed === 'true') where['features.pets_allowed'] = true;

    // Amenities filter (multiple)
    if (amenities) {
      const amenityList = amenities.split(',');
      where.amenities = { [Op.contains]: amenityList };
    }

    const offset = (page - 1) * limit;
    const { count, rows: apartments } = await db.Apartment.findAndCountAll({
      where,
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        apartments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit),
          hasMore: page * limit < count
        }
      }
    });
  } catch (error) {
    console.error('Search apartments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search apartments',
      message: error.message
    });
  }
};

// Get available filters
exports.getAvailableFilters = async (req, res) => {
  try {
    // Get distinct cities
    const cities = await db.Apartment.findAll({
      attributes: [
        [Sequelize.fn('DISTINCT', Sequelize.col('city')), 'city']
      ],
      where: { status: 'available' },
      order: [['city', 'ASC']],
      raw: true
    });

    // Get neighborhoods with counts
    const neighborhoods = await db.Apartment.findAll({
      attributes: [
        'city',
        'neighborhood',
        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
      ],
      where: {
        status: 'available',
        neighborhood: { [Op.ne]: null, [Op.ne]: '' }
      },
      group: ['city', 'neighborhood'],
      order: [['city', 'ASC'], ['neighborhood', 'ASC']],
      raw: true
    });

    // Get popular amenities
    const amenities = await db.Apartment.findAll({
      attributes: [
        [Sequelize.fn('UNNEST', Sequelize.col('amenities')), 'amenity'],
        [Sequelize.fn('COUNT', Sequelize.col('*')), 'count']
      ],
      where: { status: 'available' },
      group: ['amenity'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 20,
      raw: true
    });

    res.json({
      success: true,
      data: {
        cities: cities.map(c => c.city).filter(c => c),
        neighborhoods,
        amenities: amenities.map(a => a.amenity).filter(a => a)
      }
    });
  } catch (error) {
    console.error('Get available filters error:', error);

    // Return default filters on error
    res.json({
      success: true,
      data: {
        cities: [],
        neighborhoods: [],
        amenities: []
      }
    });
  }
};

// Get single apartment by ID
exports.getApartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const apartment = await db.Apartment.findByPk(id, {
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url', 'phone']
      }]
    });

    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    const isOwner = req.userId && (apartment.landlord_id === req.userId || req.userRole === 'admin');

    res.json({
      success: true,
      data:
      {
        apartment,
         isOwner,
        canEdit: isOwner // You can add more logic here for editing permissions
      }
    });
  } catch (error) {
    console.error('Get apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch apartment'
    });
  }
};

// Create new apartment
exports.createApartment = async (req, res) => {
  try {
    const {
      title,
      description,
      address,
      city,
      neighborhood,
      latitude,
      longitude,
      rent_amount,
      security_deposit,
      utilities_included,
      service_fee,
      bedrooms,
      bathrooms,
      square_feet,
      amenities,
      apartment_type,
      features
    } = req.body;

    // Verify user is landlord
    if (req.userRole !== 'landlord' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only landlords can create apartments'
      });
    }

    // Handle amenities
    let amenitiesArray = [];
    if (amenities) {
      if (Array.isArray(amenities)) {
        amenitiesArray = amenities;
      } else if (typeof amenities === 'string') {
        amenitiesArray = amenities.split(',').map(a => a.trim()).filter(a => a);
      }
    }

    // Handle features
    const featuresObj = {};
    if (features) {
      if (typeof features === 'object') {
        Object.assign(featuresObj, features);
      } else if (typeof features === 'string') {
        try {
          Object.assign(featuresObj, JSON.parse(features));
        } catch (e) {
          console.warn('Could not parse features JSON:', e);
        }
      }
    }

    const apartment = await db.Apartment.create({
      title,
      description,
      address,
      city,
      neighborhood,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      rent_amount: parseFloat(rent_amount),
      security_deposit: security_deposit ? parseFloat(security_deposit) : 0,
      utilities_included: utilities_included || false,
      service_fee: service_fee ? parseFloat(service_fee) : 0,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseInt(bathrooms) : null,
      square_feet: square_feet ? parseInt(square_feet) : null,
      amenities: amenitiesArray,
      apartment_type: apartment_type || '1 Bedroom',
      features: featuresObj,
      landlord_id: req.userId,
      is_verified: req.userRole === 'admin'
    });

    res.status(201).json({
      success: true,
      message: 'Apartment created successfully',
      data: { apartment }
    });
  } catch (error) {
    console.error('Create apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create apartment',
      message: error.message
    });
  }
};

// Edit Apartment Page Route Handler
exports.editApartmentPage = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user is authenticated
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const apartment = await db.Apartment.findByPk(id, {
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url', 'phone']
      }]
    });

    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    // Check ownership (unless admin)
    if (apartment.landlord_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit this apartment'
      });
    }

    // Get apartment images
    const images = await db.ApartmentImage.findAll({
      where: {
        apartment_id: id,
        status: 'active'
      },
      order: [
        ['is_primary', 'DESC'],
        ['display_order', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: {
        apartment,
        images,
        isOwner: apartment.landlord_id === req.userId,
        isAdmin: req.userRole === 'admin'
      }
    });
  } catch (error) {
    console.error('Edit apartment page error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load edit page',
      message: error.message
    });
  }
};

// Enhanced update apartment with images
exports.updateApartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const files = req.files || [];

    const apartment = await db.Apartment.findByPk(id);

    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    // Check ownership
    if (apartment.landlord_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this apartment'
      });
    }


    // Handle amenities
    if (updates.amenities) {
      if (Array.isArray(updates.amenities)) {
        updates.amenities = updates.amenities;
      } else if (typeof updates.amenities === 'string') {
        updates.amenities = updates.amenities.split(',').map(a => a.trim()).filter(a => a);
      }
    }

    // Handle features
    if (updates.features) {
      if (typeof updates.features === 'string') {
        try {
          updates.features = JSON.parse(updates.features);
        } catch (e) {
          console.warn('Could not parse features JSON:', e);
        }
      }
    }

    // Handle image deletions if provided
    if (updates.deleted_images && Array.isArray(updates.deleted_images)) {
      for (const imageId of updates.deleted_images) {
        const image = await db.ApartmentImage.findOne({
          where: {
            id: imageId,
            apartment_id: id
          }
        });

        if (image) {
          await image.update({ status: 'deleted' });

          // If this was primary, set a new primary
          if (image.is_primary) {
            const newPrimary = await db.ApartmentImage.findOne({
              where: {
                apartment_id: id,
                status: 'active',
                id: { [db.Sequelize.Op.not]: imageId }
              },
              order: [['display_order', 'ASC']]
            });

            if (newPrimary) {
              await newPrimary.update({ is_primary: true });
            }
          }
        }
      }
    }

    // Handle image reordering if provided
    if (updates.image_order && Array.isArray(updates.image_order)) {
      for (let i = 0; i < updates.image_order.length; i++) {
        const imageId = updates.image_order[i];
        await db.ApartmentImage.update(
          { display_order: i },
          {
            where: {
              id: imageId,
              apartment_id: id
            }
          }
        );
      }
    }

    // Update primary image if provided
    if (updates.primary_image_id) {
      const transaction = await db.sequelize.transaction();
      try {
        // Remove primary status from all other images
        await db.ApartmentImage.update(
          { is_primary: false },
          {
            where: {
              apartment_id: id,
              is_primary: true
            },
            transaction
          }
        );

        // Set new primary image
        await db.ApartmentImage.update(
          { is_primary: true },
          {
            where: {
              id: updates.primary_image_id,
              apartment_id: id
            },
            transaction
          }
        );

        await transaction.commit();
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    }

    // Update apartment details
    await apartment.update(updates);

    // Get updated apartment with images
    const updatedApartment = await db.Apartment.findByPk(id, {
      include: [
        {
          model: db.User,
          as: 'landlord',
          attributes: ['id', 'full_name', 'avatar_url', 'email']
        },
        {
          model: db.ApartmentImage,
          as: 'images',
          where: { status: 'active' },
          required: false,
          attributes: ['id', 'image_url', 'is_primary', 'display_order']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Apartment updated successfully',
      data: { apartment: updatedApartment }
    });
  } catch (error) {
    console.error('Update apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update apartment',
      message: error.message
    });
  }
};

// Delete apartment
exports.deleteApartment = async (req, res) => {
  try {
    const { id } = req.params;
    const apartment = await db.Apartment.findByPk(id);

    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    // Check ownership
    if (apartment.landlord_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this apartment'
      });
    }

    await apartment.destroy();

    res.json({
      success: true,
      message: 'Apartment deleted successfully'
    });
  } catch (error) {
    console.error('Delete apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete apartment'
    });
  }
};

// Get landlord's own apartments 
// exports.getMyApartments = async (req, res) => {
//   try {
//     if (req.userRole !== 'landlord') {
//       return res.status(403).json({
//         success: false,
//         error: 'Only landlords can access their apartments'
//       });
//     }

//     const { page = 1, limit = 20, status } = req.query;
//     const where = { landlord_id: req.userId };

//     if (status) where.status = status;

//     const offset = (page - 1) * limit;

//     const { count, rows: apartments } = await db.Apartment.findAndCountAll({
//       where,
//       include: [{
//         model: db.ApartmentImage,
//         as: 'images',
//         where: { status: 'active', is_primary: true },
//         required: false,
//         attributes: ['id', 'image_url']
//       }],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       order: [['created_at', 'DESC']]
//     });

//     res.json({
//       success: true,
//       data: {
//         apartments,
//         pagination: {
//           total: count,
//           page: parseInt(page),
//           pages: Math.ceil(count / limit),
//           limit: parseInt(limit)
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Get my apartments error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch your apartments',
//       message: error.message
//     });
//   }
// };

// Get landlord's own apartments
exports.getMyApartments = async (req, res) => {
  try {
    // Check if user is a landlord
    if (req.userRole !== 'landlord' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only landlords can access their apartments'
      });
    }

    const { page = 1, limit = 20, status, search } = req.query;
    const where = { landlord_id: req.userId };

    if (status) where.status = status;

    // Add search functionality
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { address: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { neighborhood: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: apartments } = await db.Apartment.findAndCountAll({
      where,
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        apartments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get my apartments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your apartments',
      message: error.message
    });
  }
};

// Search nearby apartments by location
exports.getNearbyApartments = async (req, res) => {
  try {
    const { lat, lng, radius = 5, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Convert radius from km to degrees (approx)
    const radiusInDegrees = radius / 111;
    const apartments = await db.Apartment.findAll({
      where: {
        latitude: {
          [Op.between]: [parseFloat(lat) - radiusInDegrees, parseFloat(lat) + radiusInDegrees]
        },
        longitude: {
          [Op.between]: [parseFloat(lng) - radiusInDegrees, parseFloat(lng) + radiusInDegrees]
        },
        status: 'available'
      },
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'avatar_url']
      }],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: { apartments }
    });
  } catch (error) {
    console.error('Nearby apartments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby apartments'
    });
  }
};