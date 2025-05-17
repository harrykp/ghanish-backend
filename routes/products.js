// routes/products.js
const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/products — list all products
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id — get single product
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/products — create a new product
router.post('/', async (req, res, next) => {
  const { name, description, price, image_url, stock } = req.body;
  if (!name || !description || price == null || stock == null) {
    return res.status(400).json({ error: 'Name, description, price, and stock are required.' });
  }
  try {
    const queryText = `
      INSERT INTO products (name, description, price, image_url, stock, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *;
    `;
    const result = await db.query(queryText, [name, description, price, image_url || null, stock]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — update a product
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { name, description, price, image_url, stock } = req.body;
  try {
    const queryText = `
      UPDATE products SET
        name = $1,
        description = $2,
        price = $3,
        image_url = $4,
        stock = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await db.query(queryText, [name, description, price, image_url || null, stock, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id — remove a product
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
