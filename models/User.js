const db = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
  static create(userData) {
    const { username, email, password, name } = userData;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, name)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(username, email, hashedPassword, name);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    if (user) {
      delete user.password;
      delete user.latitude;
      delete user.longitude;
    }
    return user;
  }

  // Internal method that retains location data (for server-side logic only)
  static findByIdInternal(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    if (user) {
      delete user.password;
    }
    return user;
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    return stmt.get(username);
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  static findByRole(role) {
    const stmt = db.prepare('SELECT id, username, email, name, role, homeStatus, createdAt FROM users WHERE role = ?');
    return stmt.all(role);
  }

  static update(id, updates) {
    const allowedFields = ['name', 'username', 'email', 'homeStatus', 'latitude', 'longitude', 'role'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);

    const stmt = db.prepare(`
      UPDATE users SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `);

    stmt.run(...values, id);
    return this.findById(id);
  }

  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  static getAll() {
    const stmt = db.prepare('SELECT id, username, email, name, homeStatus, createdAt FROM users');
    return stmt.all();
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  }
}

module.exports = User;
