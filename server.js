require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
const contactRoutes = require('./routes/contact');
const productsRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(morgan('combined'));

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL).split(',').map(s => s.trim());
app.use(
  cors({ origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS policy: Origin ${origin} not allowed`));
  }, optionsSuccessStatus: 200 })
);

app.use(express.json());

(async () => {
  // Ensure contact & product & user tables (from before)
  await db.query(`CREATE TABLE IF NOT EXISTS users (...);`);  // trimmed for brevity
  await db.query(`CREATE TABLE IF NOT EXISTS products (...);`);
  await db.query(`CREATE TABLE IF NOT EXISTS contact_messages (...);`);

  // New order tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('DB tables ensured');
})();

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);

app.get('/', (req, res) => res.json({ message: 'Ghanish backend is up and running.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
