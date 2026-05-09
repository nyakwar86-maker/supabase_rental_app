const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommissionTransaction = sequelize.define('CommissionTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rental_offer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'rental_offers',
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
    apartment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'apartments',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 5.00
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    payment_details: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'commission_transactions',
    timestamps: true
  });

  CommissionTransaction.associate = (models) => {
    CommissionTransaction.belongsTo(models.RentalOffer, {
      foreignKey: 'rental_offer_id',
      as: 'rental_offer'
    });
    CommissionTransaction.belongsTo(models.User, {
      foreignKey: 'landlord_id',
      as: 'landlord'
    });
    CommissionTransaction.belongsTo(models.Apartment, {
      foreignKey: 'apartment_id',
      as: 'apartment'
    });
  };

  return CommissionTransaction;
};
