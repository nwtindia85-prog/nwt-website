/* ==========================================================================
   SEED — Migrate existing 21 hard-coded products into the database
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const path = require('path');
const Database = require('better-sqlite3');

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  throw new Error('db/seed.js is a local development seed script. Use db/migrate-to-postgres.js for PostgreSQL.');
}

const db = new Database(path.join(__dirname, '..', 'data', 'catalogue.db'));

console.log('🌱 Seeding database with existing catalogue data...\n');

// ─── Categories ─────────────────────────────────────────────────────────────

const categories = [
  { name: 'Scientific Equipment', slug: 'scientific', icon: 'fas fa-microscope', order: 1 },
  { name: 'Chemicals',           slug: 'chemicals',  icon: 'fas fa-flask',      order: 2 },
  { name: 'Glassware',           slug: 'glassware',  icon: 'fas fa-vial',       order: 3 },
  { name: 'Furniture',           slug: 'furniture',  icon: 'fas fa-chair',      order: 4 },
  { name: 'IT Products',         slug: 'computers',  icon: 'fas fa-laptop',     order: 5 },
  { name: 'Printers',            slug: 'printers',   icon: 'fas fa-print',      order: 6 },
  { name: 'Office Supplies',     slug: 'office',     icon: 'fas fa-box-open',   order: 7 },
];

const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, slug, icon, display_order) 
  VALUES (?, ?, ?, ?)
`);

const catMap = {};
const insertCategories = db.transaction(() => {
  for (const cat of categories) {
    insertCategory.run(cat.name, cat.slug, cat.icon, cat.order);
  }
  // Build slug → id map
  const rows = db.prepare('SELECT id, slug FROM categories').all();
  for (const r of rows) {
    catMap[r.slug] = r.id;
  }
});

insertCategories();
console.log(`✅ ${Object.keys(catMap).length} categories created.\n`);

// ─── Products ───────────────────────────────────────────────────────────────

const products = [
  // SCIENTIFIC EQUIPMENT
  {
    name: 'Digital Analytical Balance',
    category: 'scientific',
    badge_text: 'Scientific',
    grade_badge_text: 'ISO & CE Certified',
    grade_badge_icon: 'fas fa-certificate',
    short_description: 'High-precision electromagnetic balance with 220g capacity, 0.1mg readability, internal auto-calibration, draft shield glass chamber, and backlit digital LCD.',
    image_path: 'assets/images/balance.jpg',
    whatsapp_text: 'Inquiry%20for%20Digital%20Analytical%20Balance',
  },
  {
    name: 'Microprocessor Benchtop pH Meter',
    category: 'scientific',
    badge_text: 'Scientific',
    grade_badge_text: 'Multi-Point Calibrated',
    grade_badge_icon: 'fas fa-certificate',
    short_description: 'Microprocessor-based digital benchtop pH/mV/temperature meter (0.00–14.00 pH range) with automatic buffer recognition, combined glass electrode, and articulating stand.',
    image_path: 'assets/images/ph_meter.jpg',
    whatsapp_text: 'Inquiry%20for%20Microprocessor%20Benchtop%20pH%20Meter',
  },
  {
    name: 'High-Speed Laboratory Centrifuge',
    category: 'scientific',
    badge_text: 'Scientific',
    grade_badge_text: 'Brushless Motor',
    grade_badge_icon: 'fas fa-certificate',
    short_description: 'Digital benchtop high-speed centrifuge with speeds up to 16,000 RPM, digital LED timer, safety electronic lid interlock, imbalance detection, and angle rotors.',
    image_path: 'assets/images/centrifuge.jpg',
    whatsapp_text: 'Inquiry%20for%20Laboratory%20Centrifuge',
  },

  // CHEMICALS
  {
    name: 'Analytical Grade (AR) Chemical Reagents',
    category: 'chemicals',
    badge_text: 'Chemicals',
    grade_badge_text: '99.8%+ AR Purity',
    grade_badge_icon: 'fas fa-flask',
    short_description: 'Certified Analytical Reagent (AR) grade chemical salts, indicators, and volumetric standard solutions conforming to ACS/ISO analytical laboratory standards.',
    image_path: 'assets/images/ar_reagents.jpg',
    whatsapp_text: 'Inquiry%20for%20Analytical%20Reagents',
  },
  {
    name: 'Research Grade Solvents (HPLC / Spectroscopy)',
    category: 'chemicals',
    badge_text: 'Chemicals',
    grade_badge_text: 'HPLC & Spectroscopy',
    grade_badge_icon: 'fas fa-vial-virus',
    short_description: 'High-purity organic solvents (Methanol, Acetonitrile, Acetone, Isopropanol) with sub-micron filtration, low UV absorbance cut-off, and minimal non-volatile residue.',
    image_path: 'assets/images/hplc_solvents.jpg',
    whatsapp_text: 'Inquiry%20for%20HPLC%20Solvents',
  },
  {
    name: 'Standard Laboratory Acids & Bases Set',
    category: 'chemicals',
    badge_text: 'Chemicals',
    grade_badge_text: 'UN Safety Packaged',
    grade_badge_icon: 'fas fa-shield-halved',
    short_description: 'Standard laboratory reagents: Concentrated Sulphuric Acid (98%), Hydrochloric Acid (37%), Nitric Acid (70%), and Sodium Hydroxide pellets in secure safety containment.',
    image_path: 'assets/images/lab_acids.jpg',
    whatsapp_text: 'Inquiry%20for%20Laboratory%20Acids',
  },

  // GLASSWARE
  {
    name: 'Borosilicate 3.3 Beakers & Flasks Set',
    category: 'glassware',
    badge_text: 'Glassware',
    grade_badge_text: 'Borosilicate 3.3 Glass',
    grade_badge_icon: 'fas fa-glass-water',
    short_description: 'Thermal shock resistant low-expansion borosilicate 3.3 Griffin low-form beakers (50ml–1000ml) and Erlenmeyer conical flasks with permanent white enamel graduations.',
    image_path: 'assets/images/beakers_flasks.jpg',
    whatsapp_text: 'Inquiry%20for%20Borosilicate%20Beakers',
  },
  {
    name: 'Class A Volumetric Flasks with Glass Stopper',
    category: 'glassware',
    badge_text: 'Glassware',
    grade_badge_text: 'Class A Certified',
    grade_badge_icon: 'fas fa-award',
    short_description: 'Certified Class A precision volumetric flasks with individual calibration certificate, ground glass stoppers, meniscus line calibration, and chemical durability.',
    image_path: 'assets/images/volumetric_flasks.jpg',
    whatsapp_text: 'Inquiry%20for%20Volumetric%20Flasks',
  },
  {
    name: 'Sterile Petri Dishes & Plastic Consumables',
    category: 'glassware',
    badge_text: 'Plasticware',
    grade_badge_text: 'Gamma Sterilized',
    grade_badge_icon: 'fas fa-circle-dot',
    short_description: 'Optically clear polystyrene sterile 90mm petri dishes with ventilation ribs, universal micropipette tips (10µl, 200µl, 1000µl), and conical centrifuge tubes.',
    image_path: 'assets/images/petri_dishes.jpg',
    whatsapp_text: 'Inquiry%20for%20Petri%20Dishes',
  },

  // FURNITURE
  {
    name: 'Heavy-Duty Laboratory Island Workbench',
    category: 'furniture',
    badge_text: 'Furniture',
    grade_badge_text: 'Modular CRCA Steel',
    grade_badge_icon: 'fas fa-table',
    short_description: 'Heavy-gauge modular laboratory island workstation with 19mm chemical-resistant epoxy resin work surface, reagent raceway shelving, PP sink, and 3-way water fixtures.',
    image_path: 'assets/images/lab_workbench.jpg',
    whatsapp_text: 'Inquiry%20for%20Lab%20Workbench',
  },
  {
    name: 'Anti-Vibration Analytical Balance Table',
    category: 'furniture',
    badge_text: 'Furniture',
    grade_badge_text: 'Granite Core Isolation',
    grade_badge_icon: 'fas fa-shield-halved',
    short_description: 'High-density polished granite slab weighing platform isolated with dampening neoprene mounts on heavy tubular steel framework for micro-balance precision.',
    image_path: 'assets/images/balance_table.jpg',
    whatsapp_text: 'Inquiry%20for%20Anti-vibration%20Table',
  },
  {
    name: 'Corrosive Chemical Storage Cabinet',
    category: 'furniture',
    badge_text: 'Furniture',
    grade_badge_text: 'Fire & Acid Resistant',
    grade_badge_icon: 'fas fa-door-closed',
    short_description: 'Double-wall welded steel chemical storage cabinet with 38mm insulating air barrier, dual flame arrestor vents, 3-point locking system, and containment leak sills.',
    image_path: 'assets/images/chemical_cabinet.jpg',
    whatsapp_text: 'Inquiry%20for%20Chemical%20Cabinet',
  },

  // IT PRODUCTS
  {
    name: 'Commercial Desktop Computer Tower',
    category: 'computers',
    badge_text: 'IT Products',
    grade_badge_text: 'Enterprise Workstation',
    grade_badge_icon: 'fas fa-desktop',
    short_description: 'High-performance commercial desktop PC with Intel Core i5/i7 processor, 16GB DDR4 RAM, 512GB NVMe SSD, multiple USB 3.2 ports, Gigabit LAN, and Windows 11 Pro.',
    image_path: 'assets/images/desktop_pc.jpg',
    whatsapp_text: 'Inquiry%20for%20Desktop%20PC',
  },
  {
    name: 'Professional Business Laptop',
    category: 'computers',
    badge_text: 'IT Products',
    grade_badge_text: 'Commercial Series',
    grade_badge_icon: 'fas fa-laptop',
    short_description: 'Robust 14-inch Full HD anti-glare business laptop with Intel Core processor, 16GB RAM, all-day battery endurance, hardware TPM 2.0 security, and HD privacy webcam.',
    image_path: 'assets/images/business_laptop.jpg',
    whatsapp_text: 'Inquiry%20for%20Business%20Laptop',
  },
  {
    name: 'Full HD IPS Monitor (24 / 27 inch)',
    category: 'computers',
    badge_text: 'IT Products',
    grade_badge_text: 'Frameless IPS Panel',
    grade_badge_icon: 'fas fa-display',
    short_description: 'Ultra-slim bezel Full HD (1920x1080) IPS display with HDMI and DisplayPort connectivity, 99% sRGB color accuracy, flicker-free low blue light, and tilt stand.',
    image_path: 'assets/images/ips_monitor.jpg',
    whatsapp_text: 'Inquiry%20for%20FHD%20Monitor',
  },

  // PRINTERS
  {
    name: 'Multifunction Heavy-Duty Laser Printer',
    category: 'printers',
    badge_text: 'Printers',
    grade_badge_text: 'High-Speed Network',
    grade_badge_icon: 'fas fa-print',
    short_description: 'Heavy-duty commercial all-in-one laser printer (print, scan, copy) with automatic 50-sheet ADF, duplex double-sided printing, Ethernet, and Wi-Fi Direct.',
    image_path: 'assets/images/laser_printer.jpg',
    whatsapp_text: 'Inquiry%20for%20Multifunction%20Printer',
  },
  {
    name: 'Thermal Barcode & Label Printer',
    category: 'printers',
    badge_text: 'Printers',
    grade_badge_text: 'Direct Thermal & TT',
    grade_badge_icon: 'fas fa-barcode',
    short_description: 'High-resolution thermal barcode and label printer (203/300 DPI) for scientific sample tubes, specimen identification, shelf tags, and asset tracking.',
    image_path: 'assets/images/barcode_printer.jpg',
    whatsapp_text: 'Inquiry%20for%20Barcode%20Printer',
  },
  {
    name: 'Original High-Yield Toner Cartridges',
    category: 'printers',
    badge_text: 'Consumables',
    grade_badge_text: 'Certified OEM Quality',
    grade_badge_icon: 'fas fa-fill-drip',
    short_description: 'Precision high-yield laser toner cartridges and imaging supplies engineered for crisp monochrome and colour reproduction with certified tamper-evident packaging.',
    image_path: 'assets/images/toner_cartridges.jpg',
    whatsapp_text: 'Inquiry%20for%20Toner%20Cartridges',
  },

  // OFFICE
  {
    name: 'Heavy-Duty Cross-Cut Paper Shredder',
    category: 'office',
    badge_text: 'Office',
    grade_badge_text: 'DIN P-4 Security',
    grade_badge_icon: 'fas fa-file-shield',
    short_description: 'High-security cross-cut paper shredder with 15-sheet shredding capacity, credit card and staple destruction, continuous duty cycle, and 25-litre pull-out waste bin.',
    image_path: 'assets/images/paper_shredder.jpg',
    whatsapp_text: 'Inquiry%20for%20Paper%20Shredder',
  },
  {
    name: 'Magnetic Ceramic Whiteboard with Stand',
    category: 'office',
    badge_text: 'Office',
    grade_badge_text: 'Scratch-Resistant Steel',
    grade_badge_icon: 'fas fa-chalkboard',
    short_description: 'Vitreous ceramic steel non-ghosting magnetic dry-erase whiteboard mounted on heavy-duty mobile stand with 360-degree lockable castors and aluminum marker tray.',
    image_path: 'assets/images/whiteboard.jpg',
    whatsapp_text: 'Inquiry%20for%20Magnetic%20Whiteboard',
  },
  {
    name: 'Complete Institutional Office Stationery Kit',
    category: 'office',
    badge_text: 'Office',
    grade_badge_text: 'Comprehensive Kit',
    grade_badge_icon: 'fas fa-box-archive',
    short_description: 'Bulk administrative package: 75/80 GSM copier paper reams, heavy-duty lever arch files, document folders, permanent markers, staplers, and desk accessories.',
    image_path: 'assets/images/stationery_kit.jpg',
    whatsapp_text: 'Inquiry%20for%20Office%20Stationery%20Kit',
  },
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products 
    (name, category_id, badge_text, grade_badge_text, grade_badge_icon, short_description, image_path, whatsapp_text, status)
  VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, 'published')
`);

const insertProducts = db.transaction(() => {
  let count = 0;
  for (const p of products) {
    const catId = catMap[p.category];
    if (!catId) {
      console.error(`  ❌ Category "${p.category}" not found for product "${p.name}"`);
      continue;
    }
    const result = insertProduct.run(
      p.name, catId, p.badge_text, p.grade_badge_text, p.grade_badge_icon,
      p.short_description, p.image_path, p.whatsapp_text
    );
    if (result.changes > 0) count++;
  }
  return count;
});

const insertedCount = insertProducts();
console.log(`✅ ${insertedCount} products seeded (status: published).\n`);
console.log('🎉 Database seeding complete!\n');

db.close();
