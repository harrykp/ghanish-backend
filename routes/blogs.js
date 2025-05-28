// routes/blogs.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(auth, adminOnly);

// GET /api/blogs — all blogs (with optional ?category=)
router.get('/', async (req, res, next) => {
  const { category } = req.query;
  try {
    const result = category
      ? await db.query(`SELECT * FROM blogs WHERE category = $1 ORDER BY created_at DESC`, [category])
      : await db.query(`SELECT * FROM blogs ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/blogs — create blog
router.post('/', async (req, res, next) => {
  const { title, content, category, image_url } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });

  try {
    await db.query(`
      INSERT INTO blogs (title, content, category, image_url)
      VALUES ($1, $2, $3, $4)
    `, [title, content, category || null, image_url || null]);

    res.status(201).json({ message: 'Blog created' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/blogs/:id — update blog
router.put('/:id', async (req, res, next) => {
  const { title, content, category, image_url } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });

  try {
    const result = await db.query(`
      UPDATE blogs
      SET title = $1, content = $2, category = $3, image_url = $4
      WHERE id = $5
    `, [title, content, category || null, image_url || null, req.params.id]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Blog not found' });
    res.json({ message: 'Blog updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/blogs/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`DELETE FROM blogs WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Blog not found' });
    res.json({ message: 'Blog deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
