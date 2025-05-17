// routes/auth.js
const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET in environment');

// POST /api/auth/signup
// { email, password, phone }
router.post('/signup', async (req, res, next) => {
  const { email, password, phone } = req.body;
  if (!email || !password || !phone) {
    return res.status(400).json({ error: 'Email, password, and phone are required.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, phone)
       VALUES ($1, $2, $3)
       RETURNING id, email, phone, role`,
      [email, hash, phone]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    next(err);
  }
});

// POST /api/auth/login
// { email, password }
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, phone, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and user info including phone
    res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
