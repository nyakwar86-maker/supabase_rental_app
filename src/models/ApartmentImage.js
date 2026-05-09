const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ApartmentImage = sequelize.define('ApartmentImage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    apartment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'apartments',
        key: 'id'
      }
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    image_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    image_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Size in bytes'
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'image/jpeg'
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'deleted', 'pending'),
      defaultValue: 'active'
    }
  }, {
    tableName: 'apartment_images',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['apartment_id', 'is_primary']
      },
      {
        fields: ['apartment_id', 'display_order']
      },
      {
        fields: ['status']
      }
    ]
  });

  ApartmentImage.associate = (models) => {
    ApartmentImage.belongsTo(models.Apartment, {
      foreignKey: 'apartment_id',
      as: 'apartment'
    });
    ApartmentImage.belongsTo(models.User, {
      foreignKey: 'uploaded_by',
      as: 'uploader'
    });
  };

  return ApartmentImage;
};