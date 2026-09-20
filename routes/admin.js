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

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');
const UPLOAD_DIR = isVercel ? path.join(os.tmpdir(), 'uploads', 'products') : LOCAL_UPLOAD_DIR;

// Ensure upload directory exists safely
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (dirErr) {
  console.warn('Could not create upload directory:', dirErr.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniquePrefix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
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

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'admin');

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
    res.status(500).json({ error: 'Internal server error.' });
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

router.get('/stats', requireAdmin, (req, res) => {
  try {
    const totalProducts = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    const publishedProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'published'").get().count;
    const draftProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'draft'").get().count;
    const unpublishedProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'unpublished'").get().count;
    const totalCategories = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;

    res.json({
      totalProducts,
      publishedProducts,
      draftProducts,
      unpublishedProducts,
      totalCategories
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ─── PRODUCTS: List all (including drafts) ──────────────────────────────────

router.get('/products', requireAdmin, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT 
        p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.updated_at DESC
    `).all();

    res.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// ─── PRODUCTS: Get single ───────────────────────────────────────────────────

router.get('/products/:id', requireAdmin, (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// ─── PRODUCTS: Create ───────────────────────────────────────────────────────

router.post('/products', requireAdmin, (req, res) => {
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
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
    if (!cat) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    const result = db.prepare(`
      INSERT INTO products 
        (name, category_id, type, short_description, full_description, image_path,
         additional_images, specifications, brochure_path, sku, brand,
         badge_text, grade_badge_text, grade_badge_icon, whatsapp_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, category_id, type || '', short_description || '', full_description || '',
      image_path || '', additional_images || '[]', specifications || '[]',
      brochure_path || '', sku || '', brand || '', badge_text || '',
      grade_badge_text || '', grade_badge_icon || '', whatsapp_text || '',
      status || 'draft'
    );

    const newProduct = db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// ─── PRODUCTS: Update ───────────────────────────────────────────────────────

router.put('/products/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
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
      const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
      if (!cat) {
        return res.status(400).json({ error: 'Invalid category.' });
      }
    }

    db.prepare(`
      UPDATE products SET
        name = ?, category_id = ?, type = ?, short_description = ?, full_description = ?,
        image_path = ?, additional_images = ?, specifications = ?, brochure_path = ?,
        sku = ?, brand = ?, badge_text = ?, grade_badge_text = ?, grade_badge_icon = ?,
        whatsapp_text = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
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
    );

    const updated = db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// ─── PRODUCTS: Delete ───────────────────────────────────────────────────────

router.delete('/products/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

    // Clean up uploaded image if it's in the uploads folder
    if (existing.image_path && existing.image_path.startsWith('uploads/')) {
      try {
        const fullPath = path.join(__dirname, '..', existing.image_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (unlinkErr) {
        console.warn('Could not unlink image file:', unlinkErr.message);
      }
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// ─── IMAGE UPLOAD ───────────────────────────────────────────────────────────

router.post('/upload', requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const relativePath = 'uploads/products/' + req.file.filename;

    res.json({
      message: 'Image uploaded successfully.',
      path: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

// ─── CATEGORIES: List all ───────────────────────────────────────────────────

router.get('/categories', requireAdmin, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.display_order ASC
    `).all();

    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// ─── CATEGORIES: Create ─────────────────────────────────────────────────────

router.post('/categories', requireAdmin, (req, res) => {
  try {
    const { name, slug, icon, display_order } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Category name and slug are required.' });
    }

    const result = db.prepare(
      'INSERT INTO categories (name, slug, icon, display_order) VALUES (?, ?, ?, ?)'
    ).run(name, slug, icon || '', display_order || 0);

    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCat);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name or slug already exists.' });
    }
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// ─── CATEGORIES: Update ─────────────────────────────────────────────────────

router.put('/categories/:id', requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const { name, slug, icon, display_order } = req.body;

    db.prepare(`
      UPDATE categories SET name = ?, slug = ?, icon = ?, display_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || existing.name,
      slug || existing.slug,
      icon !== undefined ? icon : existing.icon,
      display_order !== undefined ? display_order : existing.display_order,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A category with this name or slug already exists.' });
    }
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// ─── CATEGORIES: Delete ─────────────────────────────────────────────────────

router.delete('/categories/:id', requireAdmin, (req, res) => {
  try {
    const productCount = db.prepare(
      'SELECT COUNT(*) AS count FROM products WHERE category_id = ?'
    ).get(req.params.id).count;

    if (productCount > 0) {
      return res.status(409).json({
        error: `Cannot delete category: ${productCount} product(s) still assigned to it. Reassign or delete them first.`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category.' });
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
