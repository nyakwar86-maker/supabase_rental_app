// src/controllers/user.controller.js
const db = require('../../models');

exports.getProfile = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add stats for landlords
    if (user.role === 'landlord') {
      const apartmentStats = await db.Apartment.count({
        where: { landlord_id: user.id },
        group: ['status']
      });

      user.dataValues.stats = {
        total_listings: await db.Apartment.count({ where: { landlord_id: user.id } }),
        available_listings: await db.Apartment.count({ 
          where: { landlord_id: user.id, status: 'available' }
        })
      };
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, phone, avatar_url } = req.body;
    
    const user = await db.User.findByPk(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({
      full_name: full_name || user.full_name,
      phone: phone || user.phone,
      avatar_url: avatar_url || user.avatar_url
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          avatar_url: user.avatar_url
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    const user = await db.User.findByPk(req.userId);

    // Verify current password
    const isValid = await user.checkPassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

exports.getLandlordStats = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.userId);
    
    if (user.role !== 'landlord') {
      return res.status(403).json({
        success: false,
        error: 'Only landlords can access stats'
      });
    }

    const stats = {
      total_listings: await db.Apartment.count({ where: { landlord_id: user.id } }),
      available_listings: await db.Apartment.count({ 
        where: { landlord_id: user.id, status: 'available' }
      }),
      occupied_listings: await db.Apartment.count({ 
        where: { landlord_id: user.id, status: 'occupied' }
      }),
      // Add more stats as needed
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get landlord stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch landlord stats'
    });
  }
};

// Admin functions
exports.getAllUsers = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { page = 1, limit = 20, role } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;

    const { count, rows: users } = await db.User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

exports.verifyUser = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { id } = req.params;
    const user = await db.User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ is_verified: true });

    res.json({
      success: true,
      message: 'User verified successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          is_verified: true
        }
      }
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user'
    });
  }
};