// routes/orders.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// All routes below require a valid JWT
router.use(auth);

/**
 * POST /api/orders
 * body: { items: [{ product_id, quantity }] }
 */
router.post('/', async (req, res, next) => {
  const userId = req.user.id;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  try {
    // 1) Fetch product details
    const productIds = items.map(i => i.product_id);
    const placeholders = productIds.map((_, i) => `$${i+1}`).join(',');
    const productsRes = await db.query(
      `SELECT id, price FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const productsMap = new Map(productsRes.rows.map(p => [p.id, p.price]));

    // 2) Calculate total and prepare items
    let total = 0;
    const orderItemsData = items.map(({ product_id, quantity }) => {
      const unit_price = productsMap.get(product_id);
      if (unit_price == null) {
        throw new Error(`Product ${product_id} not found`);
      }
      const subtotal = parseFloat(unit_price) * quantity;
      total += subtotal;
      return { product_id, quantity, unit_price, subtotal };
    });

    // 3) Insert into orders
    const orderRes = await db.query(
      `INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id, created_at`,
      [userId, total.toFixed(2)]
    );
    const orderId = orderRes.rows[0].id;

    // 4) Insert each order_item
    await Promise.all(
      orderItemsData.map(item =>
        db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            orderId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.subtotal.toFixed(2)
          ]
        )
      )
    );

    res.status(201).json({ orderId, total: total.toFixed(2), status: 'pending' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 * returns all orders for authenticated user
 */
router.get('/', async (req, res, next) => {
  const userId = req.user.id;
  try {
    const ordersRes = await db.query(
      `SELECT id, total, status, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(ordersRes.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id
 * returns order detail including items
 */
router.get('/:id', async (req, res, next) => {
  const userId = req.user.id;
  const orderId = req.params.id;
  try {
    // 1) Verify the order belongs to this user
    const orderRes = await db.query(
      `SELECT id, total, status, created_at
       FROM orders
       WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    // 2) Fetch all items for this order
    const itemsRes = await db.query(
      `SELECT oi.id,
              oi.product_id,
              p.name AS product_name,
              oi.quantity,
              oi.unit_price,
              oi.subtotal
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({ ...order, items: itemsRes.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
