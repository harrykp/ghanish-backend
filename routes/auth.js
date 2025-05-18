// routes/auth.js
const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const auth = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URLS?.split(',')[0] || process.env.CLIENT_URL; 
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
if (!JWT_SECRET || !EMAIL_USER || !EMAIL_PASS) {
  throw new Error('Missing JWT_SECRET or email credentials in environment');
}

// Configure mailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// Sign up
router.post('/signup', async (req, res, next) => {
  const { email, password, phone } = req.body;
  if (!email || !password || !phone) {
    return res.status(400).json({ error: 'Email, password, and phone are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, phone)
       VALUES ($1,$2,$3) RETURNING id, email, phone, role`,
      [email, hash, phone]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const { rows } = await db.query(
      `SELECT id,email,password_hash,phone,role FROM users WHERE email=$1`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });
    const user = rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const { rows } = await db.query(`SELECT id FROM users WHERE email=$1`, [email]);
    if (rows.length === 1) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600*1000); // 1h
      await db.query(
        `UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE id=$3`,
        [token, expires, rows[0].id]
      );
      const link = `${CLIENT_URL}/reset-password.html?token=${token}`;
      await transporter.sendMail({
        to: email,
        subject: 'Ghanish Password Reset',
        html: `<p>Click <a href="${link}">here</a> to reset your password. Link expires in 1 hour.</p>`
      });
    }
    // Always respond 200 to prevent email enumeration
    res.json({ message: 'If that account exists, an email has been sent.' });
  } catch (err) {
    next(err);
  }
});

// Reset Password
router.post('/reset-password', async (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }
  try {
    const { rows } = await db.query(
      `SELECT id FROM users
       WHERE reset_token=$1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL
       WHERE id=$2`,
      [hash, rows[0].id]
    );
    res.json({ message: 'Password has been reset.' });
  } catch (err) {
    next(err);
  }
});

// Profile: view & edit (requires auth)
router.get('/profile', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id,email,phone,role,created_at FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/profile', auth, async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required.' });
  try {
    await db.query(`UPDATE users SET phone=$1 WHERE id=$2`, [phone, req.user.id]);
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
});

// Change Password while logged in
router.put('/password', auth, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  try {
    const { rows } = await db.query(
      `SELECT password_hash FROM users WHERE id=$1`,
      [req.user.id]
    );
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password incorrect.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
