const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'nostia.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      homeStatus TEXT DEFAULT 'closed',
      latitude REAL,
      longitude REAL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Friends table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      friendId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, friendId)
    )
  `);

  // Trips table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      destination TEXT,
      startDate DATETIME,
      endDate DATETIME,
      createdBy INTEGER NOT NULL,
      itinerary TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Trip participants (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tripId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      role TEXT DEFAULT 'participant',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(tripId, userId)
    )
  `);

  // Events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      eventDate DATETIME,
      createdBy INTEGER NOT NULL,
      type TEXT DEFAULT 'social',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Vault entries (expense tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tripId INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      paidBy INTEGER NOT NULL,
      category TEXT DEFAULT 'general',
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (paidBy) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Vault splits (who owes what)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vaultEntryId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vaultEntryId) REFERENCES vault_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Feed posts
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      imageData TEXT,
      relatedTripId INTEGER,
      relatedEventId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (relatedTripId) REFERENCES trips(id) ON DELETE SET NULL,
      FOREIGN KEY (relatedEventId) REFERENCES events(id) ON DELETE SET NULL
    )
  `);

  // Post likes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES feed_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(postId, userId)
    )
  `);

  // Post comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES feed_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Adventures (discovery feature)
  db.exec(`
    CREATE TABLE IF NOT EXISTS adventures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      category TEXT,
      difficulty TEXT,
      imageUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Stripe customer mapping
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER UNIQUE NOT NULL,
      stripeCustomerId TEXT UNIQUE NOT NULL,
      email TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Payment methods (cards, bank accounts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      stripePaymentMethodId TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'card',
      brand TEXT,
      last4 TEXT,
      expiryMonth INTEGER,
      expiryYear INTEGER,
      isDefault BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Vault transactions (Stripe payment tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vaultSplitId INTEGER NOT NULL,
      stripePaymentIntentId TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'pending',
      payerUserId INTEGER NOT NULL,
      recipientUserId INTEGER NOT NULL,
      tripId INTEGER NOT NULL,
      stripeChargeId TEXT,
      stripeFee REAL DEFAULT 0,
      netAmount REAL,
      errorMessage TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME,
      FOREIGN KEY (vaultSplitId) REFERENCES vault_splits(id) ON DELETE CASCADE,
      FOREIGN KEY (payerUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipientUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);

  // Add indexes for faster lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_transactions_trip ON vault_transactions(tripId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_transactions_status ON vault_transactions(status)`);

  // Trip invitations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tripId INTEGER NOT NULL,
      invitedUserId INTEGER NOT NULL,
      invitedBy INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      respondedAt DATETIME,
      FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (invitedUserId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (invitedBy) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(tripId, invitedUserId)
    )
  `);

  // Add vaultLeaderId column to trips if it doesn't exist
  try {
    db.exec(`ALTER TABLE trips ADD COLUMN vaultLeaderId INTEGER REFERENCES users(id)`);
  } catch (e) {
    // Column already exists
  }

  // Add latitude/longitude to events for location-based discovery
  try {
    db.exec(`ALTER TABLE events ADD COLUMN latitude REAL`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE events ADD COLUMN longitude REAL`);
  } catch (e) {
    // Column already exists
  }

  // Add Stripe-related columns to vault_splits if they don't exist
  try {
    db.exec(`ALTER TABLE vault_splits ADD COLUMN stripePayable BOOLEAN DEFAULT 1`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE vault_splits ADD COLUMN paidViaStripe BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE vault_splits ADD COLUMN paidAt DATETIME`);
  } catch (e) {
    // Column already exists
  }

  // Add homeStatus column to users if it doesn't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN homeStatus TEXT DEFAULT 'closed'`);
  } catch (e) {
    // Column already exists
  }

  // Add role column to users if it doesn't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
  } catch (e) {
    // Column already exists
  }

  // Add latitude/longitude to users if they don't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN latitude REAL`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN longitude REAL`);
  } catch (e) {
    // Column already exists
  }

  // Add imageData column to feed_posts if it doesn't exist
  try {
    db.exec(`ALTER TABLE feed_posts ADD COLUMN imageData TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Add createdBy column to adventures if it doesn't exist
  try {
    db.exec(`ALTER TABLE adventures ADD COLUMN createdBy INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  } catch (e) {
    // Column already exists
  }

  // Push tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER UNIQUE NOT NULL,
      token TEXT NOT NULL,
      platform TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      read BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add index for faster notification lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(userId, read)`);

  // Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1Id INTEGER NOT NULL,
      user2Id INTEGER NOT NULL,
      lastMessageAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user1Id, user2Id)
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL,
      senderId INTEGER NOT NULL,
      content TEXT NOT NULL,
      read BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add indexes for faster message lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversationId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1Id, user2Id)`);

  // User consents table (consent versioning and audit trail)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      consentVersion TEXT NOT NULL,
      locationConsent BOOLEAN NOT NULL,
      dataCollectionConsent BOOLEAN NOT NULL,
      privacyPolicyVersion TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      grantedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      revokedAt DATETIME,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Analytics events table (raw event tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      sessionId TEXT NOT NULL,
      eventType TEXT NOT NULL,
      eventName TEXT NOT NULL,
      eventData TEXT,
      latitude REAL,
      longitude REAL,
      regionBucket TEXT,
      duration INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(eventType)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(createdAt)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_events_region ON analytics_events(regionBucket)`);

  // Analytics sessions table (session-level metrics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      sessionId TEXT UNIQUE NOT NULL,
      startedAt DATETIME NOT NULL,
      endedAt DATETIME,
      durationSeconds INTEGER,
      eventCount INTEGER DEFAULT 0,
      platform TEXT,
      appVersion TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions(userId)`);

  // Analytics aggregates table (pre-computed anonymized reports)
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_aggregates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reportType TEXT NOT NULL,
      periodStart DATETIME NOT NULL,
      periodEnd DATETIME NOT NULL,
      regionBucket TEXT,
      metricName TEXT NOT NULL,
      metricValue REAL NOT NULL,
      sampleSize INTEGER,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_agg_type ON analytics_aggregates(reportType, periodStart)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_agg_region ON analytics_aggregates(regionBucket)`);

  // Analytics subscriptions table (paid dashboard access)
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      plan TEXT NOT NULL,
      stripeSubscriptionId TEXT,
      status TEXT DEFAULT 'active',
      startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Report downloads table (purchased trend reports)
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      reportType TEXT NOT NULL,
      reportParams TEXT,
      stripePaymentIntentId TEXT,
      amount REAL,
      generatedAt DATETIME,
      downloadUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Stripe Connect columns on users
  try {
    db.exec(`ALTER TABLE users ADD COLUMN stripe_account_id TEXT`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  // Vaults table (Stripe Connect payment collections)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vaults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      per_user_amount REAL NOT NULL,
      status TEXT DEFAULT 'open',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Vault members table (split payments per member)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      owed_amount REAL NOT NULL,
      charged_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      stripe_payment_intent_id TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(vault_id, user_id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_members_vault ON vault_members(vault_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_members_user ON vault_members(user_id)`);

  // Add role column to users for admin access
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
  } catch (e) {
    // Column already exists
  }

  // Add consent tracking columns to users
  try {
    db.exec(`ALTER TABLE users ADD COLUMN consentVersion TEXT`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN locationConsentGranted BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  // Audit log table (persistent record of sensitive actions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      userId INTEGER,
      ipAddress TEXT,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);

  // Token blacklist (for server-side JWT revocation on logout)
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      userId INTEGER,
      revokedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expiresAt)`);

  // Payment production columns on vault_transactions
  try {
    db.exec(`ALTER TABLE vault_transactions ADD COLUMN transferId TEXT`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE vault_transactions ADD COLUMN failureReason TEXT`);
  } catch (e) {}

  // Dispute flag on vault_splits
  try {
    db.exec(`ALTER TABLE vault_splits ADD COLUMN disputeFlag BOOLEAN DEFAULT 0`);
  } catch (e) {}

  // Dispute flag on vault_members
  try {
    db.exec(`ALTER TABLE vault_members ADD COLUMN disputeFlag BOOLEAN DEFAULT 0`);
  } catch (e) {}

  console.log('✅ Database tables initialized successfully');
}

// Seed some initial data for testing
function seedDatabase() {
  try {
    // Check if we already have users
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count > 0) {
      console.log('📊 Database already seeded');
      return;
    }

    // Create test users
    const hashedPassword = bcrypt.hashSync('password123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password, name, homeStatus)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('testuser', 'test@nostia.com', hashedPassword, 'Test User', 'open');
    insertUser.run('alex_explorer', 'alex@nostia.com', hashedPassword, 'Alex Rivera', 'open');
    insertUser.run('sarah_wanderer', 'sarah@nostia.com', hashedPassword, 'Sarah Chen', 'closed');

    // Create some adventures
    const insertAdventure = db.prepare(`
      INSERT INTO adventures (title, description, location, category, difficulty)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertAdventure.run(
      'Mountain Hiking Trail',
      'Beautiful scenic trail with amazing views',
      'Rocky Mountains',
      'hiking',
      'moderate'
    );

    insertAdventure.run(
      'Kayaking Adventure',
      'Peaceful river kayaking experience',
      'Colorado River',
      'water-sports',
      'easy'
    );

    insertAdventure.run(
      'Rock Climbing',
      'Challenging climbing routes for experienced climbers',
      'Yosemite',
      'climbing',
      'hard'
    );

    console.log('✅ Database seeded with test data');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
}

// Initialize on module load
initializeDatabase();
seedDatabase();

module.exports = db;
