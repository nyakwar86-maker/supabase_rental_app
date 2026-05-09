// src/controllers/admin.controller.js
const db = require('../models');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalLandlords,
      totalTenants,
      totalApartments,
      availableApartments,
      pendingVerifications,
      totalCommissions,
      pendingCommissions
    ] = await Promise.all([
      db.User.count(),
      db.User.count({ where: { role: 'landlord' } }),
      db.User.count({ where: { role: 'tenant' } }),
      db.Apartment.count(),
      db.Apartment.count({ where: { status: 'available' } }),
      db.Apartment.count({ where: { is_verified: false } }),
      db.CommissionTransaction.sum('amount', { where: { payment_status: 'paid' } }),
      db.CommissionTransaction.sum('amount', { where: { payment_status: 'pending' } })
    ]);

    // Recent activities
    const recentApartments = await db.Apartment.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name']
      }]
    });

    const recentPayments = await db.CommissionTransaction.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name']
      }]
    });

    res.json({
      success: true,
      data: {
        stats: {
          total_users: totalUsers,
          total_landlords: totalLandlords,
          total_tenants: totalTenants,
          total_apartments: totalApartments,
          available_apartments: availableApartments,
          pending_verifications: pendingVerifications,
          total_commissions: totalCommissions || 0,
          pending_commissions: pendingCommissions || 0
        },
        recent_activities: {
          apartments: recentApartments,
          payments: recentPayments
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, verified, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (verified !== undefined) where.is_verified = verified === 'true';
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { full_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

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

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: db.Apartment,
          as: 'apartments',
          attributes: ['id', 'title', 'status', 'rent_amount']
        },
        {
          model: db.CommissionTransaction,
          as: 'commission_transactions',
          attributes: ['id', 'amount', 'payment_status', 'created_at']
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user stats based on role
    let userStats = {};
    if (user.role === 'landlord') {
      userStats = {
        total_listings: user.apartments.length,
        active_listings: user.apartments.filter(a => a.status === 'available').length,
        total_commissions_paid: user.commission_transactions
          .filter(t => t.payment_status === 'paid')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      };
    }

    res.json({
      success: true,
      data: {
        user,
        stats: userStats
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
};

exports.verifyUser = async (req, res) => {
  try {
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
      data: { user: { id: user.id, email: user.email, is_verified: true } }
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user'
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await db.User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ is_active });

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
};

exports.getPendingApartments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: apartments } = await db.Apartment.findAndCountAll({
      where: { is_verified: false },
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'email', 'phone']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        apartments,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get pending apartments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending apartments'
    });
  }
};

exports.verifyApartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const apartment = await db.Apartment.findByPk(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    await apartment.update({
      is_verified: true,
      verified_at: new Date(),
      verified_by: req.userId,
      verification_notes: notes
    });

    res.json({
      success: true,
      message: 'Apartment verified successfully',
      data: { apartment: { id: apartment.id, title: apartment.title, is_verified: true } }
    });
  } catch (error) {
    console.error('Verify apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify apartment'
    });
  }
};

exports.rejectApartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const apartment = await db.Apartment.findByPk(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    // You might want to mark it as rejected or delete it
    await apartment.update({
      status: 'unavailable',
      verification_notes: `Rejected: ${reason}`
    });

    res.json({
      success: true,
      message: 'Apartment rejected successfully'
    });
  } catch (error) {
    console.error('Reject apartment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject apartment'
    });
  }
};

exports.getPendingCommissions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: commissions } = await db.CommissionTransaction.findAndCountAll({
      where: { payment_status: 'pending' },
      include: [
        {
          model: db.User,
          as: 'landlord',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: db.Apartment,
          as: 'apartment',
          attributes: ['id', 'title']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        commissions,
        total_pending_amount: commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0),
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get pending commissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending commissions'
    });
  }
};

exports.getCommissionsOverview = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const where = { payment_status: 'paid' };
    if (start_date || end_date) {
      where.paid_at = {};
      if (start_date) where.paid_at[Op.gte] = new Date(start_date);
      if (end_date) where.paid_at[Op.lte] = new Date(end_date);
    }

    // Get commission summary
    const summary = await db.CommissionTransaction.findAll({
      where,
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_amount'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'transaction_count'],
        [Sequelize.fn('DATE', Sequelize.col('paid_at')), 'date']
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('paid_at'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('paid_at')), 'DESC']],
      limit: 30
    });

    // Get top landlords
    const topLandlords = await db.CommissionTransaction.findAll({
      where,
      attributes: [
        'landlord_id',
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_paid']
      ],
      include: [{
        model: db.User,
        as: 'landlord',
        attributes: ['id', 'full_name', 'email']
      }],
      group: ['landlord_id', 'landlord.id'],
      order: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        summary,
        top_landlords: topLandlords
      }
    });
  } catch (error) {
    console.error('Get commissions overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commissions overview'
    });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetDate = new Date(year || new Date().getFullYear(), month ? month - 1 : new Date().getMonth(), 1);
    const nextMonth = new Date(targetDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const where = {
      payment_status: 'paid',
      paid_at: {
        [Op.gte]: targetDate,
        [Op.lt]: nextMonth
      }
    };

    // Monthly summary
    const monthlySummary = await db.CommissionTransaction.findOne({
      where,
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_revenue'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_transactions'],
        [Sequelize.literal('AVG(amount)'), 'average_commission']
      ]
    });

    // Daily breakdown
    const dailyBreakdown = await db.CommissionTransaction.findAll({
      where,
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('paid_at')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactions'],
        [Sequelize.fn('SUM', Sequelize.col('amount')), 'amount']
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('paid_at'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('paid_at')), 'ASC']]
    });

    // New users this month
    const newUsers = await db.User.count({
      where: {
        created_at: {
          [Op.gte]: targetDate,
          [Op.lt]: nextMonth
        }
      }
    });

    // New apartments this month
    const newApartments = await db.Apartment.count({
      where: {
        created_at: {
          [Op.gte]: targetDate,
          [Op.lt]: nextMonth
        }
      }
    });

    res.json({
      success: true,
      data: {
        period: {
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
          month_name: targetDate.toLocaleString('default', { month: 'long' })
        },
        summary: {
          total_revenue: monthlySummary.dataValues.total_revenue || 0,
          total_transactions: monthlySummary.dataValues.total_transactions || 0,
          average_commission: monthlySummary.dataValues.average_commission || 0,
          new_users: newUsers,
          new_apartments: newApartments
        },
        daily_breakdown: dailyBreakdown
      }
    });
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate monthly report'
    });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const { format = 'json', start_date, end_date } = req.query;
    
    const where = {};
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    const data = await db.CommissionTransaction.findAll({
      where,
      include: [
        {
          model: db.User,
          as: 'landlord',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: db.Apartment,
          as: 'apartment',
          attributes: ['id', 'title', 'rent_amount']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = data.map(t => ({
        TransactionID: t.id,
        Date: t.created_at,
        Landlord: t.landlord?.full_name,
        Apartment: t.apartment?.title,
        Amount: t.amount,
        Status: t.payment_status,
        PaidAt: t.paid_at
      }));

      // In real implementation, you'd use a CSV library
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=commissions_report.csv');
      // Write CSV headers and data
      // ... CSV generation logic ...
      
      res.json({
        success: true,
        message: 'CSV export would be generated here'
      });
    } else {
      res.json({
        success: true,
        data
      });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report'
    });
  }
};