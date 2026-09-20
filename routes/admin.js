/* ==========================================================================
   ADMIN API ROUTES — Authenticated CRUD endpoints
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { requireAdmin, generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

// ─── Multer Config for Image Uploads ────────────────────────────────────────

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowed.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, webp, gif, svg) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

// ─── AUTH: Login ────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await db.queryOne('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin']);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate stateless HMAC-SHA256 signed token
    const token = generateToken(user);

    // Set secure HttpOnly cookie
    setAuthCookie(res, token);

    // Also populate req.session
    req.session = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    res.json({
      message: 'Login successful.',
      username: user.username,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error: ' + (err.message || '') });
  }
});

// ─── AUTH: Logout ───────────────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  req.session = {};
  res.json({ message: 'Logged out successfully.' });
});

// ─── AUTH: Check Session ────────────────────────────────────────────────────

router.get('/session', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      username: req.session.username,
      role: req.session.role
    });
  }
  res.json({ authenticated: false });
});

// ──────────────────────────────────────────────────────────────────────────
// All routes below this point require admin authentication
// ──────────────────────────────────────────────────────────────────────────

// ─── STATS: Dashboard overview ──────────────────────────────────────────────

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalRow = await db.queryOne('SELECT COUNT(*) AS count FROM products');
    const pubRow = await db.queryOne("SELECT COUNT(*) AS count FROM products WHERE status = 'published'");
    const draftRow = await db.queryOne("SELECT COUNT(*) AS count FROM products WHERE status = 'draft'");
    const unpubRow = await db.queryOne("SELECT COUNT(*) AS count FROM products WHERE status = 'unpublished'");
    const catRow = await db.queryOne('SELECT COUNT(*) AS count FROM categories');

    res.json({
      totalProducts: parseInt(totalRow ? totalRow.count : 0, 10),
      publishedProducts: parseInt(pubRow ? pubRow.count : 0, 10),
      draftProducts: parseInt(draftRow ? draftRow.count : 0, 10),
      unpublishedProducts: parseInt(unpubRow ? unpubRow.count : 0, 10),
      totalCategories: parseInt(catRow ? catRow.count : 0, 10)
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats: ' + (err.message || '') });
  }
});

// ─── PRODUCTS: List all (including drafts) ──────────────────────────────────

router.get('/products', requireAdmin, async (req, res) => {
  try {
    const products = await db.query(`
      SELECT 
        p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.updated_at DESC, p.id DESC
    `);

    res.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ error: 'Failed to fetch products: ' + (err.message || '') });
  }
});

// ─── PRODUCTS: Get single ───────────────────────────────────────────────────

router.get('/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await db.queryOne(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product: ' + (err.message || '') });
  }
});

// ─── PRODUCTS: Create ───────────────────────────────────────────────────────

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const {
      name, category_id, type, short_description, full_description,
      image_path, additional_images, specifications, brochure_path,
      sku, brand, badge_text, grade_badge_text, grade_badge_icon,
      whatsapp_text, status
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: 'Product name and category are required.' });
    }

    // Validate category exists
    const cat = await db.queryOne('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (!cat) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    const result = await db.execute(`
      INSERT INTO products 
        (name, category_id, type, short_description, full_description, image_path,
         additional_images, specifications, brochure_path, sku, brand,
         badge_text, grade_badge_text, grade_badge_icon, whatsapp_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, category_id, type || '', short_description || '', full_description || '',
      image_path || '', additional_images || '[]', specifications || '[]',
      brochure_path || '', sku || '', brand || '', badge_text || '',
      grade_badge_text || '', grade_badge_icon || '', whatsapp_text || '',
      status || 'draft'
    ]);

    const newProduct = await db.queryOne(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product: ' + (err.message || '') });
  }
});

// ─── PRODUCTS: Update ───────────────────────────────────────────────────────

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await db.queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const {
      name, category_id, type, short_description, full_description,
      image_path, additional_images, specifications, brochure_path,
      sku, brand, badge_text, grade_badge_text, grade_badge_icon,
      whatsapp_text, status
    } = req.body;

    // Validate category if provided
    if (category_id) {
      const cat = await db.queryOne('SELECT id FROM categories WHERE id = ?', [category_id]);
      if (!cat) {
        return res.status(400).json({ error: 'Invalid category.' });
      }
    }

    await db.execute(`
      UPDATE products SET
        name = ?, category_id = ?, type = ?, short_description = ?, full_description = ?,
        image_path = ?, additional_images = ?, specifications = ?, brochure_path = ?,
        sku = ?, brand = ?, badge_text = ?, grade_badge_text = ?, grade_badge_icon = ?,
        whatsapp_text = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      name || existing.name,
      category_id || existing.category_id,
      type !== undefined ? type : existing.type,
      short_description !== undefined ? short_description : existing.short_description,
      full_description !== undefined ? full_description : existing.full_description,
      image_path !== undefined ? image_path : existing.image_path,
      additional_images !== undefined ? additional_images : existing.additional_images,
      specifications !== undefined ? specifications : existing.specifications,
      brochure_path !== undefined ? brochure_path : existing.brochure_path,
      sku !== undefined ? sku : existing.sku,
      brand !== undefined ? brand : existing.brand,
      badge_text !== undefined ? badge_text : existing.badge_text,
      grade_badge_text !== undefined ? grade_badge_text : existing.grade_badge_text,
      grade_badge_icon !== undefined ? grade_badge_icon : existing.grade_badge_icon,
      whatsapp_text !== undefined ? whatsapp_text : existing.whatsapp_text,
      status || existing.status,
      req.params.id
    ]);

    const updated = await db.queryOne(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    res.json(updated);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product: ' + (err.message || '') });
  }
});

// ─── PRODUCTS: Delete ───────────────────────────────────────────────────────

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await db.queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);

    // Clean up uploaded image if it's in the uploads folder (safely ignoring read-only fs)
    if (existing.image_path && existing.image_path.startsWith('uploads/')) {
      try {
        const fullPath = path.join(__dirname, '..', existing.image_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (unlinkErr) {
        // Safe to ignore on serverless read-only filesystems
      }
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product: ' + (err.message || '') });
  }
});

// ─── IMAGE UPLOAD ───────────────────────────────────────────────────────────

router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: 'Image storage is not configured. Set BLOB_READ_WRITE_TOKEN in Vercel.' });
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = require('@vercel/blob');
      const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '-');
      const blob = await put(`products/${Date.now()}-${safeName}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      return res.json({
        message: 'Image uploaded successfully.',
        path: blob.url,
        filename: req.file.originalname,
        size: req.file.size
      });
    }

    // Local development fallback. Production requires persistent Blob storage.
    const base64Image = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;

    res.json({
      message: 'Image uploaded successfully.',
      path: dataUri,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (err && (err.status === 401 || err.status === 403 || /access denied|valid token/i.test(err.message || ''))) {
      return res.status(503).json({
        error: 'Vercel Blob rejected the configured token. Create a new Blob token for this Vercel project and redeploy.'
      });
    }
    res.status(500).json({ error: 'Failed to upload image: ' + (err.message || '') });
  }
});

router.use('/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image is too large. Maximum size is 10 MB.' });
    }
    return res.status(400).json({ error: 'Invalid image upload.' });
  }
  if (err) return res.status(400).json({ error: err.message || 'Invalid image upload.' });
  next();
});

// ─── CATEGORIES: List all ───────────────────────────────────────────────────

router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.slug, c.icon, c.display_order, c.created_at, c.updated_at
      ORDER BY c.display_order ASC, c.name ASC
    `);

    const normalized = categories.map(cat => ({
      ...cat,
      product_count: parseInt(cat.product_count || 0, 10)
    }));

    res.json(normalized);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories: ' + (err.message || '') });
  }
});

// ─── CATEGORIES: Create ─────────────────────────────────────────────────────

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, display_order } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Category name and slug are required.' });
    }

    const result = await db.execute(
      'INSERT INTO categories (name, slug, icon, display_order) VALUES (?, ?, ?, ?)',
      [name, slug, icon || '', display_order || 0]
    );

    const newCat = await db.queryOne('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newCat);
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.status(409).json({ error: 'Category name or slug already exists.' });
    }
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category: ' + (err.message || '') });
  }
});

// ─── CATEGORIES: Update ─────────────────────────────────────────────────────

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await db.queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const { name, slug, icon, display_order } = req.body;

    await db.execute(`
      UPDATE categories SET name = ?, slug = ?, icon = ?, display_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      name || existing.name,
      slug || existing.slug,
      icon !== undefined ? icon : existing.icon,
      display_order !== undefined ? display_order : existing.display_order,
      req.params.id
    ]);

    const updated = await db.queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.status(409).json({ error: 'A category with this name or slug already exists.' });
    }
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Failed to update category: ' + (err.message || '') });
  }
});

// ─── CATEGORIES: Delete ─────────────────────────────────────────────────────

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const countRow = await db.queryOne(
      'SELECT COUNT(*) AS count FROM products WHERE category_id = ?',
      [req.params.id]
    );
    const productCount = parseInt(countRow ? countRow.count : 0, 10);

    if (productCount > 0) {
      return res.status(409).json({
        error: `Cannot delete category: ${productCount} product(s) still assigned to it. Reassign or delete them first.`
      });
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category: ' + (err.message || '') });
  }
});

// ─── SETTINGS: Change password ──────────────────────────────────────────────

router.put('/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.userId]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to change password: ' + (err.message || '') });
  }
});

module.exports = router;
