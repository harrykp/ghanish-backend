// routes/products.js
const express = require('express');
const db = require('../db');
const router = express.Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// GET /api/products
router.get('/', async (req, res, next) => {
  const { category } = req.query;
  try {
    const query = category
      ? db.query('SELECT * FROM products WHERE category=$1 ORDER BY created_at DESC', [category])
      : db.query('SELECT * FROM products ORDER BY created_at DESC');
    const result = await query;
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});


// Create a new product (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO products (name, description, price, stock, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description, price, stock, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update an existing product (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;
  try {
    const result = await db.query(
      `UPDATE products
       SET name = $1, description = $2, price = $3, stock = $4, image_url = $5
       WHERE id = $6
       RETURNING *`,
      [name, description, price, stock, image_url, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete a product (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
