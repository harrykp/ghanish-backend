// routes/publicBlogs.js

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/public/blogs — list all blogs (optional ?category=)
router.get('/', async (req, res, next) => {
  const { category } = req.query;
  try {
    const result = category
      ? await db.query(`SELECT id, title, slug, category, image_url, created_at FROM blogs WHERE category = $1 ORDER BY created_at DESC`, [category])
      : await db.query(`SELECT id, title, slug, category, image_url, created_at FROM blogs ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/blogs/slug/:slug — get blog by slug
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const result = await db.query(`SELECT * FROM blogs WHERE slug = $1`, [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Blog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
