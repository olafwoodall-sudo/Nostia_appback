const db = require('../database/db');

// Add visibility column if it doesn't exist yet
try {
  db.prepare(`ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`).run();
} catch (_) { /* column already exists */ }
try {
  db.prepare(`ALTER TABLE events ADD COLUMN flyerImage TEXT`).run();
} catch (_) { /* column already exists */ }

class Event {
  // R(t) = 20 + 3t + H(t-50) * 10t   (miles)
  static computeRadius(goingCount) {
    const t = goingCount || 0;
    const heaviside = t >= 50 ? 1 : 0;
    return 20 + 3 * t + heaviside * 10 * t;
  }

  static create(eventData) {
    const { title, description, location, eventDate, createdBy, type, latitude, longitude, visibility, flyerImage, inviteeIds, isDevCreator } = eventData;

    const stmt = db.prepare(`
      INSERT INTO events (title, description, location, eventDate, createdBy, type, latitude, longitude, visibility, flyerImage, event_radius_miles, is_global, dev_created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title, description, location, eventDate, createdBy,
      type || 'social', latitude || null, longitude || null,
      visibility || 'public', flyerImage || null,
      20, // initial radius: 0 attendees
      isDevCreator ? 1 : 0,
      isDevCreator ? 1 : 0
    );

    const eventId = result.lastInsertRowid;

    if (visibility === 'private' && Array.isArray(inviteeIds) && inviteeIds.length > 0) {
      const insertInvitee = db.prepare(`INSERT OR IGNORE INTO event_invitees (eventId, userId) VALUES (?, ?)`);
      for (const uid of inviteeIds) {
        insertInvitee.run(eventId, uid);
      }
    }

    return this.findById(eventId, createdBy);
  }

  static findById(id, requestingUserId = null) {
    const event = db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName,
        (SELECT COUNT(*) FROM event_rsvps WHERE eventId = e.id AND status = 'going') as goingCount,
        (SELECT status FROM event_rsvps WHERE eventId = e.id AND userId = ?) as myRsvp
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.id = ?
    `).get(requestingUserId, id);
    if (!event) return null;
    if (!this.canViewEvent(event, requestingUserId)) return null;
    return event;
  }

  static canViewEvent(event, requestingUserId) {
    if (event.visibility === 'public') return true;
    if (!requestingUserId) return false;
    if (event.createdBy === requestingUserId) return true;
    if (event.visibility === 'friends' || event.visibility === 'followers') {
      return !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
        .get(requestingUserId, event.createdBy);
    }
    if (event.visibility === 'private') {
      return !!db.prepare('SELECT 1 FROM event_invitees WHERE eventId = ? AND userId = ?')
        .get(event.id, requestingUserId);
    }
    return false;
  }

  static getAll(requestingUserId = null) {
    return db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName,
        (SELECT COUNT(*) FROM event_rsvps WHERE eventId = e.id AND status = 'going') as goingCount,
        (SELECT status FROM event_rsvps WHERE eventId = e.id AND userId = ?) as myRsvp
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.visibility = 'public'
        OR e.createdBy = ?
        OR (
          e.visibility IN ('friends', 'followers')
          AND EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = ? AND followee_id = e.createdBy
          )
        )
        OR (
          e.visibility = 'private'
          AND EXISTS (SELECT 1 FROM event_invitees WHERE eventId = e.id AND userId = ?)
        )
      ORDER BY e.eventDate DESC
    `).all(requestingUserId, requestingUserId, requestingUserId, requestingUserId);
  }

  static getUserEvents(userId) {
    return db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.createdBy = ?
      ORDER BY e.eventDate DESC
    `).all(userId);
  }

  static getUpcoming(limit = 10) {
    return db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.eventDate >= datetime('now')
        AND e.visibility = 'public'
      ORDER BY e.eventDate ASC
      LIMIT ?
    `).all(limit);
  }

  static update(id, updates) {
    const allowedFields = ['title', 'description', 'location', 'eventDate', 'type', 'latitude', 'longitude', 'visibility', 'flyerImage'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);

    db.prepare(`UPDATE events SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    return this.findById(id);
  }

  static delete(id) {
    return db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }

  static getMyGoingEvents(userId, limit = 20) {
    return db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName,
        (SELECT COUNT(*) FROM event_rsvps WHERE eventId = e.id AND status = 'going') as goingCount,
        'going' as myRsvp
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      INNER JOIN event_rsvps r ON r.eventId = e.id AND r.userId = ? AND r.status = 'going'
      ORDER BY e.eventDate ASC
      LIMIT ?
    `).all(userId, limit);
  }

  static setRsvp(eventId, userId, status) {
    db.prepare(`
      INSERT INTO event_rsvps (eventId, userId, status)
      VALUES (?, ?, ?)
      ON CONFLICT(eventId, userId) DO UPDATE SET status = excluded.status
    `).run(eventId, userId, status);

    // Dev-created events have is_global permanently true — skip radius recomputation
    const event = db.prepare(`SELECT dev_created FROM events WHERE id = ?`).get(eventId);
    if (event?.dev_created) return;

    // Recompute radius immediately after every RSVP change
    const { goingCount } = db.prepare(
      `SELECT COUNT(*) as goingCount FROM event_rsvps WHERE eventId = ? AND status = 'going'`
    ).get(eventId);

    const radius = this.computeRadius(goingCount);
    const isGlobal = radius > 3000 ? 1 : 0;

    db.prepare(`UPDATE events SET event_radius_miles = ?, is_global = ? WHERE id = ?`)
      .run(radius, isGlobal, eventId);
  }

  // Returns events visible to the user for a given map viewport.
  // viewportRadiusMiles: effective radius of the client viewport in miles.
  // minLat/maxLat/minLng/maxLng: bounding box of the current viewport.
  static getMapEvents(userId, { minLat, maxLat, minLng, maxLng, viewportRadiusMiles = 20 }) {
    const baseSelect = `
      SELECT e.*, u.username as creatorUsername, u.name as creatorName,
        (SELECT COUNT(*) FROM event_rsvps WHERE eventId = e.id AND status = 'going') as goingCount,
        (SELECT status FROM event_rsvps WHERE eventId = e.id AND userId = ?) as myRsvp
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
    `;

    if (!userId) {
      // Unauthenticated: show only global public events + viewport-intersecting public events
      return db.prepare(`
        ${baseSelect}
        WHERE e.visibility = 'public'
          AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
          AND (
            e.is_global = 1
            OR (
              e.latitude BETWEEN ? AND ?
              AND e.longitude BETWEEN ? AND ?
              AND e.event_radius_miles >= ?
            )
          )
        ORDER BY e.eventDate ASC
      `).all(null, minLat, maxLat, minLng, maxLng, viewportRadiusMiles);
    }

    // Authenticated: union of all four visibility classes, deduped by precedence order
    // SQLite doesn't support UNION with complex ordering well, so fetch in one query
    // using CASE for visibility_tier (lower = higher precedence)
    return db.prepare(`
      ${baseSelect}
      WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
        AND (
          -- Priority 1: private events the user is invited to (or created)
          (e.visibility = 'private' AND (
            e.createdBy = ?
            OR EXISTS (SELECT 1 FROM event_invitees WHERE eventId = e.id AND userId = ?)
          ))
          -- Priority 2: follower-visibility events where user follows the creator
          OR (
            e.visibility IN ('friends', 'followers')
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = ? AND followee_id = e.createdBy
            )
          )
          -- Priority 3: global public events
          OR (e.visibility = 'public' AND e.is_global = 1)
          -- Priority 4: viewport-intersecting public events
          OR (
            e.visibility = 'public'
            AND e.is_global = 0
            AND e.latitude BETWEEN ? AND ?
            AND e.longitude BETWEEN ? AND ?
            AND e.event_radius_miles >= ?
          )
        )
      ORDER BY e.eventDate ASC
    `).all(
      userId,                           // myRsvp subquery
      userId, userId,                   // private: createdBy / invitee check
      userId,                           // follower check
      minLat, maxLat, minLng, maxLng, viewportRadiusMiles  // viewport check
    );
  }

  static addInvitees(eventId, userIds) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO event_invitees (eventId, userId) VALUES (?, ?)`);
    for (const uid of userIds) {
      stmt.run(eventId, uid);
    }
  }

  static getInvitees(eventId) {
    return db.prepare(`
      SELECT u.id, u.name, u.username
      FROM event_invitees ei
      INNER JOIN users u ON u.id = ei.userId
      WHERE ei.eventId = ?
    `).all(eventId);
  }

  static getNearbySimple(lat, lng, radiusKm = 50, limit = 20) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const events = db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.latitude IS NOT NULL
        AND e.longitude IS NOT NULL
        AND e.latitude BETWEEN ? AND ?
        AND e.longitude BETWEEN ? AND ?
        AND e.eventDate >= datetime('now')
        AND e.visibility = 'public'
      ORDER BY e.eventDate ASC
      LIMIT ?
    `).all(minLat, maxLat, minLng, maxLng, limit);

    return events.map(event => ({
      ...event,
      distance: this.calculateDistance(lat, lng, event.latitude, event.longitude)
    })).sort((a, b) => a.distance - b.distance);
  }

  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static getByType(type, limit = 20) {
    return db.prepare(`
      SELECT e.*, u.username as creatorUsername, u.name as creatorName
      FROM events e
      INNER JOIN users u ON e.createdBy = u.id
      WHERE e.type = ?
        AND e.eventDate >= datetime('now')
        AND e.visibility = 'public'
      ORDER BY e.eventDate ASC
      LIMIT ?
    `).all(type, limit);
  }
}

module.exports = Event;
