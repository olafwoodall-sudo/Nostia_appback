const db = require('../database/db');

class Feed {
  static createPost(postData) {
    const { userId, content, type, imageData, relatedTripId, relatedEventId, authorLat, authorLng } = postData;

    const stmt = db.prepare(`
      INSERT INTO feed_posts (userId, content, type, imageData, relatedTripId, relatedEventId, author_lat, author_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      content || '',
      imageData ? 'photo' : (type || 'text'),
      imageData || null,
      relatedTripId || null,
      relatedEventId || null,
      authorLat || null,
      authorLng || null
    );

    return this.findById(result.lastInsertRowid, userId);
  }

  static findById(id, currentUserId = null) {
    const stmt = db.prepare(`
      SELECT fp.*, u.username, u.name,
             t.title as tripTitle,
             e.title as eventTitle,
             (SELECT COUNT(*) FROM post_likes WHERE postId = fp.id) as likeCount,
             (SELECT COUNT(*) FROM post_dislikes WHERE postId = fp.id) as dislikeCount,
             (SELECT COUNT(*) FROM post_comments WHERE postId = fp.id) as commentCount
      FROM feed_posts fp
      INNER JOIN users u ON fp.userId = u.id
      LEFT JOIN trips t ON fp.relatedTripId = t.id
      LEFT JOIN events e ON fp.relatedEventId = e.id
      WHERE fp.id = ?
    `);

    const post = stmt.get(id);

    if (post && currentUserId) {
      const liked = db.prepare('SELECT 1 FROM post_likes WHERE postId = ? AND userId = ?').get(id, currentUserId);
      post.isLiked = !!liked;
      const disliked = db.prepare('SELECT 1 FROM post_dislikes WHERE postId = ? AND userId = ?').get(id, currentUserId);
      post.isDisliked = !!disliked;
    }

    return post;
  }

  static getAll(limit = 50, currentUserId = null) {
    const stmt = db.prepare(`
      SELECT fp.*, u.username, u.name,
             t.title as tripTitle,
             e.title as eventTitle,
             (SELECT COUNT(*) FROM post_likes WHERE postId = fp.id) as likeCount,
             (SELECT COUNT(*) FROM post_dislikes WHERE postId = fp.id) as dislikeCount,
             (SELECT COUNT(*) FROM post_comments WHERE postId = fp.id) as commentCount
      FROM feed_posts fp
      INNER JOIN users u ON fp.userId = u.id
      LEFT JOIN trips t ON fp.relatedTripId = t.id
      LEFT JOIN events e ON fp.relatedEventId = e.id
      ORDER BY fp.createdAt DESC
      LIMIT ?
    `);

    const posts = stmt.all(limit);

    if (currentUserId) {
      const likedPosts = db.prepare('SELECT postId FROM post_likes WHERE userId = ?').all(currentUserId);
      const likedSet = new Set(likedPosts.map(l => l.postId));
      const dislikedPosts = db.prepare('SELECT postId FROM post_dislikes WHERE userId = ?').all(currentUserId);
      const dislikedSet = new Set(dislikedPosts.map(d => d.postId));
      posts.forEach(post => {
        post.isLiked = likedSet.has(post.id);
        post.isDisliked = dislikedSet.has(post.id);
      });
    }

    return posts;
  }

  // Two-source feed: followed users (48h) + geo posts (50km, 48h), merged by timestamp
  static getUserFeed(userId, userLat, userLng, limit = 50) {
    const cutoff = "datetime('now', '-48 hours')";

    // Source 1: posts from users the viewer follows, within 48h
    const followedPosts = db.prepare(`
      SELECT fp.*, u.username, u.name,
             (SELECT COUNT(*) FROM post_likes WHERE postId = fp.id) as likeCount,
             (SELECT COUNT(*) FROM post_dislikes WHERE postId = fp.id) as dislikeCount,
             (SELECT COUNT(*) FROM post_comments WHERE postId = fp.id) as commentCount
      FROM feed_posts fp
      INNER JOIN users u ON fp.userId = u.id
      INNER JOIN follows f ON f.followee_id = fp.userId
      WHERE f.follower_id = ? AND fp.createdAt >= ${cutoff}
      ORDER BY fp.createdAt DESC LIMIT ?
    `).all(userId, limit);

    // Source 2: geo posts from users within ~50km bounding box, within 48h
    let geoPosts = [];
    if (userLat != null && userLng != null) {
      const GEO_DEG = 0.45; // ~50km in degrees
      geoPosts = db.prepare(`
        SELECT fp.*, u.username, u.name,
               (SELECT COUNT(*) FROM post_likes WHERE postId = fp.id) as likeCount,
               (SELECT COUNT(*) FROM post_dislikes WHERE postId = fp.id) as dislikeCount,
               (SELECT COUNT(*) FROM post_comments WHERE postId = fp.id) as commentCount
        FROM feed_posts fp
        INNER JOIN users u ON fp.userId = u.id
        WHERE fp.author_lat IS NOT NULL AND fp.author_lng IS NOT NULL
          AND fp.createdAt >= ${cutoff}
          AND ABS(fp.author_lat - ?) < ?
          AND ABS(fp.author_lng - ?) < ?
        ORDER BY fp.createdAt DESC LIMIT ?
      `).all(userLat, GEO_DEG, userLng, GEO_DEG, limit);
    }

    // Merge, deduplicate, sort DESC
    const seen = new Set();
    const merged = [...followedPosts, ...geoPosts]
      .filter(p => seen.has(p.id) ? false : seen.add(p.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    // Add isLiked / isDisliked flags
    const likedSet = new Set(db.prepare('SELECT postId FROM post_likes WHERE userId = ?').all(userId).map(l => l.postId));
    const dislikedSet = new Set(db.prepare('SELECT postId FROM post_dislikes WHERE userId = ?').all(userId).map(d => d.postId));
    merged.forEach(p => {
      p.isLiked = likedSet.has(p.id);
      p.isDisliked = dislikedSet.has(p.id);
    });

    return merged;
  }

  // Get all posts by a specific user, for profile page display
  static getUserPostsByUserId(targetUserId, currentUserId = null, limit = 50) {
    const posts = db.prepare(`
      SELECT fp.*, u.username, u.name,
             (SELECT COUNT(*) FROM post_likes WHERE postId = fp.id) as likeCount,
             (SELECT COUNT(*) FROM post_dislikes WHERE postId = fp.id) as dislikeCount,
             (SELECT COUNT(*) FROM post_comments WHERE postId = fp.id) as commentCount
      FROM feed_posts fp
      INNER JOIN users u ON fp.userId = u.id
      WHERE fp.userId = ?
      ORDER BY fp.createdAt DESC LIMIT ?
    `).all(targetUserId, limit);

    if (currentUserId) {
      const likedSet = new Set(db.prepare('SELECT postId FROM post_likes WHERE userId = ?').all(currentUserId).map(l => l.postId));
      const dislikedSet = new Set(db.prepare('SELECT postId FROM post_dislikes WHERE userId = ?').all(currentUserId).map(d => d.postId));
      posts.forEach(p => {
        p.isLiked = likedSet.has(p.id);
        p.isDisliked = dislikedSet.has(p.id);
      });
    }

    return posts;
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM feed_posts WHERE id = ?');
    return stmt.run(id);
  }

  // ===== LIKE METHODS =====

  static likePost(postId, userId) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO post_likes (postId, userId)
      VALUES (?, ?)
    `);
    stmt.run(postId, userId);
    return this.getLikeCount(postId);
  }

  static unlikePost(postId, userId) {
    const stmt = db.prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?');
    stmt.run(postId, userId);
    return this.getLikeCount(postId);
  }

  static getLikeCount(postId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM post_likes WHERE postId = ?').get(postId);
    return result.count;
  }

  static isLikedByUser(postId, userId) {
    const result = db.prepare('SELECT 1 FROM post_likes WHERE postId = ? AND userId = ?').get(postId, userId);
    return !!result;
  }

  // ===== DISLIKE METHODS =====

  static dislikePost(postId, userId) {
    // Remove like first — cannot like and dislike simultaneously
    db.prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?').run(postId, userId);
    db.prepare('INSERT OR IGNORE INTO post_dislikes (postId, userId) VALUES (?, ?)').run(postId, userId);
    return this.getDislikeCount(postId);
  }

  static undislikePost(postId, userId) {
    db.prepare('DELETE FROM post_dislikes WHERE postId = ? AND userId = ?').run(postId, userId);
    return this.getDislikeCount(postId);
  }

  static getDislikeCount(postId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM post_dislikes WHERE postId = ?').get(postId);
    return result.count;
  }

  // ===== COMMENT METHODS =====

  static addComment(postId, userId, content) {
    const stmt = db.prepare(`
      INSERT INTO post_comments (postId, userId, content)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(postId, userId, content);
    return this.getCommentById(result.lastInsertRowid);
  }

  static getCommentById(id) {
    const stmt = db.prepare(`
      SELECT pc.*, u.username, u.name
      FROM post_comments pc
      INNER JOIN users u ON pc.userId = u.id
      WHERE pc.id = ?
    `);
    return stmt.get(id);
  }

  static getComments(postId, limit = 50) {
    const stmt = db.prepare(`
      SELECT pc.*, u.username, u.name
      FROM post_comments pc
      INNER JOIN users u ON pc.userId = u.id
      WHERE pc.postId = ?
      ORDER BY pc.createdAt ASC
      LIMIT ?
    `);
    return stmt.all(postId, limit);
  }

  static deleteComment(commentId, userId) {
    const stmt = db.prepare('DELETE FROM post_comments WHERE id = ? AND userId = ?');
    return stmt.run(commentId, userId);
  }

  static getCommentCount(postId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM post_comments WHERE postId = ?').get(postId);
    return result.count;
  }
}

module.exports = Feed;
