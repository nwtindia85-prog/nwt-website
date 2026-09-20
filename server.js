/* ==========================================================================
   SERVER — Express entry point
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { authMiddleware } = require('./middleware/auth');

// Load .env file manually (no dotenv dependency needed)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// ─── Express Proxy Configuration (Vercel Compatibility) ────────────────────
// Trust first proxy hop (Vercel Edge reverse proxy)
// This resolves the ValidationError with X-Forwarded-For in express-rate-limit
app.set('trust proxy', 1);

// ─── Security Headers ──────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ─── Body Parsing ───────────────────────────────────────────────────────────

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Authentication Middleware ──────────────────────────────────────────────
// Replaces in-memory express-session with stateless cryptographically signed tokens.
// Eliminates the "MemoryStore is not designed for a production environment" warning
// and ensures seamless authentication across serverless lambda instances.
app.use(authMiddleware);

// ─── Rate Limiting on Login ─────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false } // Avoid false positives when trust proxy is 1
});

app.use('/api/admin/login', loginLimiter);

// ─── Static Files ───────────────────────────────────────────────────────────

// Serve uploaded product images (from persistent local directory and temp directory)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (isVercel) {
  app.use('/uploads', express.static(path.join(os.tmpdir(), 'uploads')));
}

// Serve existing assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ─── API Routes ─────────────────────────────────────────────────────────────

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// ─── Admin Dashboard Route ─────────────────────────────────────────────────
// noindex, nofollow headers to prevent search engine indexing

app.use('/secure-admin', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.get('/secure-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.use('/secure-admin', express.static(path.join(__dirname, 'admin')));

// ─── Public Pages ───────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/products.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'products.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve other static HTML pages or files at root level
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// ─── 404 Handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>404 - Page Not Found</title>
    <style>body{font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0F172A;color:#CBD5E1;}
    .box{text-align:center;}.box h1{font-size:6rem;margin:0;background:linear-gradient(135deg,#3B82F6,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
    .box p{font-size:1.2rem;margin:1rem 0 2rem;}.box a{color:#3B82F6;text-decoration:none;font-weight:600;}</style></head>
    <body><div class="box"><h1>404</h1><p>Page not found</p><a href="/">← Back to Home</a></div></body></html>
  `);
});

// ─── Error Handler ──────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error: ' + (err.message || 'Unknown error') });
});

// ─── Start Server / Export for Serverless ───────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   North Wide Traders — Server Started            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║   🌐 Public:  http://localhost:${PORT}              ║`);
    console.log(`║   🔒 Admin:   http://localhost:${PORT}/secure-admin  ║`);
    console.log('╚══════════════════════════════════════════════════╝\n');
  });
}

module.exports = app;
