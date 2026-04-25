const db = require('../database/db');

class Trip {
  static create(tripData) {
    const { title, description, destination, startDate, endDate, createdBy, itinerary } = tripData;

    const stmt = db.prepare(`
      INSERT INTO trips (title, description, destination, startDate, endDate, createdBy, itinerary, vaultLeaderId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Creator is also the default vault leader
    const result = stmt.run(title, description, destination, startDate, endDate, createdBy, itinerary, createdBy);
    const tripId = result.lastInsertRowid;

    // Add creator as participant with 'creator' role
    this.addParticipant(tripId, createdBy, 'creator');

    return this.findById(tripId);
  }

  static findById(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    const stmt = db.prepare(`
      SELECT t.*,
        u.username as creatorUsername, u.name as creatorName,
        vl.username as vaultLeaderUsername, vl.name as vaultLeaderName
      FROM trips t
      LEFT JOIN users u ON t.createdBy = u.id
      LEFT JOIN users vl ON t.vaultLeaderId = vl.id
      WHERE t.id = ?
    `);

    const trip = stmt.get(numId);

    if (trip) {
      trip.participants = this.getParticipants(id);
      trip.invitations = this.getPendingInvitations(id);
    }

    return trip;
  }

  static getAll() {
    const stmt = db.prepare(`
      SELECT t.*, u.username as creatorUsername, u.name as creatorName
      FROM trips t
      INNER JOIN users u ON t.createdBy = u.id
      ORDER BY t.createdAt DESC
    `);

    const trips = stmt.all();

    trips.forEach(trip => {
      trip.participants = this.getParticipants(trip.id);
    });

    return trips;
  }

  static getUserTrips(userId) {
    const stmt = db.prepare(`
      SELECT DISTINCT t.*, u.username as creatorUsername, u.name as creatorName
      FROM trips t
      LEFT JOIN users u ON t.createdBy = u.id
      INNER JOIN trip_participants tp ON t.id = tp.tripId
      WHERE tp.userId = ?
      ORDER BY t.createdAt DESC
    `);

    const trips = stmt.all(parseInt(userId, 10));

    trips.forEach(trip => {
      trip.participants = this.getParticipants(trip.id);
    });

    return trips;
  }

  static update(id, updates) {
    const allowedFields = ['title', 'description', 'destination', 'startDate', 'endDate', 'itinerary'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);

    const stmt = db.prepare(`
      UPDATE trips SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `);

    stmt.run(...values, id);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM trips WHERE id = ?');
    return stmt.run(id);
  }

  // Participant management
  static addParticipant(tripId, userId, role = 'participant') {
    const stmt = db.prepare(`
      INSERT INTO trip_participants (tripId, userId, role)
      VALUES (?, ?, ?)
    `);

    try {
      return stmt.run(tripId, userId, role);
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        throw new Error('User is already a participant');
      }
      throw error;
    }
  }

  static removeParticipant(tripId, userId) {
    const stmt = db.prepare(`
      DELETE FROM trip_participants WHERE tripId = ? AND userId = ?
    `);

    return stmt.run(tripId, userId);
  }

  static kickParticipant(tripId, userId, kickedBy) {
    const trip = db.prepare('SELECT vaultLeaderId FROM trips WHERE id = ?').get(tripId);
    if (!trip) throw new Error('Trip not found');
    if (trip.vaultLeaderId !== kickedBy) throw new Error('Only the vault leader can kick members');

    const participant = db.prepare(
      'SELECT * FROM trip_participants WHERE tripId = ? AND userId = ?'
    ).get(tripId, userId);
    if (!participant) throw new Error('User is not a participant');
    if (userId === kickedBy) throw new Error('Cannot kick yourself');

    db.prepare(
      "UPDATE trip_participants SET status = 'kicked' WHERE tripId = ? AND userId = ?"
    ).run(tripId, userId);

    return this.findById(tripId);
  }

  static getParticipants(tripId) {
    const stmt = db.prepare(`
      SELECT u.id, u.username, u.name, tp.role, tp.status
      FROM users u
      INNER JOIN trip_participants tp ON u.id = tp.userId
      WHERE tp.tripId = ?
    `);

    return stmt.all(tripId);
  }

  // Trip group chat
  static getChatMessages(tripId, limit = 100, offset = 0) {
    const stmt = db.prepare(`
      SELECT m.id, m.tripId, m.senderId, m.content, m.createdAt,
        u.name as senderName, u.username as senderUsername
      FROM trip_chat_messages m
      INNER JOIN users u ON m.senderId = u.id
      WHERE m.tripId = ?
      ORDER BY m.createdAt ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(tripId, limit, offset);
  }

  static sendChatMessage(tripId, senderId, content) {
    const participant = db.prepare(
      "SELECT status FROM trip_participants WHERE tripId = ? AND userId = ?"
    ).get(tripId, senderId);
    if (!participant) throw new Error('Not a participant of this vault');
    if (participant.status === 'kicked') throw new Error('Kicked members cannot send messages');

    const result = db.prepare(
      'INSERT INTO trip_chat_messages (tripId, senderId, content) VALUES (?, ?, ?)'
    ).run(tripId, senderId, content);

    return db.prepare(`
      SELECT m.id, m.tripId, m.senderId, m.content, m.createdAt,
        u.name as senderName, u.username as senderUsername
      FROM trip_chat_messages m
      INNER JOIN users u ON m.senderId = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
  }

  // Vault Leader Management
  static transferVaultLeader(tripId, newLeaderId, currentUserId) {
    // Check if current user is the vault leader
    const trip = db.prepare('SELECT vaultLeaderId FROM trips WHERE id = ?').get(tripId);
    if (!trip) throw new Error('Trip not found');
    if (trip.vaultLeaderId !== currentUserId) {
      throw new Error('Only the current vault leader can transfer leadership');
    }

    // Check if new leader is a participant
    const participant = db.prepare(
      'SELECT * FROM trip_participants WHERE tripId = ? AND userId = ?'
    ).get(tripId, newLeaderId);
    if (!participant) {
      throw new Error('New leader must be a trip participant');
    }

    const stmt = db.prepare('UPDATE trips SET vaultLeaderId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(newLeaderId, tripId);
    return this.findById(tripId);
  }

  static isVaultLeader(tripId, userId) {
    const trip = db.prepare('SELECT vaultLeaderId FROM trips WHERE id = ?').get(tripId);
    return trip && trip.vaultLeaderId === userId;
  }

  // Trip Invitations
  static inviteUser(tripId, invitedUserId, invitedBy) {
    // Check if user is already a participant
    const existing = db.prepare(
      'SELECT * FROM trip_participants WHERE tripId = ? AND userId = ?'
    ).get(tripId, invitedUserId);
    if (existing) {
      throw new Error('User is already a participant');
    }

    // Check if invitation already exists
    const existingInvite = db.prepare(
      'SELECT * FROM trip_invitations WHERE tripId = ? AND invitedUserId = ? AND status = ?'
    ).get(tripId, invitedUserId, 'pending');
    if (existingInvite) {
      throw new Error('User has already been invited');
    }

    const stmt = db.prepare(`
      INSERT INTO trip_invitations (tripId, invitedUserId, invitedBy)
      VALUES (?, ?, ?)
    `);

    stmt.run(tripId, invitedUserId, invitedBy);
    return this.findById(tripId);
  }

  static getPendingInvitations(tripId) {
    const stmt = db.prepare(`
      SELECT ti.*, u.username, u.name, ib.username as invitedByUsername
      FROM trip_invitations ti
      INNER JOIN users u ON ti.invitedUserId = u.id
      INNER JOIN users ib ON ti.invitedBy = ib.id
      WHERE ti.tripId = ? AND ti.status = 'pending'
    `);

    return stmt.all(tripId);
  }

  static getUserInvitations(userId) {
    const stmt = db.prepare(`
      SELECT ti.*, t.title as tripTitle, t.destination, ib.username as invitedByUsername, ib.name as invitedByName
      FROM trip_invitations ti
      INNER JOIN trips t ON ti.tripId = t.id
      INNER JOIN users ib ON ti.invitedBy = ib.id
      WHERE ti.invitedUserId = ? AND ti.status = 'pending'
    `);

    return stmt.all(userId);
  }

  static respondToInvitation(invitationId, userId, accept) {
    const invitation = db.prepare(
      'SELECT * FROM trip_invitations WHERE id = ? AND invitedUserId = ?'
    ).get(invitationId, userId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation has already been responded to');
    }

    const status = accept ? 'accepted' : 'declined';
    db.prepare(`
      UPDATE trip_invitations SET status = ?, respondedAt = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, invitationId);

    if (accept) {
      // Add user as participant
      this.addParticipant(invitation.tripId, userId, 'participant');
    }

    return this.findById(invitation.tripId);
  }
}

module.exports = Trip;
