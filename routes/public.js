/* ==========================================================================
   PUBLIC API ROUTES — Read-only product & category endpoints
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─── GET /api/products — All published products with category info ──────────
router.get('/products', async (req, res) => {
  try {
    const products = await db.query(`
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
    `);

    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products. ' + (err.message || '') });
  }
});

// ─── GET /api/products/:id — Single published product ───────────────────────
router.get('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const product = await db.queryOne(`
      SELECT 
        p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.status = 'published'
    `, [id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product. ' + (err.message || '') });
  }
});

// ─── GET /api/categories — All categories with published product counts ─────
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT 
        c.id, c.name, c.slug, c.icon, c.display_order,
        COUNT(CASE WHEN p.status = 'published' THEN 1 END) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.slug, c.icon, c.display_order
      ORDER BY c.display_order ASC, c.name ASC
    `);

    // Ensure product_count is integer across both PG and SQLite
    const normalized = categories.map(cat => ({
      ...cat,
      product_count: parseInt(cat.product_count || 0, 10)
    }));

    res.json(normalized);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories. ' + (err.message || '') });
  }
});

module.exports = router;
