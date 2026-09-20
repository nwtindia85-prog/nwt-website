/* ==========================================================================
   PUBLIC API ROUTES — Read-only product & category endpoints
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─── GET /api/products — All published products with category info ──────────
router.get('/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT 
        p.id, p.name, p.category_id, p.type, p.short_description, p.full_description,
        p.image_path, p.additional_images, p.specifications, p.brochure_path,
        p.sku, p.brand, p.badge_text, p.grade_badge_text, p.grade_badge_icon,
        p.whatsapp_text, p.status, p.created_at, p.updated_at,
        c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
      ORDER BY c.display_order ASC, p.name ASC
    `).all();

    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// ─── GET /api/products/:id — Single published product ───────────────────────
router.get('/products/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT 
        p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.status = 'published'
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

// ─── GET /api/categories — All categories with published product counts ─────
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id, c.name, c.slug, c.icon, c.display_order,
        COUNT(CASE WHEN p.status = 'published' THEN 1 END) AS product_count
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

module.exports = router;
