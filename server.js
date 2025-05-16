require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const contactRoutes = require('./routes/contact');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & logging
app.use(helmet());
app.use(morgan('combined'));

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    optionsSuccessStatus: 200
  })
);

// JSON parser
app.use(express.json());

// Routes
app.use('/api/contact', contactRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Ghanish backend is up and running.' });
});

// Error handler (must be last middleware)
app.use(errorHandler);

// Port binding (Render sets PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
