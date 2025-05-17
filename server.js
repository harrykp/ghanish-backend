require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
const contactRoutes = require('./routes/contact');
const productsRoutes = require('./routes/products');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & logging
app.use(helmet());
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL).split(',').map(s => s.trim());
app.use(
  cors({ origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  }, optionsSuccessStatus: 200 })
);

// JSON parser
app.use(express.json());

// Initialize DB tables
(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('DB tables ensured');
})();

// Routes
app.use('/api/contact', contactRoutes);
app.use('/api/products', productsRoutes);

// Health check
app.get('/', (req, res) => res.json({ message: 'Ghanish backend is up and running.' }));

// Error handler
app.use(errorHandler);

// Port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
