/* ==========================================================================
   SETUP ADMIN — Create or reset the administrator account
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const path = require('path');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '..', 'data', 'catalogue.db'));
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

(async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   North Wide Traders — Admin Account Setup   ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  let username = args[0];
  let password = args[1];

  const existing = db.prepare('SELECT username FROM users WHERE role = ?').get('admin');
  if (existing && !username) {
    console.log(`⚠️  An admin account already exists: "${existing.username}"`);
    const overwrite = await question('Do you want to reset it? (yes/no): ');
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('\n❌ Setup cancelled.\n');
      rl.close();
      db.close();
      return;
    }
  }

  if (existing) {
    db.prepare('DELETE FROM users WHERE role = ?').run('admin');
  }

  if (!username) {
    username = await question('Enter admin username: ');
  }
  if (!username || username.trim().length < 3) {
    console.log('\n❌ Username must be at least 3 characters.\n');
    rl.close();
    db.close();
    return;
  }

  if (!password) {
    password = await question('Enter admin password: ');
  }
  if (!password || password.length < 6) {
    console.log('\n❌ Password must be at least 6 characters.\n');
    rl.close();
    db.close();
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    username.trim(),
    hash,
    'admin'
  );

  console.log(`\n✅ Admin account created successfully!`);
  console.log(`   Username: ${username.trim()}`);
  console.log(`   Role: admin\n`);
  console.log(`🔒 You can now log in at /secure-admin\n`);

  rl.close();
  db.close();
})();
