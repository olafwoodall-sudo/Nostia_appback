const db = require('../database/db');

class Message {
  /**
   * Get or create a conversation between two users
   * Users are stored with lower ID as user1Id for uniqueness
   */
  static getOrCreateConversation(user1Id, user2Id) {
    // Ensure consistent ordering for uniqueness
    const [smallerId, largerId] = user1Id < user2Id
      ? [user1Id, user2Id]
      : [user2Id, user1Id];

    // Check if conversation exists
    const existing = db.prepare(`
      SELECT * FROM conversations
      WHERE user1Id = ? AND user2Id = ?
    `).get(smallerId, largerId);

    if (existing) {
      return existing;
    }

    // Create new conversation
    const stmt = db.prepare(`
      INSERT INTO conversations (user1Id, user2Id)
      VALUES (?, ?)
    `);
    const result = stmt.run(smallerId, largerId);

    return this.getConversationById(result.lastInsertRowid);
  }

  /**
   * Get conversation by ID
   */
  static getConversationById(id) {
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }

  /**
   * Get conversation between two specific users
   */
  static getConversationBetweenUsers(user1Id, user2Id) {
    const [smallerId, largerId] = user1Id < user2Id
      ? [user1Id, user2Id]
      : [user2Id, user1Id];

    return db.prepare(`
      SELECT * FROM conversations
      WHERE user1Id = ? AND user2Id = ?
    `).get(smallerId, largerId);
  }

  /**
   * Send a message in a conversation
   */
  static sendMessage(conversationId, senderId, content) {
    const stmt = db.prepare(`
      INSERT INTO messages (conversationId, senderId, content)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(conversationId, senderId, content);

    // Update conversation's lastMessageAt
    db.prepare(`
      UPDATE conversations SET lastMessageAt = CURRENT_TIMESTAMP WHERE id = ?
    `).run(conversationId);

    return this.getMessageById(result.lastInsertRowid);
  }

  /**
   * Get message by ID
   */
  static getMessageById(id) {
    const msg = db.prepare(`
      SELECT m.*, u.username as senderUsername, u.name as senderName
      FROM messages m
      INNER JOIN users u ON m.senderId = u.id
      WHERE m.id = ?
    `).get(id);
    if (msg) msg.read = msg.read === 1;
    return msg;
  }

  /**
   * Get messages in a conversation with pagination
   */
  static getConversationMessages(conversationId, limit = 50, offset = 0) {
    return db.prepare(`
      SELECT m.*, u.username as senderUsername, u.name as senderName
      FROM messages m
      INNER JOIN users u ON m.senderId = u.id
      WHERE m.conversationId = ?
      ORDER BY m.createdAt DESC
      LIMIT ? OFFSET ?
    `).all(conversationId, limit, offset).map(m => ({ ...m, read: m.read === 1 }));
  }

  /**
   * Get all conversations for a user with last message preview
   */
  static getUserConversations(userId) {
    const conversations = db.prepare(`
      SELECT c.*,
        u1.username as user1Username, u1.name as user1Name,
        u2.username as user2Username, u2.name as user2Name
      FROM conversations c
      INNER JOIN users u1 ON c.user1Id = u1.id
      INNER JOIN users u2 ON c.user2Id = u2.id
      WHERE c.user1Id = ? OR c.user2Id = ?
      ORDER BY c.lastMessageAt DESC NULLS LAST
    `).all(userId, userId);

    // Add last message and unread count for each conversation
    return conversations.map(conv => {
      const lastMessage = db.prepare(`
        SELECT m.*, u.name as senderName
        FROM messages m
        INNER JOIN users u ON m.senderId = u.id
        WHERE m.conversationId = ?
        ORDER BY m.createdAt DESC
        LIMIT 1
      `).get(conv.id);

      const unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE conversationId = ? AND senderId != ? AND read = 0
      `).get(conv.id, userId).count;

      // Get the other user's info
      const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const otherUser = conv.user1Id === userId
        ? { id: conv.user2Id, username: conv.user2Username, name: conv.user2Name }
        : { id: conv.user1Id, username: conv.user1Username, name: conv.user1Name };

      return {
        ...conv,
        otherUser,
        lastMessage,
        unreadCount,
      };
    });
  }

  /**
   * Mark all messages in a conversation as read for a user
   */
  static markConversationAsRead(conversationId, userId) {
    return db.prepare(`
      UPDATE messages SET read = 1
      WHERE conversationId = ? AND senderId != ? AND read = 0
    `).run(conversationId, userId);
  }

  /**
   * Get total unread message count for a user
   */
  static getUnreadCount(userId) {
    // Get all conversations the user is part of
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      INNER JOIN conversations c ON m.conversationId = c.id
      WHERE (c.user1Id = ? OR c.user2Id = ?)
        AND m.senderId != ?
        AND m.read = 0
    `).get(userId, userId, userId);

    return result.count;
  }

  /**
   * Delete a message (only by sender)
   */
  static deleteMessage(messageId, userId) {
    return db.prepare('DELETE FROM messages WHERE id = ? AND senderId = ?').run(messageId, userId);
  }
}

module.exports = Message;
