const db = require('../database/db');

class Follow {
  static follow(followerId, followeeId) {
    if (followerId === followeeId) throw new Error('Cannot follow yourself');
    db.prepare(`
      INSERT INTO follows (follower_id, followee_id)
      VALUES (?, ?)
      ON CONFLICT(follower_id, followee_id) DO NOTHING
    `).run(followerId, followeeId);
  }

  static unfollow(followerId, followeeId) {
    db.prepare(`
      DELETE FROM follows WHERE follower_id = ? AND followee_id = ?
    `).run(followerId, followeeId);
  }

  static getFollowers(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.name, u.homeStatus
      FROM users u
      INNER JOIN follows f ON f.follower_id = u.id
      WHERE f.followee_id = ?
      ORDER BY f.created_at DESC
    `).all(userId);
  }

  static getFollowing(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.name, u.homeStatus
      FROM users u
      INNER JOIN follows f ON f.followee_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `).all(userId);
  }

  static isFollowing(followerId, followeeId) {
    const row = db.prepare(`
      SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?
    `).get(followerId, followeeId);
    return !!row;
  }

  static isMutual(userAId, userBId) {
    const aFollowsB = db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`).get(userAId, userBId);
    const bFollowsA = db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`).get(userBId, userAId);
    return !!(aFollowsB && bFollowsA);
  }

  // Locations of mutual follows who have granted location consent
  static getLocationsFeed(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.name, u.latitude, u.longitude, u.updatedAt
      FROM users u
      INNER JOIN follows f1 ON f1.follower_id = u.id AND f1.followee_id = ?
      INNER JOIN follows f2 ON f2.follower_id = ? AND f2.followee_id = u.id
      WHERE u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND u.locationConsentGranted = 1
    `).all(userId, userId);
  }
}

module.exports = Follow;
