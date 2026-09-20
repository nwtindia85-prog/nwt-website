const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'data', 'backup_catalogue.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

let sql = `-- North Wide Traders Database Backup
-- Exported: ${backup.exportedAt}

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  icon VARCHAR(255) DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type VARCHAR(255) DEFAULT '',
  short_description TEXT DEFAULT '',
  full_description TEXT DEFAULT '',
  image_path VARCHAR(500) DEFAULT '',
  additional_images TEXT DEFAULT '[]',
  specifications TEXT DEFAULT '[]',
  brochure_path VARCHAR(500) DEFAULT '',
  sku VARCHAR(100) DEFAULT '',
  brand VARCHAR(255) DEFAULT '',
  badge_text VARCHAR(100) DEFAULT '',
  grade_badge_text VARCHAR(100) DEFAULT '',
  grade_badge_icon VARCHAR(100) DEFAULT '',
  whatsapp_text TEXT DEFAULT '',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

`;

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

for (const c of backup.categories) {
  sql += `INSERT INTO categories (id, name, slug, icon, display_order, created_at, updated_at) VALUES (${c.id}, ${esc(c.name)}, ${esc(c.slug)}, ${esc(c.icon)}, ${c.display_order}, ${esc(c.created_at)}, ${esc(c.updated_at)}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, icon=EXCLUDED.icon, display_order=EXCLUDED.display_order;\n`;
}
sql += `SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));\n\n`;

for (const p of backup.products) {
  sql += `INSERT INTO products (id, name, category_id, type, short_description, full_description, image_path, additional_images, specifications, brochure_path, sku, brand, badge_text, grade_badge_text, grade_badge_icon, whatsapp_text, status, created_at, updated_at) VALUES (${p.id}, ${esc(p.name)}, ${p.category_id}, ${esc(p.type)}, ${esc(p.short_description)}, ${esc(p.full_description)}, ${esc(p.image_path)}, ${esc(p.additional_images)}, ${esc(p.specifications)}, ${esc(p.brochure_path)}, ${esc(p.sku)}, ${esc(p.brand)}, ${esc(p.badge_text)}, ${esc(p.grade_badge_text)}, ${esc(p.grade_badge_icon)}, ${esc(p.whatsapp_text)}, ${esc(p.status)}, ${esc(p.created_at)}, ${esc(p.updated_at)}) ON CONFLICT (id) DO NOTHING;\n`;
}
sql += `SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products));\n\n`;

for (const u of backup.users) {
  sql += `INSERT INTO users (id, username, password_hash, role, created_at) VALUES (${u.id}, ${esc(u.username)}, ${esc(u.password_hash)}, ${esc(u.role)}, ${esc(u.created_at)}) ON CONFLICT (id) DO NOTHING;\n`;
}
sql += `SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));\n`;

const outPath = path.join(__dirname, '..', 'data', 'backup_catalogue.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('✅ Generated PostgreSQL backup SQL at:', outPath);
