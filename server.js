require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
const contactRoutes = require('./routes/contact');
const productsRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & logging
app.use(helmet());
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL).split(',').map(s => s.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    optionsSuccessStatus: 200
  })
);

// JSON parser
app.use(express.json());

// Initialize DB tables: contact, products, users
(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('Users table ensured');
  // (contact & products tables already ensured)
})();

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/products', productsRoutes);

// Health check
app.get('/', (req, res) => res.json({ message: 'Ghanish backend is up and running.' }));

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
