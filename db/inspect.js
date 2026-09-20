const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'data', 'catalogue.db'), { readonly: true });

console.log('Tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(JSON.stringify(tables, null, 2));

for (const t of tables) {
  const cols = db.pragma('table_info(' + t.name + ')');
  console.log('\n' + t.name + ':');
  console.log(JSON.stringify(cols, null, 2));
  const count = db.prepare('SELECT COUNT(*) as c FROM ' + t.name).get();
  console.log('Row count:', count.c);
}

// Check users
const users = db.prepare("SELECT id, username, role FROM users").all();
console.log('\nAdmin users:', JSON.stringify(users));

// Check categories
const cats = db.prepare("SELECT * FROM categories").all();
console.log('\nCategories:', JSON.stringify(cats, null, 2));

// Check products count by category
const productsByCat = db.prepare("SELECT c.name, COUNT(p.id) as cnt FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id").all();
console.log('\nProducts by category:', JSON.stringify(productsByCat));

db.close();
