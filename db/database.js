/* ==========================================================================
   DATABASE ADAPTER — Dual Driver (PostgreSQL in Prod / SQLite Local Fallback)
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const usePostgres = Boolean(DATABASE_URL);

let pgPool = null;
let sqliteDb = null;
let isInitialized = false;
let initPromise = null;

// ─── SQL Dialect Normalizer ─────────────────────────────────────────────────
function normalizeQuery(sql, isPg) {
  if (!isPg) return sql;
  let paramIndex = 1;
  let out = sql.replace(/\?/g, () => `$${paramIndex++}`);
  out = out.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  return out;
}

// ─── PostgreSQL Initialization ──────────────────────────────────────────────
async function initPostgres() {
  const { Pool } = require('pg');
  const poolConfig = {
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: isVercel ? 5 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };

  pgPool = new Pool(poolConfig);
  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
  });

  // Create tables if not present
  await pgPool.query(`
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
  `);

  // Ensure image_path can store large Base64 strings in Postgres
  try {
    await pgPool.query('ALTER TABLE products ALTER COLUMN image_path TYPE TEXT;');
  } catch (alterErr) {
    console.warn('Could not alter image_path type:', alterErr.message);
  }

}

async function seedFromBackupPg() {
  const backupFile = path.join(__dirname, '..', 'data', 'backup_catalogue.json');
  if (!fs.existsSync(backupFile)) return;
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  for (const c of backup.categories) {
    await pgPool.query(
      `INSERT INTO categories (id, name, slug, icon, display_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, icon=EXCLUDED.icon, display_order=EXCLUDED.display_order`,
      [c.id, c.name, c.slug, c.icon || '', c.display_order || 0, c.created_at || new Date(), c.updated_at || new Date()]
    );
  }
  await pgPool.query(`SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories))`);

  for (const p of backup.products) {
    await pgPool.query(
      `INSERT INTO products (id, name, category_id, type, short_description, full_description, image_path, additional_images, specifications, brochure_path, sku, brand, badge_text, grade_badge_text, grade_badge_icon, whatsapp_text, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, p.category_id, p.type || '', p.short_description || '', p.full_description || '', p.image_path || '', p.additional_images || '[]', p.specifications || '[]', p.brochure_path || '', p.sku || '', p.brand || '', p.badge_text || '', p.grade_badge_text || '', p.grade_badge_icon || '', p.whatsapp_text || '', p.status || 'draft', p.created_at || new Date(), p.updated_at || new Date()]
    );
  }
  await pgPool.query(`SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products))`);

  for (const u of backup.users) {
    await pgPool.query(
      `INSERT INTO users (id, username, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.username, u.password_hash, u.role || 'admin', u.created_at || new Date()]
    );
  }
  await pgPool.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users))`);
  console.log('✅ PostgreSQL seeding completed successfully.');
}

// ─── SQLite Initialization (local development only) ────────────────────────
function initSqlite() {
  const Database = require('better-sqlite3');

  if (isVercel) {
    throw new Error('DATABASE_URL is required in Vercel. Configure PostgreSQL before serving API requests.');
  }

  const DB_DIR = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const DB_PATH = path.join(DB_DIR, 'catalogue.db');
  sqliteDb = new Database(DB_PATH);
  try {
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    sqliteDb.pragma('busy_timeout = 5000');
  } catch (_) {}

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      type TEXT DEFAULT '',
      short_description TEXT DEFAULT '',
      full_description TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      additional_images TEXT DEFAULT '[]',
      specifications TEXT DEFAULT '[]',
      brochure_path TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      brand TEXT DEFAULT '',
      badge_text TEXT DEFAULT '',
      grade_badge_text TEXT DEFAULT '',
      grade_badge_icon TEXT DEFAULT '',
      whatsapp_text TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'unpublished')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  `);

}

function seedSqliteFromBackup() {
  const backupFile = path.join(__dirname, '..', 'data', 'backup_catalogue.json');
  if (!fs.existsSync(backupFile)) {
    console.warn('⚠️  backup_catalogue.json not found — in-memory DB will be empty.');
    return;
  }

  try {
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    const insertCat = sqliteDb.prepare(
      `INSERT OR IGNORE INTO categories (id, name, slug, icon, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertProd = sqliteDb.prepare(
      `INSERT OR IGNORE INTO products
        (id, name, category_id, type, short_description, full_description, image_path,
         additional_images, specifications, brochure_path, sku, brand, badge_text,
         grade_badge_text, grade_badge_icon, whatsapp_text, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertUser = sqliteDb.prepare(
      `INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`
    );

    const seedAll = sqliteDb.transaction(() => {
      for (const c of (backup.categories || [])) {
        insertCat.run(c.id, c.name, c.slug, c.icon || '', c.display_order || 0, c.created_at || '', c.updated_at || '');
      }
      for (const p of (backup.products || [])) {
        insertProd.run(
          p.id, p.name, p.category_id, p.type || '', p.short_description || '',
          p.full_description || '', p.image_path || '', p.additional_images || '[]',
          p.specifications || '[]', p.brochure_path || '', p.sku || '', p.brand || '',
          p.badge_text || '', p.grade_badge_text || '', p.grade_badge_icon || '',
          p.whatsapp_text || '', p.status || 'published', p.created_at || '', p.updated_at || ''
        );
      }
      for (const u of (backup.users || [])) {
        insertUser.run(u.id, u.username, u.password_hash, u.role || 'admin', u.created_at || '');
      }
    });

    seedAll();
    const catCount = sqliteDb.prepare('SELECT COUNT(*) AS c FROM categories').get();
    const prodCount = sqliteDb.prepare('SELECT COUNT(*) AS c FROM products').get();
    console.log(`✅ In-memory SQLite seeded: ${catCount.c} categories, ${prodCount.c} products.`);
  } catch (seedErr) {
    console.error('❌ Failed to seed in-memory SQLite from backup:', seedErr.message);
  }
}

// ─── Ensure Ready Helper ────────────────────────────────────────────────────
async function ensureReady() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      if (usePostgres) {
        console.log('🔌 Connecting to PostgreSQL database...');
        await initPostgres();
        console.log('✅ Connected to PostgreSQL successfully.');
      } else {
        if (isVercel) {
          throw new Error('DATABASE_URL is required in Vercel. Configure PostgreSQL before serving API requests.');
        }
        console.log('📂 Using SQLite database...');
        initSqlite();
        console.log('✅ SQLite ready.');
      }
      isInitialized = true;
    })();
  }
  await initPromise;
}

// ─── Universal Database API ─────────────────────────────────────────────────

/**
 * Execute a query returning multiple rows.
 */
async function query(sql, params = []) {
  await ensureReady();
  if (usePostgres) {
    const pgSql = normalizeQuery(sql, true);
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(params);
  }
}

/**
 * Execute a query returning a single row (or null).
 */
async function queryOne(sql, params = []) {
  await ensureReady();
  if (usePostgres) {
    const pgSql = normalizeQuery(sql, true);
    const res = await pgPool.query(pgSql, params);
    return res.rows.length > 0 ? res.rows[0] : null;
  } else {
    const stmt = sqliteDb.prepare(sql);
    const row = stmt.get(params);
    return row || null;
  }
}

/**
 * Execute an INSERT / UPDATE / DELETE statement.
 * Returns { lastInsertRowid, changes }.
 */
async function execute(sql, params = []) {
  await ensureReady();
  if (usePostgres) {
    let pgSql = normalizeQuery(sql, true);
    const isInsert = /^\s*INSERT\s+/i.test(pgSql);
    if (isInsert && !/RETURNING\s+/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const res = await pgPool.query(pgSql, params);
    const lastId = res.rows.length > 0 && res.rows[0].id ? res.rows[0].id : null;
    return {
      lastInsertRowid: lastId,
      changes: res.rowCount
    };
  } else {
    const stmt = sqliteDb.prepare(sql);
    const info = stmt.run(params);
    return {
      lastInsertRowid: info.lastInsertRowid,
      changes: info.changes
    };
  }
}

/**
 * Graceful close for process termination or testing.
 */
async function close() {
  if (usePostgres && pgPool) {
    await pgPool.end();
    pgPool = null;
    isInitialized = false;
    initPromise = null;
  } else if (sqliteDb && sqliteDb.open) {
    sqliteDb.close();
    sqliteDb = null;
    isInitialized = false;
    initPromise = null;
  }
}

module.exports = {
  query,
  queryOne,
  execute,
  close,
  ensureReady,
  isPostgres: () => usePostgres
};
