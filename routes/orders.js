// routes/orders.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();

// All routes below require a valid JWT
router.use(auth);

/**
 * POST /api/orders
 */
router.post('/', async (req, res, next) => {
  const userId = req.user.id;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  try {
    const productIds = items.map(i => i.product_id);
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const productsRes = await db.query(
      `SELECT id, price FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const productsMap = new Map(productsRes.rows.map(p => [p.id, p.price]));

    let total = 0;
    const orderItemsData = items.map(({ product_id, quantity }) => {
      const unit_price = productsMap.get(product_id);
      if (unit_price == null) throw new Error(`Product ${product_id} not found`);
      const subtotal = parseFloat(unit_price) * quantity;
      total += subtotal;
      return { product_id, quantity, unit_price, subtotal };
    });

    const orderRes = await db.query(
      `INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id, created_at`,
      [userId, total.toFixed(2)]
    );
    const orderId = orderRes.rows[0].id;

    await Promise.all(orderItemsData.map(item =>
      db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.subtotal.toFixed(2)]
      )
    ));

    res.status(201).json({ orderId, total: total.toFixed(2), status: 'pending' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders — user’s own orders
 */
router.get('/', async (req, res, next) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT id, total, status, created_at
       FROM orders
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/all — admin
 */
router.get('/all', adminOnly, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT o.id, o.total, o.status, o.created_at,
             u.full_name, u.phone
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/orders/:id/status — admin
 */
router.put('/:id/status', adminOnly, async (req, res, next) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE orders SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id — user: own order
 */
router.get('/:id', async (req, res, next) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  try {
    const orderRes = await db.query(
      `SELECT id, total, status, created_at FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const itemsRes = await db.query(
      `SELECT oi.id, oi.product_id, p.name AS product_name,
              oi.quantity, oi.unit_price, oi.subtotal
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({ ...orderRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id/admin — admin: view any order
 */
router.get('/:id/admin', adminOnly, async (req, res, next) => {
  const orderId = req.params.id;

  try {
    const orderRes = await db.query(
      `SELECT id, total, status, created_at FROM orders WHERE id = $1`,
      [orderId]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const itemsRes = await db.query(
      `SELECT oi.id, oi.product_id, p.name AS product_name,
              oi.quantity, oi.unit_price, oi.subtotal
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({ ...orderRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
