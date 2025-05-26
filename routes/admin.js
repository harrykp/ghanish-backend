// routes/admin.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();

// Require authentication and admin rights for all routes
router.use(auth, adminOnly);

/**
 * GET /api/admin/stats — returns total dashboard stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const totalOrdersRes = await db.query('SELECT COUNT(*) FROM orders');
    const totalRevenueRes = await db.query('SELECT SUM(total) FROM orders');
    const totalUsersRes = await db.query('SELECT COUNT(*) FROM users');
    const totalProductsRes = await db.query('SELECT COUNT(*) FROM products');

    res.json({
      stats: {
        totalOrders: parseInt(totalOrdersRes.rows[0].count),
        totalRevenue: parseFloat(totalRevenueRes.rows[0].sum || 0),
        totalUsers: parseInt(totalUsersRes.rows[0].count),
        totalProducts: parseInt(totalProductsRes.rows[0].count)
      }
    });
  } catch (err) {
    console.error('❌ Error fetching admin stats:', err);
    next(err);
  }
});

/**
 * GET /api/admin/revenue — returns monthly revenue
 */
router.get('/revenue', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, SUM(total) AS total
      FROM orders
      GROUP BY month
      ORDER BY month
    `);

    const labels = result.rows.map(r => r.month);
    const values = result.rows.map(r => parseFloat(r.total));
    res.json({ labels, values });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/analytics — returns top products & order trends
 */
router.get('/analytics', async (req, res, next) => {
  try {
    // Top Selling Products
    const topProductsRes = await db.query(`
      SELECT p.name, SUM(oi.quantity) AS units_sold
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.name
      ORDER BY units_sold DESC
      LIMIT 5
    `);

    const topProducts = {
      labels: topProductsRes.rows.map(r => r.name),
      values: topProductsRes.rows.map(r => parseInt(r.units_sold))
    };

    // Order Trends (count per month)
    const trendsRes = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS orders
      FROM orders
      GROUP BY month
      ORDER BY month
    `);

    const orderTrends = {
      labels: trendsRes.rows.map(r => r.month),
      values: trendsRes.rows.map(r => parseInt(r.orders))
    };

    res.json({ topProducts, orderTrends });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
