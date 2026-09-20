/* ==========================================================================
   MIGRATE TO POSTGRESQL — CLI Migration Tool
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Allow passing connection string as argument or via environment variable
const dbUrl = process.argv[2] || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error('\n❌ Error: Please provide a PostgreSQL connection string.');
  console.error('Usage: node db/migrate-to-postgres.js "postgresql://user:pass@host:port/dbname"');
  console.error('Or set DATABASE_URL in your environment.\n');
  process.exit(1);
}

process.env.DATABASE_URL = dbUrl;

const { Pool } = require('pg');

async function migrate() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   North Wide Traders — PostgreSQL Migration Tool     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('🔌 Connecting to destination PostgreSQL database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to destination database successfully.\n');

    // 1. Create Schema
    console.log('📐 Creating table schemas...');
    await client.query(`
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
        image_path TEXT DEFAULT '',
        additional_images TEXT DEFAULT '[]',
        specifications TEXT DEFAULT '[]',
        brochure_path TEXT DEFAULT '',
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
    `);
    console.log('✅ Schemas verified.\n');

    await client.query('BEGIN');

    // 2. Load the live local SQLite database. JSON remains a safe fallback for
    // repositories that do not have the ignored catalogue.db file.
    const sourcePath = process.env.SOURCE_SQLITE_PATH || path.join(__dirname, '..', 'data', 'catalogue.db');
    let sourceDb = null;
    let backup;
    if (fs.existsSync(sourcePath)) {
      sourceDb = new Database(sourcePath, { readonly: true });
      backup = {
        categories: sourceDb.prepare('SELECT * FROM categories ORDER BY id').all(),
        products: sourceDb.prepare('SELECT * FROM products ORDER BY id').all(),
        users: sourceDb.prepare('SELECT * FROM users ORDER BY id').all()
      };
      console.log(`📂 Source SQLite: ${sourcePath}`);
    } else {
      const backupFile = path.join(__dirname, '..', 'data', 'backup_catalogue.json');
      if (!fs.existsSync(backupFile)) throw new Error(`Source database not found at: ${sourcePath}`);
      backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      console.log(`📄 Source backup: ${backupFile}`);
    }
    console.log(`   Source counts: ${backup.categories.length} categories, ${backup.products.length} products, ${backup.users.length} users`);
    if (sourceDb) sourceDb.close();

    // 3. Migrate Categories
    console.log(`📦 Migrating ${backup.categories.length} categories...`);
    for (const c of backup.categories) {
      await client.query(
        `INSERT INTO categories (id, name, slug, icon, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           icon = EXCLUDED.icon,
           display_order = EXCLUDED.display_order,
           updated_at = CURRENT_TIMESTAMP`,
        [c.id, c.name, c.slug, c.icon || '', c.display_order || 0, c.created_at || new Date(), c.updated_at || new Date()]
      );
    }
    await client.query(`SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories))`);
    console.log('✅ Categories migrated.\n');

    // 4. Migrate Products
    console.log(`📦 Migrating ${backup.products.length} products...`);
    for (const p of backup.products) {
      await client.query(
        `INSERT INTO products 
         (id, name, category_id, type, short_description, full_description, image_path,
          additional_images, specifications, brochure_path, sku, brand, badge_text,
          grade_badge_text, grade_badge_icon, whatsapp_text, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           type = EXCLUDED.type,
           short_description = EXCLUDED.short_description,
           full_description = EXCLUDED.full_description,
           image_path = EXCLUDED.image_path,
           additional_images = EXCLUDED.additional_images,
           specifications = EXCLUDED.specifications,
           brochure_path = EXCLUDED.brochure_path,
           sku = EXCLUDED.sku,
           brand = EXCLUDED.brand,
           badge_text = EXCLUDED.badge_text,
           grade_badge_text = EXCLUDED.grade_badge_text,
           grade_badge_icon = EXCLUDED.grade_badge_icon,
           whatsapp_text = EXCLUDED.whatsapp_text,
           status = EXCLUDED.status,
           updated_at = CURRENT_TIMESTAMP`,
        [
          p.id, p.name, p.category_id, p.type || '', p.short_description || '',
          p.full_description || '', p.image_path || '', p.additional_images || '[]',
          p.specifications || '[]', p.brochure_path || '', p.sku || '', p.brand || '',
          p.badge_text || '', p.grade_badge_text || '', p.grade_badge_icon || '',
          p.whatsapp_text || '', p.status || 'draft', p.created_at || new Date(),
          p.updated_at || new Date()
        ]
      );
    }
    await client.query(`SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products))`);
    console.log('✅ Products migrated.\n');

    // 5. Migrate Admin Users
    console.log(`📦 Migrating ${backup.users.length} admin user(s)...`);
    for (const u of backup.users) {
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role`,
        [u.id, u.username, u.password_hash, u.role || 'admin', u.created_at || new Date()]
      );
    }
    await client.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`);
    console.log('✅ Admin user(s) migrated.\n');

    // 6. Verification
    const catCheck = await client.query('SELECT COUNT(*) AS count FROM categories');
    const prodCheck = await client.query('SELECT COUNT(*) AS count FROM products');
    const userCheck = await client.query('SELECT COUNT(*) AS count FROM users');
    const counts = [catCheck.rows[0].count, prodCheck.rows[0].count, userCheck.rows[0].count].map(Number);
    const sourceCounts = [backup.categories.length, backup.products.length, backup.users.length];
    if (counts.some((count, index) => count < sourceCounts[index])) {
      throw new Error(`Verification failed: destination counts ${counts.join('/')} are below source counts ${sourceCounts.join('/')}.`);
    }

    await client.query('COMMIT');

    console.log('════════════════════════════════════════════════════════');
    console.log('🎉 MIGRATION COMPLETE & VERIFIED:');
    console.log(`   Categories in PostgreSQL: ${catCheck.rows[0].count}`);
    console.log(`   Products in PostgreSQL:   ${prodCheck.rows[0].count}`);
    console.log(`   Users in PostgreSQL:      ${userCheck.rows[0].count}`);
    console.log('════════════════════════════════════════════════════════\n');

    client.release();
    await pool.end();
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (client) client.release();
    await pool.end();
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
