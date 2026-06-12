-- Migration 0004: Rename English default categories to BM / Manglish,
-- and insert new categories (Pinjaman, Shopping, etc.) for all existing users.
-- Expiry: safe to run once. Idempotent — duplicate inserts are skipped.

-- Rename old English defaults
UPDATE categories SET name = 'Makan' WHERE name = 'Food';
UPDATE categories SET name = 'Barang Dapur' WHERE name = 'Groceries';
UPDATE categories SET name = 'Bil Rumah' WHERE name = 'Utilities';
UPDATE categories SET name = 'Hiburan' WHERE name = 'Entertainment';
UPDATE categories SET name = 'Kesihatan' WHERE name = 'Healthcare';
UPDATE categories SET name = 'Jalan-Jalan' WHERE name = 'Travel';
UPDATE categories SET name = 'Rumah' WHERE name = 'Home Care';
UPDATE categories SET name = 'Lain-Lain' WHERE name = 'Other';

-- Insert brand-new categories for all existing users
INSERT INTO categories (id, "userId", name)
SELECT gen_random_uuid(), u.id, new.name
FROM "user" u
CROSS JOIN (VALUES
  ('Pinjaman'),
  ('Insurans & Takaful'),
  ('Shopping'),
  ('Gajet & Elektronik'),
  ('Kecantikan'),
  ('Pelajaran'),
  ('Hadiah & Sumbangan')
) AS new(name)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c."userId" = u.id AND c.name = new.name
);
