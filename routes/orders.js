const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const router = express.Router();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

router.use(auth);

// === Create Order ===
router.post('/', async (req, res, next) => {
  const userId = req.user.id;
  const { items, discount_code } = req.body;

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

    let discountPercent = 0;
    if (discount_code) {
      const dRes = await db.query(
        `SELECT percent_off FROM discounts WHERE code = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [discount_code]
      );
      if (dRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired discount code.' });
      }
      discountPercent = dRes.rows[0].percent_off;
    }

    const discountAmount = total * (discountPercent / 100);
    const finalTotal = total - discountAmount;

    const orderRes = await db.query(
      `INSERT INTO orders (user_id, total, discount_code) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [userId, finalTotal.toFixed(2), discount_code || null]
    );
    const orderId = orderRes.rows[0].id;

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

    res.status(201).json({
      orderId,
      total: finalTotal.toFixed(2),
      discount: discountPercent,
      status: 'pending'
    });
  } catch (err) {
    console.error('❌ Error creating order:', err);
    next(err);
  }
});

// === User: Get own orders ===
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, total, status, created_at
       FROM orders WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching user orders:', err);
    next(err);
  }
});

// === Admin: Get all orders (with optional pagination) ===
router.get('/all', adminOnly, async (req, res, next) => {
  try {
    let { page, limit } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const baseQuery = `
      SELECT o.id, o.total, o.status, o.created_at,
             u.full_name, u.phone
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `;

    if (!isNaN(page) && !isNaN(limit)) {
      const offset = (page - 1) * limit;
      const paginated = await db.query(`${baseQuery} LIMIT $1 OFFSET $2`, [limit, offset]);
      const countRes = await db.query('SELECT COUNT(*) FROM orders');
      return res.json({
        total: parseInt(countRes.rows[0].count),
        orders: paginated.rows
      });
    } else {
      const all = await db.query(baseQuery);
      return res.json(all.rows);
    }
  } catch (err) {
    console.error('❌ Error fetching admin orders:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// === Admin: View single order (modal) ===
router.get('/:id/admin', adminOnly, async (req, res, next) => {
  try {
    const orderRes = await db.query(
      `SELECT id, total, status, created_at FROM orders WHERE id=$1`,
      [req.params.id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await db.query(
      `SELECT oi.quantity, oi.unit_price, oi.subtotal,
              p.name AS product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE order_id = $1`,
      [req.params.id]
    );

    res.json({ ...order, items: itemsRes.rows });
  } catch (err) {
    console.error('❌ Error fetching order details:', err);
    next(err);
  }
});

// === User: View single order (confirmation page) ===
router.get('/:id', async (req, res, next) => {
  const userId = req.user.id;
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  try {
    const orderRes = await db.query(
      `SELECT id, total, discount_code, status, created_at
       FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    const itemsRes = await db.query(
      `SELECT oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE order_id = $1`,
      [orderId]
    );

    let discount = 0;
    if (order.discount_code) {
      const dRes = await db.query(
        `SELECT percent_off FROM discounts WHERE code = $1`,
        [order.discount_code]
      );
      if (dRes.rows.length) {
        discount = dRes.rows[0].percent_off;
      }
    }

    res.json({ ...order, discount, items: itemsRes.rows });
  } catch (err) {
    console.error('❌ Error fetching user order by ID:', err);
    next(err);
  }
});

// === Admin: Update status + notify user ===
router.put('/:id/status', adminOnly, async (req, res, next) => {
  const { status } = req.body;
  try {
    await db.query(`UPDATE orders SET status=$1 WHERE id=$2`, [status, req.params.id]);

    const userRes = await db.query(
      `SELECT u.email, u.full_name
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`, [req.params.id]
    );

    const user = userRes.rows[0];
    if (user) {
      await transporter.sendMail({
        to: user.email,
        subject: `Your Ghanish Order #${req.params.id} is now "${status}"`,
        html: `<p>Dear ${user.full_name},</p><p>Your order status is now: <strong>${status}</strong>.</p>`
      });
    }

    res.json({ message: 'Status updated and email sent' });
  } catch (err) {
    console.error('❌ Error updating order status:', err);
    next(err);
  }
});

module.exports = router;
