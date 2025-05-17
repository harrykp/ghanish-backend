-- scripts/init_store_tables.sql
-- Run once (after init_db.sql) to create products table and seed sample data

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional sample data
INSERT INTO products (name, description, price, image_url, stock)
VALUES
  ('Smoke-Dried Shrimps', 'Premium smoke-dried shrimps for soups and stews.', 9.99, 'https://harrykp.github.io/ghanish-frontend/images/product-shrimps.png', 100),
  ('Smoke-Dried Herrings', 'Authentic West African smoke-dried herrings.', 7.49, 'https://harrykp.github.io/ghanish-frontend/images/product-shrimps.png', 150)
ON CONFLICT DO NOTHING;
