/* ==========================================================================
   AUTH MIDDLEWARE — Stateless signed token authentication guard
   North Wide Traders India OPC Private Limited
   ========================================================================== */

const crypto = require('crypto');

function getSecret() {
  return process.env.SESSION_SECRET || 'nwt-admin-secret-default-key-change-in-prod';
}

/**
 * Generate a cryptographically signed HMAC-SHA256 token for an authenticated user.
 */
function generateToken(user) {
  const payload = {
    userId: user.id || user.userId,
    username: user.username,
    role: user.role || 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify and decode an HMAC-SHA256 token.
 */
function verifyToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Extract auth token from Cookie or Authorization header.
 */
function extractToken(req) {
  // 1. Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check Cookie header: "nwt_token=<token>"
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, ...valParts] = cookie.trim().split('=');
      if (name === 'nwt_token') {
        return valParts.join('=').trim();
      }
    }
  }

  return null;
}

/**
 * Middleware that parses token into req.session and req.user
 */
function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.session = {
        userId: user.userId,
        username: user.username,
        role: user.role
      };
      req.user = req.session;
      return next();
    }
  }

  req.session = {};
  req.user = null;
  next();
}

/**
 * Route guard checking for a valid admin session.
 * Returns 401 if not authenticated, 403 if not admin role.
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access only.' });
  }

  next();
}

/**
 * Set HttpOnly authentication cookie on response.
 */
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const cookieOptions = [
    `nwt_token=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${24 * 60 * 60}`
  ];
  if (isProd) {
    cookieOptions.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

/**
 * Clear authentication cookie.
 */
function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const cookieOptions = [
    'nwt_token=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isProd) {
    cookieOptions.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

module.exports = {
  authMiddleware,
  requireAdmin,
  generateToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie
};
