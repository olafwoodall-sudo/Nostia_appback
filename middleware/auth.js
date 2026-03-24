const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../database/db');

// Remove expired entries from the blacklist (called periodically)
function pruneTokenBlacklist() {
  db.prepare('DELETE FROM token_blacklist WHERE expiresAt < CURRENT_TIMESTAMP').run();
}

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check if token has been revoked (logged out server-side)
    const revoked = db.prepare('SELECT id FROM token_blacklist WHERE token = ?').get(token);
    if (revoked) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  });
}

// Optional authentication (doesn't fail if no token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
    });
  }

  next();
}

// Require valid consent middleware
function requireConsent(req, res, next) {
  const Consent = require('../models/Consent');
  const ConsentService = require('../services/consentService');

  const consent = Consent.getCurrentConsent(req.user.id);
  const currentVersion = ConsentService.getCurrentConsentVersion();

  if (!consent || consent.consentVersion !== currentVersion || !consent.locationConsent) {
    return res.status(403).json({
      error: 'Consent required',
      consentRequired: true,
      currentVersion
    });
  }
  next();
}

// Require analytics access (admin or active subscription)
function requireAnalyticsAccess(req, res, next) {
  const AnalyticsSubscription = require('../models/AnalyticsSubscription');
  const User = require('../models/User');

  const user = User.findById(req.user.id);
  if (user && user.role === 'admin') return next();

  const sub = AnalyticsSubscription.getByUser(req.user.id);
  if (sub && sub.status === 'active') return next();

  return res.status(403).json({ error: 'Analytics access required. Subscribe or contact admin.' });
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireConsent,
  requireAnalyticsAccess,
  pruneTokenBlacklist,
  JWT_SECRET
};
