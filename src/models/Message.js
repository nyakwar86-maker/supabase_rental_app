
// src/models/Message.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
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
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    message_type: {
      type: DataTypes.ENUM('text', 'location_pin', 'offer', 'acceptance', 'image'),
      defaultValue: 'text'
    },
    location_data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, 
    {
    tableName: 'messages',
    timestamps: false, // IMPORTANT: Disable Sequelize auto timestamps
    createdAt: 'created_at', // Map created_at to this column
    updatedAt: false, // Don't use updated_at
    indexes: [
      {
        fields: ['conversation_id', 'created_at']
      }
    ]
  });

  return Message;
};
