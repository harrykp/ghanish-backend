const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();

router.use(auth, adminOnly);

// GET /api/discounts — List all discount codes
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, code, percent_off, expires_at, created_at
      FROM discounts
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/discounts — Create new discount code
router.post('/', async (req, res, next) => {
  const { code, percent_off, expires_at } = req.body;
  if (!code || !percent_off) return res.status(400).json({ error: 'Code and percent_off required' });

  try {
    const exists = await db.query('SELECT 1 FROM discounts WHERE code = $1', [code]);
    if (exists.rows.length) return res.status(400).json({ error: 'Code already exists' });

    await db.query(`
      INSERT INTO discounts (code, percent_off, expires_at)
      VALUES ($1, $2, $3)
    `, [code.trim().toUpperCase(), percent_off, expires_at || null]);

    res.status(201).json({ message: 'Discount code created' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/discounts/:id — Delete discount code
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM discounts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
