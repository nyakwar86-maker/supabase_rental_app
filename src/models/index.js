
// src/models/index.js
const { sequelize } = require('../config/database');

// Import all models
const User = require('./User')(sequelize);
const Apartment = require('./Apartment')(sequelize);
const Conversation = require('./Conversation')(sequelize);
const Message = require('./Message')(sequelize);
const RentalOffer = require('./RentalOffer')(sequelize);
const ApartmentImage = require('./ApartmentImage')(sequelize); // ADD THIS

// Set up associations
User.hasMany(Apartment, {
  foreignKey: 'landlord_id',
  as: 'apartments'
});

Apartment.belongsTo(User, {
  foreignKey: 'landlord_id',
  as: 'landlord'
});

// Conversation associations
Conversation.belongsTo(User, {
  foreignKey: 'tenant_id',
  as: 'tenant'
});

Conversation.belongsTo(User, {
  foreignKey: 'landlord_id',
  as: 'landlord'
});

Conversation.belongsTo(Apartment, {
  foreignKey: 'apartment_id',
  as: 'apartment'
});

Conversation.hasMany(Message, {
  foreignKey: 'conversation_id',
  as: 'messages'
});

Conversation.hasMany(RentalOffer, {
  foreignKey: 'conversation_id',
  as: 'offers'
});

// Message associations
Message.belongsTo(Conversation, {
  foreignKey: 'conversation_id',
  as: 'conversation'
});

Message.belongsTo(User, {
  foreignKey: 'sender_id',
  as: 'sender'
});

// RentalOffer associations
RentalOffer.belongsTo(Conversation, {
  foreignKey: 'conversation_id',
  as: 'conversation'
});

RentalOffer.belongsTo(Apartment, {
  foreignKey: 'apartment_id',
  as: 'apartment'
});

RentalOffer.belongsTo(User, {
  foreignKey: 'landlord_id',
  as: 'landlord'
});

RentalOffer.belongsTo(User, {
  foreignKey: 'tenant_id',
  as: 'tenant'
});

// ApartmentImage associations
Apartment.hasMany(ApartmentImage, {
  foreignKey: 'apartment_id',
  as: 'images',
  onDelete: 'CASCADE'
});

ApartmentImage.belongsTo(Apartment, {
  foreignKey: 'apartment_id',
  as: 'apartment'
});

ApartmentImage.belongsTo(User, {
  foreignKey: 'uploaded_by',
  as: 'uploader'
});

// Export all models
module.exports = {
  sequelize,
  User,
  Apartment,
  Conversation,
  Message,
  RentalOffer,
  ApartmentImage 
};
