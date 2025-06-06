// routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// GET /api/products
// Optionally filter by category: /api/products?category=Fish
router.get('/', async (req, res) => {
  const { category } = req.query;
  try {
    const query = category
      ? db.query('SELECT * FROM products WHERE category = $1 ORDER BY created_at DESC', [category])
      : db.query('SELECT * FROM products ORDER BY created_at DESC');
    const result = await query;
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// PUT /api/products/:id — update a product (admin only)
router.put('/:id', auth, adminOnly, async (req, res, next) => {
  const { id } = req.params;
  const { name, description, price, image_url, stock, category } = req.body;
  if (!name || !description || price == null || stock == null) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const queryText = `
      UPDATE products SET
        name = $1,
        description = $2,
        price = $3,
        image_url = $4,
        stock = $5,
        category = $6
      WHERE id = $7
      RETURNING *;
    `;
    const result = await db.query(queryText, [
      name,
      description,
      price,
      image_url || null,
      stock,
      category || null,
      id
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


// PUT /api/products/:id — Update product (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, description, price, stock, image_url, category } = req.body;
  try {
    const result = await db.query(
      `UPDATE products SET name=$1, description=$2, price=$3, stock=$4, image_url=$5, category=$6
       WHERE id=$7 RETURNING *`,
      [name, description, price, stock, image_url, category, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — Delete product (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
