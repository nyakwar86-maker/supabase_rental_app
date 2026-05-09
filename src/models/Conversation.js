// src/models/Conversation.js - ADAPT TO EXISTING SCHEMA
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    landlord_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    apartment_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active'
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
    // NO updated_at column since you don't have it
  }, {
    tableName: 'conversations',
    timestamps: false, // IMPORTANT: Disable Sequelize auto timestamps
    createdAt: 'created_at', // Map created_at to this column
    updatedAt: false, // Don't use updated_at
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'landlord_id', 'apartment_id']
      }
    ]
  });

  return Conversation;
};
