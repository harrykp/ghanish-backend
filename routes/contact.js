// routes/contact.js
const express = require('express');
const db = require('../db');
const nodemailer = require('nodemailer');
const router = express.Router();

// POST /api/contact
router.post('/', async (req, res, next) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  try {
    // 1) Insert into PostgreSQL
    const queryText = `
      INSERT INTO contact_messages
        (name, email, phone, message, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id;
    `;
    await db.query(queryText, [name, email, phone || null, message]);

    // 2) Send notification email (if configured)
    if (
      process.env.EMAIL_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS &&
      process.env.EMAIL_TO
    ) {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subject: 'New Contact Request from Ghanish Website',
        text: `
Name: ${name}
Email: ${email}
Phone: ${phone || 'N/A'}

Message:
${message}
        `.trim()
      });
    }

    return res.json({ message: 'Your message has been received.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
