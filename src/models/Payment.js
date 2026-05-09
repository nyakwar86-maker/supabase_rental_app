
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    commission_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 5.00
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
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
    payment_gateway: {
      type: DataTypes.ENUM('stripe', 'paypal', 'flutterwave', 'paystack', 'manual'),
      allowNull: true
    },
    gateway_response: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refunded_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'payments',
    timestamps: true
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.RentalOffer, {
      foreignKey: 'rental_offer_id',
      as: 'rental_offer'
    });
    Payment.belongsTo(models.User, {
      foreignKey: 'landlord_id',
      as: 'landlord'
    });
    Payment.belongsTo(models.Apartment, {
      foreignKey: 'apartment_id',
      as: 'apartment'
    });
  };

  return Payment;
};
