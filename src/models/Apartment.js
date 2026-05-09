
const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Apartment = sequelize.define('Apartment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [5, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    neighborhood: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    rent_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    security_deposit: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    utilities_included: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    service_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    bedrooms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    bathrooms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    square_feet: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    amenities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'unavailable'),
      defaultValue: 'available'
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'apartments',
    timestamps: true
  });

// Add associations
Apartment.associate = (models) => {
  Apartment.belongsTo(models.User, {
    foreignKey: 'landlord_id',
    as: 'landlord'
  });
  
  Apartment.hasMany(models.Conversation, {
    foreignKey: 'apartment_id',
    as: 'conversations'
  });
  
  // THIS LINE for images
  Apartment.hasMany(models.ApartmentImage, {
    foreignKey: 'apartment_id',
    as: 'images',
    onDelete: 'CASCADE'
  });
};

  return Apartment;
};
