// routes/analytics.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();

// Protect all routes with JWT and require admin access
router.use(auth, adminOnly);

/**
 * GET /api/admin/revenue
 * Returns monthly revenue for the past 12 months.
 */
router.get('/revenue', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        SUM(total)::numeric(10, 2) AS revenue
      FROM orders
      WHERE created_at >= (CURRENT_DATE - INTERVAL '1 year')
      GROUP BY 1
      ORDER BY 1
    `);

    const labels = result.rows.map(row => row.month);
    const values = result.rows.map(row => parseFloat(row.revenue));

    res.json({ labels, values });
  } catch (err) {
    console.error('Error fetching revenue:', err);
    res.status(500).json({ error: 'Failed to load revenue analytics' });
  }
});

module.exports = router;
