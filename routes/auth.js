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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// SIGNUP
router.post('/signup', async (req, res, next) => {
  const { full_name, email, password, phone } = req.body;
  if (!full_name || !email || !password || !phone) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const hash = await bcrypt.hash(password.trim(), 10);
    const result = await db.query(
      `INSERT INTO users (full_name, email, password_hash, phone)
       VALUES ($1,$2,$3,$4)
       RETURNING id, full_name, email, phone, role`,
      [full_name.trim(), email.trim(), hash, phone.trim()]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    next(err);
  }
});

// LOGIN (with debug logs)
router.post('/login', async (req, res, next) => {
  const email = (req.body.email || '').trim();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    console.log('LOGIN FAIL: Missing email or password');
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    console.log('LOGIN ATTEMPT:', email);

    const { rows } = await db.query(
      `SELECT id, full_name, email, password_hash, phone, role FROM users WHERE email=$1`,
      [email]
    );

    if (rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = rows[0];
    console.log('User found:', user.email);
    console.log('Comparing password:', password);
    console.log('Against hash:', user.password_hash);

    const match = await bcrypt.compare(password, user.password_hash);
    console.log('Password match result:', match);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const { rows } = await db.query(`SELECT id FROM users WHERE email=$1`, [email.trim()]);
    if (rows.length === 1) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600 * 1000); // 1 hour
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
    res.json({ message: 'If that account exists, an email has been sent.' });
  } catch (err) {
    next(err);
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    const hash = await bcrypt.hash(password.trim(), 10);
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

// PROFILE
router.get('/profile', auth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, full_name, email, phone, role, created_at FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/profile', auth, async (req, res, next) => {
  const { full_name, phone } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Full name and phone are required.' });
  }
  try {
    await db.query(
      `UPDATE users SET full_name=$1, phone=$2 WHERE id=$3`,
      [full_name.trim(), phone.trim(), req.user.id]
    );
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
});

// CHANGE PASSWORD (while logged in)
router.put('/password', auth, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }

  try {
    const { rows } = await db.query(`SELECT password_hash FROM users WHERE id=$1`, [req.user.id]);
    const match = await bcrypt.compare(currentPassword.trim(), rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password incorrect.' });

    const hash = await bcrypt.hash(newPassword.trim(), 10);
    await db.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
