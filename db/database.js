/* ==========================================================================
   DATABASE — SQLite initialization, schema, and helpers
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let DB_PATH;
const SOURCE_DB_PATH = path.join(__dirname, '..', 'data', 'catalogue.db');

if (isVercel) {
  // In Vercel serverless environment, the application root (/var/task) is read-only.
  // os.tmpdir() (/tmp in Lambda) is writable. Copy catalogue.db if not already present.
  const TMP_DIR = os.tmpdir();
  const TMP_DB_PATH = path.join(TMP_DIR, 'catalogue.db');

  if (!fs.existsSync(TMP_DB_PATH) && fs.existsSync(SOURCE_DB_PATH)) {
    try {
      fs.copyFileSync(SOURCE_DB_PATH, TMP_DB_PATH);
    } catch (copyErr) {
      console.warn('Could not copy database to /tmp, falling back to read-only source:', copyErr.message);
    }
  }

  DB_PATH = fs.existsSync(TMP_DB_PATH) ? TMP_DB_PATH : SOURCE_DB_PATH;
} else {
  const DB_DIR = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  DB_PATH = path.join(DB_DIR, 'catalogue.db');
}

let isReadOnly = false;
let db;

try {
  db = new Database(DB_PATH);
} catch (err) {
  if (isVercel) {
    console.warn('Opening database in read-only mode:', err.message);
    db = new Database(SOURCE_DB_PATH, { readonly: true, fileMustExist: true });
    isReadOnly = true;
  } else {
    throw err;
  }
}

// ─── Pragmas & Performance ──────────────────────────────────────────────────
try {
  if (!isReadOnly) {
    if (isVercel) {
      // In serverless /tmp, use MEMORY journal to avoid -shm / -wal file lock issues
      db.pragma('journal_mode = MEMORY');
    } else {
      // WAL mode for better concurrent read performance on persistent storage
      db.pragma('journal_mode = WAL');
    }
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  } else {
    db.pragma('query_only = ON');
    db.pragma('foreign_keys = ON');
  }
} catch (pragmaErr) {
  console.warn('Pragma configuration notice:', pragmaErr.message);
}

// ─── Schema Creation (only if writable) ────────────────────────────────────
if (!isReadOnly) {
  try {
    db.exec(`
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
  } catch (schemaErr) {
    console.warn('Schema check warning:', schemaErr.message);
  }
}

// Graceful cleanup to avoid RemoveEnvironmentCleanupHook assertion failures
process.on('beforeExit', () => {
  try {
    if (db && db.open) {
      db.close();
    }
  } catch (_) {}
});

module.exports = db;
