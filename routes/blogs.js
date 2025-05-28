// routes/blogs.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();

// PUBLIC: Get all blogs
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`SELECT * FROM blogs ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PUBLIC: Get one blog by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`SELECT * FROM blogs WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Blog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ADMIN: Create new blog
router.post('/', auth, adminOnly, async (req, res, next) => {
  try {
    const { title, slug, content, image_url } = req.body;
    const result = await db.query(`
      INSERT INTO blogs (title, slug, content, image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, slug, content, image_url]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ADMIN: Update blog
router.put('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { title, slug, content, image_url } = req.body;
    const result = await db.query(`
      UPDATE blogs SET
        title = $1,
        slug = $2,
        content = $3,
        image_url = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [title, slug, content, image_url, req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Blog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ADMIN: Delete blog
router.delete('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const result = await db.query(`DELETE FROM blogs WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
