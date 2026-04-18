require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
// Validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

// Import middleware
const { generateToken, authenticateToken, optionalAuth, requireConsent, requireAnalyticsAccess, pruneTokenBlacklist, JWT_SECRET } = require('./middleware/auth');

const db = require('./database/db');

// Import models
const User = require('./models/User');
const Friend = require('./models/Friend');
const Trip = require('./models/Trip');
const Event = require('./models/Event');
const Vault = require('./models/Vault');
const Feed = require('./models/Feed');
const Adventure = require('./models/Adventure');
const Message = require('./models/Message');

// Import services
const NotificationService = require('./services/notificationService');
const { StripeService, calculateChargedAmount } = require('./services/stripeService');
const Payment = require('./models/Payment');
const Consent = require('./models/Consent');
const ConsentService = require('./services/consentService');
const AnalyticsEvent = require('./models/AnalyticsEvent');
const AnalyticsSession = require('./models/AnalyticsSession');
const AnalyticsAggregate = require('./models/AnalyticsAggregate');
const AnalyticsSubscription = require('./models/AnalyticsSubscription');
const AnalyticsService = require('./services/analyticsService');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust one proxy hop (Nginx) so X-Forwarded-For is used for rate limiting and IP logging
app.set('trust proxy', 1);

// ==================== SECURITY MIDDLEWARE ====================

// Security headers (HSTS, X-Frame-Options, etc.)
app.use(helmet());

// HTTPS enforcement in production
// Only redirect when x-forwarded-proto is explicitly 'http' (real browser traffic
// through DigitalOcean's load balancer). Internal health check probes have no
// x-forwarded-proto header and must not be redirected.
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] === 'http'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for data export (GDPR)
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: { error: 'Too many export requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for payment endpoints (10 attempts per 15 min)
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many payment requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search rate limiter (20 searches per minute — prevents user enumeration)
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many search requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Prune expired blacklisted tokens every hour
setInterval(pruneTokenBlacklist, 60 * 60 * 1000);

// Purge analytics raw data beyond retention period — runs once daily at startup + every 24h
function purgeAnalyticsAndAuditLogs() {
  try {
    AnalyticsService.purgeExpiredData();
  } catch (e) {
    console.error('[PURGE] Analytics purge failed:', e.message);
  }
  try {
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 90;
    db.prepare(
      `DELETE FROM audit_log WHERE createdAt < datetime('now', '-' || ? || ' days')`
    ).run(retentionDays);
  } catch (e) {
    console.error('[PURGE] Audit log purge failed:', e.message);
  }
}
purgeAnalyticsAndAuditLogs();
setInterval(purgeAnalyticsAndAuditLogs, 24 * 60 * 60 * 1000);

app.use('/api/', apiLimiter);

// Standard middleware
const corsOptions = process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGINS
  ? { origin: process.env.ALLOWED_ORIGINS.split(',') }
  : {};
app.use(cors(corsOptions));

// Stripe webhook must receive raw body — registered before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    await StripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.use(express.json({ limit: '25mb' }));

// ==================== LOGGING MIDDLEWARE ====================

// Structured request logging (reduced in production to save CPU/storage)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;
      const logEntry = `${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms | IP: ${req.ip}`;
      console.log(logEntry);
      originalEnd.apply(res, args);
    };
    next();
  });
}

// Audit logger for sensitive actions (logs to console + DB)
function auditLog(action, userId, details = {}, req = null) {
  const { ipAddress, ...rest } = details;
  const ip = ipAddress || req?.ip || null;
  const safeDetails = JSON.stringify(rest);
  console.log(`[AUDIT] ${new Date().toISOString()} | ${action} | user:${userId} | ip:${ip} | ${safeDetails}`);
  try {
    db.prepare(
      'INSERT INTO audit_log (action, userId, ipAddress, details) VALUES (?, ?, ?, ?)'
    ).run(action, userId || null, ip, safeDetails);
  } catch (e) {
    console.error('[AUDIT] Failed to write to DB:', e.message);
  }
}

// ==================== ANALYTICS KILL-SWITCH ====================
function analyticsEnabled() {
  return process.env.ANALYTICS_ENABLED !== 'false';
}

// ==================== HEALTH CHECK ====================
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Nostia MVP Backend API',
    version: '1.0.0',
    features: [
      'Friend Integration',
      'Social Feed & Events',
      'Trip Planning + Vault',
      'Adventure Discovery',
      'AI-powered content generation',
      'User Consent & Access Control',
      'Analytics & Data Collection',
      'Data Aggregation & Heatmaps',
      'Analytics Monetization',
      'GDPR/CCPA Compliance'
    ]
  });
});

// Dedicated health check endpoint for DigitalOcean App Platform
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==================== AUTHENTICATION ROUTES ====================

// Register new user (requires location and data collection consent)
app.post('/api/auth/register', authLimiter, [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters').matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('locationConsent').custom((value) => value === true).withMessage('Location consent is required'),
  body('dataCollectionConsent').custom((value) => value === true).withMessage('Data collection consent is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { username, email, password, name, locationConsent, dataCollectionConsent } = req.body;

    // Check if user already exists
    const existingUser = User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (email) {
      const existingEmail = User.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Create user
    const user = User.create({ username, email, password, name });

    // Record consent
    const consentVersion = ConsentService.getCurrentConsentVersion();
    const privacyPolicyVersion = ConsentService.getPrivacyPolicyVersion();
    Consent.create(user.id, {
      consentVersion,
      locationConsent: true,
      dataCollectionConsent: true,
      privacyPolicyVersion,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user (need password for verification)
    const userWithPassword = User.findByUsername(username);
    if (!userWithPassword) {
      auditLog('AUTH_FAILURE', null, { reason: 'user_not_found', username, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = User.verifyPassword(password, userWithPassword.password);
    if (!isPasswordValid) {
      auditLog('AUTH_FAILURE', userWithPassword.id, { reason: 'invalid_password', username, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Remove password from response
    const user = User.findById(userWithPassword.id);

    // Generate token
    const token = generateToken(user);

    auditLog('AUTH_SUCCESS', user.id, { username, ip: req.ip });

    res.json({
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout — revokes JWT server-side by adding it to the blacklist
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT OR IGNORE INTO token_blacklist (token, userId, expiresAt) VALUES (?, ?, ?)'
      ).run(token, req.user.id, expiresAt);
    }
    auditLog('AUTH_LOGOUT', req.user.id, {}, req);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
app.get('/api/users/me', authenticateToken, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users (for adding friends) — must be before /api/users/:id
app.get('/api/users/search', authenticateToken, searchLimiter, (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const lowerQuery = query.toLowerCase();
    const users = User.getAll();
    const results = users.filter(user =>
      user.id !== req.user.id && (
        (user.username && user.username.toLowerCase().includes(lowerQuery)) ||
        (user.name && user.name.toLowerCase().includes(lowerQuery))
      )
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public profile by user ID
app.get('/api/users/:id', authenticateToken, (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update current user
app.put('/api/users/me', authenticateToken, (req, res) => {
  try {
    const updates = req.body;
    const user = User.update(req.user.id, updates);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONSENT ROUTES ====================

// Get current consent version (public)
app.get('/api/consent/current-version', (req, res) => {
  res.json({
    consentVersion: ConsentService.getCurrentConsentVersion(),
    privacyPolicyVersion: ConsentService.getPrivacyPolicyVersion()
  });
});

// Get current consent status
app.get('/api/consent', authenticateToken, (req, res) => {
  try {
    const consent = Consent.getCurrentConsent(req.user.id);
    const currentVersion = ConsentService.getCurrentConsentVersion();
    res.json({
      consent,
      currentVersion,
      isValid: consent ? (consent.consentVersion === currentVersion && !!consent.locationConsent) : false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record consent
app.post('/api/consent', authenticateToken, (req, res) => {
  try {
    const { locationConsent, dataCollectionConsent } = req.body;

    const validation = ConsentService.validateConsentPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const consentVersion = ConsentService.getCurrentConsentVersion();
    const privacyPolicyVersion = ConsentService.getPrivacyPolicyVersion();

    const consent = Consent.create(req.user.id, {
      consentVersion,
      locationConsent,
      dataCollectionConsent,
      privacyPolicyVersion,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ consent, message: 'Consent recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke consent
app.post('/api/consent/revoke', authenticateToken, (req, res) => {
  try {
    const result = Consent.revoke(req.user.id);
    res.json({ message: 'Consent revoked. App access will be restricted.', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get consent history
app.get('/api/consent/history', authenticateToken, (req, res) => {
  try {
    const history = Consent.getConsentHistory(req.user.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FRIEND ROUTES ====================

// Get all friends
app.get('/api/friends', authenticateToken, (req, res) => {
  try {
    const friends = Friend.getFriends(req.user.id);
    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending friend requests
app.get('/api/friends/requests', authenticateToken, (req, res) => {
  try {
    const received = Friend.getPendingRequests(req.user.id);
    const sent = Friend.getSentRequests(req.user.id);
    res.json({ received, sent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    const request = Friend.sendRequest(req.user.id, friendId);
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Accept friend request
app.post('/api/friends/accept/:requestId', authenticateToken, (req, res) => {
  try {
    const { requestId } = req.params;

    // Verify the request is addressed to the authenticated user
    const friendRequest = Friend.getById(requestId);
    if (!friendRequest || friendRequest.friendId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to accept this request' });
    }

    const request = Friend.acceptRequest(requestId);
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject friend request
app.delete('/api/friends/reject/:requestId', authenticateToken, (req, res) => {
  try {
    const { requestId } = req.params;

    // Verify the request is addressed to the authenticated user
    const friendRequest = Friend.getById(requestId);
    if (!friendRequest || friendRequest.friendId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this request' });
    }

    Friend.rejectRequest(requestId);
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove friend
app.delete('/api/friends/:friendId', authenticateToken, (req, res) => {
  try {
    const { friendId } = req.params;
    Friend.removeFriend(req.user.id, friendId);
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get friends' locations (only those who have granted location consent)
app.get('/api/friends/locations', authenticateToken, (req, res) => {
  try {
    const db = require('./database/db');
    const locations = db.prepare(`
      SELECT u.id, u.username, u.name, u.latitude, u.longitude, u.updatedAt
      FROM users u
      INNER JOIN friends f ON (
        (f.userId = ? AND f.friendId = u.id) OR
        (f.friendId = ? AND f.userId = u.id)
      )
      WHERE f.status = 'accepted'
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND u.locationConsentGranted = 1
    `).all(req.user.id, req.user.id);
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRIP ROUTES ====================

// Get all trips for current user
app.get('/api/trips', authenticateToken, (req, res) => {
  try {
    const trips = Trip.getUserTrips(req.user.id);
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's pending trip invitations (must be before /api/trips/:id)
app.get('/api/trips/invitations', authenticateToken, (req, res) => {
  try {
    const invitations = Trip.getUserInvitations(req.user.id);
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Respond to trip invitation (must be before /api/trips/:id)
app.post('/api/trips/invitations/:id/respond', authenticateToken, (req, res) => {
  try {
    const { accept } = req.body;
    const trip = Trip.respondToInvitation(req.params.id, req.user.id, accept);
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get trip by ID
app.get('/api/trips/:id', authenticateToken, (req, res) => {
  try {
    const trip = Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new trip
app.post('/api/trips', authenticateToken, (req, res) => {
  try {
    const tripData = {
      ...req.body,
      createdBy: req.user.id
    };

    const trip = Trip.create(tripData);
    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update trip
app.put('/api/trips/:id', authenticateToken, (req, res) => {
  try {
    const trip = Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (trip.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the trip creator can update this trip' });
    }
    const updated = Trip.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete trip
app.delete('/api/trips/:id', authenticateToken, (req, res) => {
  try {
    // Check if user is the trip creator
    const trip = Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (trip.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the trip creator can delete this trip' });
    }
    Trip.delete(req.params.id);
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add participant to trip
app.post('/api/trips/:id/participants', authenticateToken, (req, res) => {
  try {
    const { userId } = req.body;
    Trip.addParticipant(req.params.id, userId);
    const trip = Trip.findById(req.params.id);
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove participant from trip
app.delete('/api/trips/:id/participants/:userId', authenticateToken, (req, res) => {
  try {
    Trip.removeParticipant(req.params.id, req.params.userId);
    const trip = Trip.findById(req.params.id);
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer vault leader
app.post('/api/trips/:id/vault-leader', authenticateToken, (req, res) => {
  try {
    const { newLeaderId } = req.body;
    const trip = Trip.transferVaultLeader(req.params.id, newLeaderId, req.user.id);
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Invite user to trip
app.post('/api/trips/:id/invite', authenticateToken, (req, res) => {
  try {
    const { userId } = req.body;
    const trip = Trip.inviteUser(req.params.id, userId, req.user.id);
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== EVENT ROUTES ====================

// Get all events (filtered by visibility)
app.get('/api/events', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const events = Event.getAll(userId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming events
app.get('/api/events/upcoming', (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const events = Event.getUpcoming(limit);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get nearby events based on user location
app.get('/api/events/nearby', authenticateToken, (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius) || 50;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude' });
    }

    const events = Event.getNearbySimple(latitude, longitude, radiusKm, 20);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get event by ID
app.get('/api/events/:id', (req, res) => {
  try {
    const event = Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new event
app.post('/api/events', authenticateToken, (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user.id
    };

    const event = Event.create(eventData);
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update event
app.put('/api/events/:id', authenticateToken, (req, res) => {
  try {
    const event = Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can update this event' });
    }
    const updated = Event.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete event
app.delete('/api/events/:id', authenticateToken, (req, res) => {
  try {
    const event = Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can delete this event' });
    }
    Event.delete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== VAULT ROUTES ====================

// Get trip vault summary
app.get('/api/vault/trip/:tripId', authenticateToken, (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });
    const trip = Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: `Trip ${tripId} not found` });
    const summary = Vault.getTripSummary(tripId, req.user.id);
    summary.vaultLeaderId = trip.vaultLeaderId;
    summary.currentUserId = req.user.id;
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create vault entry (expense)
app.post('/api/vault', authenticateToken, (req, res) => {
  try {
    const { tripId, description, amount, currency, category, date, splits } = req.body;
    const paidBy = req.body.paidBy ?? req.user.id;

    let finalSplits = splits;

    // Auto-split equally among all trip participants when no splits provided
    if (!finalSplits || finalSplits.length === 0) {
      const trip = Trip.findById(tripId);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });

      const participants = trip.participants;
      if (participants.length > 0) {
        // Floor each split to cents, give remainder to last participant
        const each = Math.floor((amount / participants.length) * 100) / 100;
        const lastAmount = Math.round((amount - each * (participants.length - 1)) * 100) / 100;
        finalSplits = participants.map((p, i) => ({
          userId: p.id,
          amount: i === participants.length - 1 ? lastAmount : each,
        }));
      }
    }

    const entry = Vault.createEntry({ tripId, description, amount, currency, paidBy, category, date, splits: finalSplits });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark split as paid
app.put('/api/vault/splits/:splitId/paid', authenticateToken, (req, res) => {
  try {
    Vault.markSplitPaid(req.params.splitId);
    res.json({ message: 'Split marked as paid' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vault entry — vault leader only
app.delete('/api/vault/:id', authenticateToken, (req, res) => {
  try {
    const entry = Vault.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Expense not found' });
    const trip = Trip.findById(entry.tripId);
    if (!trip || trip.vaultLeaderId !== req.user.id) {
      return res.status(403).json({ error: 'Only the vault leader can delete expenses' });
    }
    Vault.deleteEntry(req.params.id);
    res.json({ message: 'Vault entry deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FEED ROUTES ====================

// Get user feed
app.get('/api/feed', authenticateToken, (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const posts = Feed.getUserFeed(req.user.id, limit);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public feed
app.get('/api/feed/public', (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const posts = Feed.getAll(limit);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create feed post
app.post('/api/feed', authenticateToken, (req, res) => {
  try {
    const postData = {
      ...req.body,
      userId: req.user.id
    };

    const post = Feed.createPost(postData);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete feed post
app.delete('/api/feed/:id', authenticateToken, (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM feed_posts WHERE id = ?').get(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Only the post author can delete this post' });
    }
    Feed.delete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a post
app.post('/api/feed/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const likeCount = Feed.likePost(postId, req.user.id);
    res.json({ success: true, likeCount, isLiked: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlike a post
app.delete('/api/feed/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const likeCount = Feed.unlikePost(postId, req.user.id);
    res.json({ success: true, likeCount, isLiked: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a post
app.get('/api/feed/:id/comments', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = Feed.getComments(postId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to a post
app.post('/api/feed/:id/comments', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = Feed.addComment(postId, req.user.id, content.trim());
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment
app.delete('/api/feed/comments/:id', authenticateToken, (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    Feed.deleteComment(commentId, req.user.id);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADVENTURE ROUTES ====================

// Get all adventures
app.get('/api/adventures', (req, res) => {
  try {
    const { category, difficulty, search } = req.query;

    let adventures;
    if (search) {
      adventures = Adventure.search(search);
    } else if (category) {
      adventures = Adventure.getByCategory(category);
    } else if (difficulty) {
      adventures = Adventure.getByDifficulty(difficulty);
    } else {
      adventures = Adventure.getAll();
    }

    res.json(adventures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get adventure by ID
app.get('/api/adventures/:id', (req, res) => {
  try {
    const adventure = Adventure.findById(req.params.id);
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }
    res.json(adventure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create adventure (any authenticated user)
app.post('/api/adventures', authenticateToken, (req, res) => {
  try {
    const adventure = Adventure.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(adventure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UTILITY ROUTES ====================

// ==================== NOTIFICATION ROUTES ====================

// Save push token
app.post('/api/push-token', authenticateToken, (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    NotificationService.savePushToken(req.user.id, token, platform || 'expo');
    res.json({ success: true, message: 'Push token saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove push token (on logout)
app.delete('/api/push-token', authenticateToken, (req, res) => {
  try {
    NotificationService.removePushToken(req.user.id);
    res.json({ success: true, message: 'Push token removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const notifications = NotificationService.getUserNotifications(req.user.id, limit);
    const unreadCount = NotificationService.getUnreadCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
  try {
    const count = NotificationService.getUnreadCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    NotificationService.markAsRead(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    NotificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MESSAGING ROUTES ====================

// Get all conversations for current user
app.get('/api/conversations', authenticateToken, (req, res) => {
  try {
    const conversations = Message.getUserConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get or create conversation with a user
app.post('/api/conversations', authenticateToken, (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }

    // Verify they are friends
    const friends = Friend.getFriends(req.user.id);
    const isFriend = friends.some(f => f.id === userId);
    if (!isFriend) {
      return res.status(400).json({ error: 'Can only message friends' });
    }

    const conversation = Message.getOrCreateConversation(req.user.id, userId);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages in a conversation
app.get('/api/conversations/:id/messages', authenticateToken, (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Verify user is part of this conversation
    const conv = Message.getConversationById(conversationId);
    if (!conv || (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to view this conversation' });
    }

    const messages = Message.getConversationMessages(conversationId, limit, offset);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message in a conversation
app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user is part of this conversation
    const conv = Message.getConversationById(conversationId);
    if (!conv || (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to send message in this conversation' });
    }

    const message = Message.sendMessage(conversationId, req.user.id, content.trim());

    // Send push notification to recipient
    const recipientId = conv.user1Id === req.user.id ? conv.user2Id : conv.user1Id;
    const sender = User.findById(req.user.id);
    NotificationService.sendMessageNotification(recipientId, sender.name, content.trim(), conversationId);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark conversation as read
app.put('/api/conversations/:id/read', authenticateToken, (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);

    // Verify user is part of this conversation
    const conv = Message.getConversationById(conversationId);
    if (!conv || (conv.user1Id !== req.user.id && conv.user2Id !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    Message.markConversationAsRead(conversationId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get total unread message count
app.get('/api/messages/unread-count', authenticateToken, (req, res) => {
  try {
    const count = Message.getUnreadCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS TRACKING ROUTES ====================

// Track a single event
app.post('/api/analytics/track', authenticateToken, requireConsent, (req, res) => {
  try {
    if (!analyticsEnabled()) {
      return res.json({ success: true, disabled: true });
    }

    const { sessionId, eventType, eventName, eventData, latitude, longitude, duration } = req.body;

    if (!sessionId || !eventType || !eventName) {
      return res.status(400).json({ error: 'sessionId, eventType, and eventName are required' });
    }

    const result = AnalyticsEvent.track({
      userId: req.user.id,
      sessionId,
      eventType,
      eventName,
      eventData,
      latitude,
      longitude,
      duration
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track multiple events at once
app.post('/api/analytics/track-batch', authenticateToken, requireConsent, (req, res) => {
  try {
    if (!analyticsEnabled()) {
      return res.json({ success: true, disabled: true });
    }

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    if (events.length > 500) {
      return res.status(400).json({ error: 'Batch size limit is 500 events per request' });
    }

    const enrichedEvents = events.map(evt => ({
      ...evt,
      userId: req.user.id
    }));

    const results = AnalyticsEvent.trackBatch(enrichedEvents);
    res.json({ success: true, tracked: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start a session
app.post('/api/analytics/session/start', authenticateToken, requireConsent, (req, res) => {
  try {
    if (!analyticsEnabled()) {
      return res.json({ success: true, disabled: true });
    }

    const { sessionId, platform, appVersion } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = AnalyticsSession.startSession(req.user.id, sessionId, platform, appVersion);
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End a session
app.post('/api/analytics/session/end', authenticateToken, requireConsent, (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = AnalyticsSession.endSession(sessionId);
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS DASHBOARD ROUTES ====================

// Dashboard summary
app.get('/api/analytics/dashboard', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const summary = AnalyticsService.getDashboardSummary(start, end);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Location heatmap data
app.get('/api/analytics/heatmap', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = AnalyticsEvent.getCountByRegion(start, end);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feature usage trends
app.get('/api/analytics/feature-usage', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = AnalyticsEvent.getCountByEventName(start, end);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retention cohorts
app.get('/api/analytics/retention', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const data = AnalyticsAggregate.getRetentionData(start, end);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversion funnels
app.get('/api/analytics/funnels', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = AnalyticsAggregate.getFunnelData(start, end);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session metrics
app.get('/api/analytics/sessions', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = AnalyticsSession.getSessionMetrics(start, end);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Regional engagement
app.get('/api/analytics/regional', authenticateToken, requireAnalyticsAccess, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const events = AnalyticsEvent.getDailyEventCounts(start, end);
    const regions = AnalyticsEvent.getCountByRegion(start, end);
    res.json({ dailyActivity: events, regionBreakdown: regions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS MONETIZATION ROUTES ====================

// Subscribe to analytics
app.post('/api/analytics/subscribe', authenticateToken, (req, res) => {
  try {
    const { plan } = req.body;

    if (!['basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose basic, pro, or enterprise.' });
    }

    const existing = AnalyticsSubscription.getByUser(req.user.id);
    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription' });
    }

    const subscription = AnalyticsSubscription.create(req.user.id, plan);
    res.status(201).json({ subscription, message: 'Subscription created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subscription status
app.get('/api/analytics/subscription', authenticateToken, (req, res) => {
  try {
    const subscription = AnalyticsSubscription.getByUser(req.user.id);
    res.json({ subscription, hasAccess: !!subscription && subscription.status === 'active' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
app.post('/api/analytics/subscription/cancel', authenticateToken, (req, res) => {
  try {
    AnalyticsSubscription.cancel(req.user.id);
    res.json({ message: 'Subscription canceled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase a downloadable report
app.post('/api/analytics/reports/purchase', authenticateToken, (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    if (!reportType) {
      return res.status(400).json({ error: 'reportType is required' });
    }

    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const report = AnalyticsService.generateDownloadableReport(reportType, start, end);

    // Store the report download record
    const stmt = db.prepare(`
      INSERT INTO report_downloads (userId, reportType, reportParams, generatedAt, amount)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    const result = stmt.run(
      req.user.id,
      reportType,
      JSON.stringify({ startDate: start, endDate: end }),
      9.99
    );

    res.json({ reportId: result.lastInsertRowid, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download a purchased report
app.get('/api/analytics/reports/download/:id', authenticateToken, (req, res) => {
  try {
    const reportDownload = db.prepare(`
      SELECT * FROM report_downloads WHERE id = ? AND userId = ?
    `).get(req.params.id, req.user.id);

    if (!reportDownload) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const params = JSON.parse(reportDownload.reportParams || '{}');
    const report = AnalyticsService.generateDownloadableReport(
      reportDownload.reportType,
      params.startDate,
      params.endDate
    );

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Trigger aggregation
app.post('/api/admin/analytics/aggregate', authenticateToken, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    auditLog('ADMIN_AGGREGATION', req.user.id, { reportType: req.body.reportType, ip: req.ip });
    const { reportType, startDate, endDate } = req.body;
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    if (reportType) {
      const results = AnalyticsService.runAggregation(reportType, start, end);
      res.json({ message: 'Aggregation complete', count: results.length });
    } else {
      // Run all aggregation types
      const types = ['daily_region', 'feature_usage', 'retention', 'funnel'];
      let totalCount = 0;
      for (const type of types) {
        const results = AnalyticsService.runAggregation(type, start, end);
        totalCount += results.length;
      }
      res.json({ message: 'All aggregations complete', count: totalCount });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger data purge
app.post('/api/admin/analytics/purge', authenticateToken, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    auditLog('ADMIN_DATA_PURGE', req.user.id, { ip: req.ip });
    const retentionDays = parseInt(req.body.retentionDays) || parseInt(process.env.DATA_RETENTION_DAYS) || 90;
    const result = AnalyticsService.purgeExpiredData(retentionDays);
    res.json({ message: 'Data purge complete', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set user role
app.put('/api/admin/users/:id/role', authenticateToken, (req, res) => {
  try {
    const adminUser = User.findById(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Choose user or admin.' });
    }

    auditLog('ADMIN_ROLE_CHANGE', req.user.id, { targetUserId: req.params.id, newRole: role, ip: req.ip });
    const updatedUser = User.update(parseInt(req.params.id), { role });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRIVACY & COMPLIANCE ROUTES ====================

// Get privacy policy
app.get('/api/privacy/policy', (req, res) => {
  res.json(ConsentService.getPrivacyPolicyText());
});

// Request data export (GDPR)
app.post('/api/privacy/data-request', authenticateToken, exportLimiter, (req, res) => {
  try {
    const userId = req.user.id;
    auditLog('DATA_EXPORT_REQUESTED', userId, { ip: req.ip });
    const user = User.findById(userId);

    // Gather all user data
    const userData = {
      profile: user,
      consents: Consent.getConsentHistory(userId),
      friends: Friend.getFriends(userId),
      trips: Trip.getUserTrips(userId),
      events: db.prepare('SELECT * FROM events WHERE createdBy = ?').all(userId),
      feedPosts: db.prepare('SELECT id, content, type, createdAt FROM feed_posts WHERE userId = ?').all(userId),
      messages: db.prepare(`
        SELECT m.* FROM messages m
        INNER JOIN conversations c ON m.conversationId = c.id
        WHERE c.user1Id = ? OR c.user2Id = ?
      `).all(userId, userId),
      analyticsEvents: db.prepare('SELECT id, eventType, eventName, createdAt FROM analytics_events WHERE userId = ?').all(userId),
      notifications: db.prepare('SELECT * FROM notifications WHERE userId = ?').all(userId)
    };

    // Store export as a report download for retrieval
    const stmt = db.prepare(`
      INSERT INTO report_downloads (userId, reportType, reportParams, generatedAt)
      VALUES (?, 'data_export', ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(userId, JSON.stringify(userData));

    res.json({
      message: 'Data export generated',
      exportId: result.lastInsertRowid,
      downloadUrl: `/api/privacy/data-export/${result.lastInsertRowid}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download data export
app.get('/api/privacy/data-export/:id', authenticateToken, (req, res) => {
  try {
    const exportRecord = db.prepare(`
      SELECT * FROM report_downloads WHERE id = ? AND userId = ? AND reportType = 'data_export'
    `).get(req.params.id, req.user.id);

    if (!exportRecord) {
      return res.status(404).json({ error: 'Export not found' });
    }

    const data = JSON.parse(exportRecord.reportParams);
    res.json({
      exportedAt: exportRecord.generatedAt,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request data deletion (GDPR/CCPA)
app.post('/api/privacy/delete-data', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    auditLog('DATA_DELETION_REQUESTED', userId, { ip: req.ip });

    // Anonymize analytics data (keep aggregates, remove PII)
    db.prepare('UPDATE analytics_events SET userId = NULL, latitude = NULL, longitude = NULL WHERE userId = ?').run(userId);
    db.prepare('UPDATE analytics_sessions SET userId = NULL WHERE userId = ?').run(userId);

    // Delete personal data
    db.prepare('DELETE FROM user_consents WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM notifications WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM push_tokens WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM feed_posts WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM post_likes WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM post_comments WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM report_downloads WHERE userId = ?').run(userId);
    db.prepare('DELETE FROM analytics_subscriptions WHERE userId = ?').run(userId);

    // Delete the user account
    User.delete(userId);

    res.json({ message: 'All personal data has been deleted. Your account has been removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STRIPE CONNECT ROUTES ====================

// Create a SetupIntent so users can save a card for paying trip splits
app.post('/api/stripe/setup-intent', authenticateToken, async (req, res) => {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Get or create a Stripe customer for this user
    let user = db.prepare('SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(user.id) } });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    const [ephemeralKey, setupIntent] = await Promise.all([
      stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2024-04-10' }),
      stripe.setupIntents.create({ customer: customerId, usage: 'off_session' })
    ]);

    res.json({ clientSecret: setupIntent.client_secret, customerId, ephemeralKey: ephemeralKey.secret });
  } catch (error) {
    console.error('Setup intent error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save a payment method after SetupIntent completes
app.post('/api/stripe/payment-methods/save', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId is required' });

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    const isFirst = Payment.getUserPaymentMethods(req.user.id).length === 0;
    Payment.addPaymentMethod(req.user.id, paymentMethodId, {
      type: pm.type,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
      isDefault: isFirst
    });

    res.status(201).json({ message: 'Card saved' });
  } catch (error) {
    console.error('Save payment method error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Alias routes so iOS /stripe/payment-methods paths resolve correctly
app.get('/api/stripe/payment-methods', authenticateToken, (req, res) => {
  try { res.json(Payment.getUserPaymentMethods(req.user.id)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/stripe/payment-methods/:id', authenticateToken, (req, res) => {
  try { Payment.deletePaymentMethod(req.params.id, req.user.id); res.json({ message: 'Removed' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/stripe/payment-methods/:id/default', authenticateToken, (req, res) => {
  try { Payment.setDefaultPaymentMethod(req.user.id, req.params.id); res.json({ message: 'Default updated' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// Start Stripe Connect onboarding for vault creators
app.post('/api/stripe/onboard', authenticateToken, async (req, res) => {
  try {
    const { url, accountId } = await StripeService.createOnboardingLink(req.user.id);
    res.json({ url, accountId });
  } catch (error) {
    console.error('Stripe onboarding error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Check onboarding status
app.get('/api/stripe/onboard/status', authenticateToken, async (req, res) => {
  try {
    const complete = await StripeService.checkOnboardingComplete(req.user.id);
    const user = db.prepare('SELECT stripe_account_id, onboarding_complete FROM users WHERE id = ?').get(req.user.id);
    res.json({ complete, stripeAccountId: user?.stripe_account_id || null });
  } catch (error) {
    console.error('Onboarding status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== VAULT (STRIPE CONNECT) ROUTES ====================

// Create a vault with split members
// POST /api/vault/create  { totalAmount, members: [userId, ...] }
app.post('/api/vault/create', authenticateToken, [
  body('totalAmount').isFloat({ gt: 0 }).withMessage('totalAmount must be a positive number'),
  body('members').isArray({ min: 1 }).withMessage('members must be a non-empty array'),
  handleValidationErrors
], async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { totalAmount, members } = req.body;

    // Verify owner has completed onboarding
    const owner = db.prepare('SELECT stripe_account_id, onboarding_complete FROM users WHERE id = ?').get(ownerId);
    if (!owner?.stripe_account_id || !owner.onboarding_complete) {
      return res.status(400).json({ error: 'You must complete Stripe onboarding before creating a vault' });
    }

    const memberCount = members.length;
    const perUserAmount = Math.round((totalAmount / memberCount) * 100) / 100;
    const chargedAmount = calculateChargedAmount(perUserAmount);

    const vaultResult = db.prepare(`
      INSERT INTO vaults (owner_id, total_amount, per_user_amount, status)
      VALUES (?, ?, ?, 'open')
    `).run(ownerId, totalAmount, perUserAmount);

    const vaultId = vaultResult.lastInsertRowid;

    const insertMember = db.prepare(`
      INSERT INTO vault_members (vault_id, user_id, owed_amount, charged_amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    for (const userId of members) {
      insertMember.run(vaultId, userId, perUserAmount, chargedAmount);
    }

    res.status(201).json({ vaultId, perUserAmount, chargedAmount });
  } catch (error) {
    console.error('Vault create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get vault details (owner and members)
app.get('/api/vault/:vaultId', authenticateToken, (req, res) => {
  try {
    const vault = db.prepare('SELECT * FROM vaults WHERE id = ?').get(req.params.vaultId);
    if (!vault) return res.status(404).json({ error: 'Vault not found' });

    const members = db.prepare(`
      SELECT vm.*, u.username, u.name
      FROM vault_members vm
      INNER JOIN users u ON vm.user_id = u.id
      WHERE vm.vault_id = ?
    `).all(req.params.vaultId);

    res.json({ vault, members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create PaymentIntent for a vault member's split
// POST /api/vault/pay  { vaultId, memberId }
app.post('/api/vault/pay', paymentLimiter, authenticateToken, [
  body('vaultId').isInt({ gt: 0 }).withMessage('vaultId is required'),
  body('memberId').isInt({ gt: 0 }).withMessage('memberId is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { vaultId, memberId } = req.body;

    // Confirm the authenticated user is the member
    const member = db.prepare('SELECT * FROM vault_members WHERE id = ? AND vault_id = ?').get(memberId, vaultId);
    if (!member) return res.status(404).json({ error: 'Vault member not found' });
    if (member.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const intent = await StripeService.createVaultPaymentIntent(vaultId, memberId);
    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error('Vault pay error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create PaymentIntent for a trip expense split (card payment)
// POST /api/vault/splits/:splitId/payment-intent
app.post('/api/vault/splits/:splitId/payment-intent', paymentLimiter, authenticateToken, async (req, res) => {
  try {
    const splitId = parseInt(req.params.splitId);

    const split = db.prepare(`
      SELECT vs.*, ve.paidBy, ve.tripId, ve.description
      FROM vault_splits vs
      INNER JOIN vault_entries ve ON vs.vaultEntryId = ve.id
      WHERE vs.id = ?
    `).get(splitId);

    if (!split) return res.status(404).json({ error: 'Split not found' });
    if (split.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (split.paid) return res.status(400).json({ error: 'Split already paid' });

    // Reuse existing pending PaymentIntent if one exists
    const existing = db.prepare(
      'SELECT stripePaymentIntentId FROM vault_transactions WHERE vaultSplitId = ? AND status = ?'
    ).get(splitId, 'pending');
    if (existing) {
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const pi = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
      return res.json({ clientSecret: pi.client_secret, chargedAmount: pi.amount / 100 });
    }

    const chargedAmount = calculateChargedAmount(split.amount);
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Check if expense payer has Stripe Connect — transfer if available, otherwise charge directly
    const payer = db.prepare(
      'SELECT id, stripe_account_id, onboarding_complete FROM users WHERE id = ?'
    ).get(split.paidBy);

    const intentParams = {
      amount: Math.round(chargedAmount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        splitId: splitId.toString(),
        type: 'vault_split'
      }
    };

    // Only add transfer if payer has completed Stripe Connect onboarding
    if (payer?.stripe_account_id && payer.onboarding_complete) {
      intentParams.transfer_data = {
        destination: payer.stripe_account_id,
        amount: Math.round(split.amount * 100)
      };
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    db.prepare(`
      INSERT INTO vault_transactions
        (vaultSplitId, stripePaymentIntentId, amount, currency, status, payerUserId, recipientUserId, tripId)
      VALUES (?, ?, ?, 'usd', 'pending', ?, ?, ?)
    `).run(splitId, intent.id, chargedAmount, req.user.id, split.paidBy, split.tripId);

    res.json({ clientSecret: intent.client_secret, chargedAmount });
  } catch (error) {
    console.error('Split payment intent error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PAYMENT METHODS ROUTES ====================

// Get user's saved payment methods
app.get('/api/payment-methods', authenticateToken, (req, res) => {
  try {
    res.json(Payment.getUserPaymentMethods(req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a payment method
app.post('/api/payment-methods', authenticateToken, [
  body('stripePaymentMethodId').notEmpty().withMessage('stripePaymentMethodId is required'),
  handleValidationErrors
], (req, res) => {
  try {
    const { stripePaymentMethodId, type, brand, last4, expiryMonth, expiryYear, isDefault } = req.body;
    Payment.addPaymentMethod(req.user.id, stripePaymentMethodId, { type, brand, last4, expiryMonth, expiryYear, isDefault });
    res.status(201).json({ message: 'Payment method added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set default payment method
app.put('/api/payment-methods/:id/default', authenticateToken, (req, res) => {
  try {
    Payment.setDefaultPaymentMethod(req.user.id, req.params.id);
    res.json({ message: 'Default payment method updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a payment method
app.delete('/api/payment-methods/:id', authenticateToken, (req, res) => {
  try {
    Payment.deletePaymentMethod(req.params.id, req.user.id);
    res.json({ message: 'Payment method removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' });
  }
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Nostia server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🚀 ========================================');
    console.log('🚀  NOSTIA MVP Backend Server');
    console.log('🚀 ========================================');
    console.log(`🚀  API URL: http://localhost:${PORT}`);
    console.log(`🚀  Mobile: Use your local IP address`);
    console.log('🚀 ========================================');
    console.log('🚀  Features:');
    console.log('🚀  ✅ Friend Integration');
    console.log('🚀  ✅ Social Feed & Events');
    console.log('🚀  ✅ Trip Planning + Vault');
    console.log('🚀  ✅ Adventure Discovery');
    console.log('🚀  ✅ AI Content Generation');
    console.log('🚀  ✅ User Consent & Access Control');
    console.log('🚀  ✅ Analytics & Data Collection');
    console.log('🚀  ✅ Data Aggregation & Heatmaps');
    console.log('🚀  ✅ Analytics Monetization');
    console.log('🚀  ✅ GDPR/CCPA Compliance');
    console.log('🚀  ✅ Stripe Connect Payments (Vault)');
    console.log('🚀 ========================================\n');
  }
});

module.exports = app;
