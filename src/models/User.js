const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 100]
      }
    },
    role: {
      type: DataTypes.ENUM('tenant', 'landlord', 'admin'),
      allowNull: false,
      defaultValue: 'tenant'
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    avatar_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  // src/models/User.js - Add associations
  User.associate = (models) => {
    // Landlord has many apartments
    User.hasMany(models.Apartment, {
      foreignKey: 'landlord_id',
      as: 'apartments'
    });

    // Tenant has many conversations
    User.hasMany(models.Conversation, {
      foreignKey: 'tenant_id',
      as: 'tenant_conversations'
    });

    // Landlord has many conversations
    User.hasMany(models.Conversation, {
      foreignKey: 'landlord_id',
      as: 'landlord_conversations'
    });
  };

  // Instance method to check password
  User.prototype.checkPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
  };

  return User;
};
