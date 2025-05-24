const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();
router.use(auth, adminOnly);

// === Get all users (paginated) ===
router.get('/', async (req, res, next) => {
  try {
    let { page, limit } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    if (!isNaN(page) && !isNaN(limit)) {
      const offset = (page - 1) * limit;
      const result = await db.query(`
        SELECT id, full_name, email, phone, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const countRes = await db.query('SELECT COUNT(*) FROM users');
      return res.json({
        total: parseInt(countRes.rows[0].count),
        users: result.rows
      });
    } else {
      const result = await db.query(`
        SELECT id, full_name, email, phone, role, created_at
        FROM users
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    }
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    next(err);
  }
});

// === Create a new user ===
router.post('/', async (req, res, next) => {
  const { full_name, email, phone, password, role } = req.body;
  if (!full_name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(`
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, full_name, email, phone, role, created_at
    `, [full_name, email, phone, hash, role || 'customer']);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creating user:', err);
    next(err);
  }
});

// === Update user info ===
router.put('/:id', async (req, res, next) => {
  const { full_name, email, phone, role } = req.body;

  try {
    await db.query(`
      UPDATE users SET full_name=$1, email=$2, phone=$3, role=$4 WHERE id=$5
    `, [full_name, email, phone, role, req.params.id]);

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('❌ Error updating user:', err);
    next(err);
  }
});

// === Delete user ===
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    next(err);
  }
});

// === Reset user password ===
router.post('/:id/reset-password', async (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('❌ Error resetting password:', err);
    next(err);
  }
});

module.exports = router;
