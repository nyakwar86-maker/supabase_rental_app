

// models/RentalOffer.js - UPDATED VERSION
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RentalOffer = sequelize.define('RentalOffer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id'
      }
    },
    apartment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'apartments',
        key: 'id'
      }
    },
    landlord_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    offered_rent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    commission_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    commission_paid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    commission_paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING(50), 
      allowNull: true
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    stripe_charge_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    receipt_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired', 'withdrawn', 'cancelled'),
      defaultValue: 'pending'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'rental_offers',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        fields: ['conversation_id', 'status']
      },
      {
        fields: ['landlord_id', 'status']
      },
      {
        fields: ['tenant_id', 'status']
      },
      {
        fields: ['expires_at']
      }
    ]
  });

  RentalOffer.associate = (models) => {
    RentalOffer.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation'
    });
    RentalOffer.belongsTo(models.Apartment, {
      foreignKey: 'apartment_id',
      as: 'apartment'
    });
    RentalOffer.belongsTo(models.User, {
      foreignKey: 'landlord_id',
      as: 'landlord'
    });
    RentalOffer.belongsTo(models.User, {
      foreignKey: 'tenant_id',
      as: 'tenant'
    });
  };

  return RentalOffer;
};
