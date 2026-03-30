const db = require('../database/db');

class Adventure {
  static create(adventureData) {
    const { title, description, location, category, difficulty, imageUrl, createdBy } = adventureData;

    const stmt = db.prepare(`
      INSERT INTO adventures (title, description, location, category, difficulty, imageUrl, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title, description, location, category, difficulty, imageUrl, createdBy ?? null);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM adventures WHERE id = ?');
    return stmt.get(id);
  }

  static getAll() {
    const stmt = db.prepare('SELECT * FROM adventures ORDER BY createdAt DESC');
    return stmt.all();
  }

  static getByCategory(category) {
    const stmt = db.prepare('SELECT * FROM adventures WHERE category = ? ORDER BY createdAt DESC');
    return stmt.all(category);
  }

  static getByDifficulty(difficulty) {
    const stmt = db.prepare('SELECT * FROM adventures WHERE difficulty = ? ORDER BY createdAt DESC');
    return stmt.all(difficulty);
  }

  static search(query) {
    const stmt = db.prepare(`
      SELECT * FROM adventures
      WHERE title LIKE ? OR description LIKE ? OR location LIKE ?
      ORDER BY createdAt DESC
    `);

    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, searchTerm);
  }

  static update(id, updates) {
    const allowedFields = ['title', 'description', 'location', 'category', 'difficulty', 'imageUrl'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);

    const stmt = db.prepare(`
      UPDATE adventures SET ${setClause} WHERE id = ?
    `);

    stmt.run(...values, id);
    return this.findById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM adventures WHERE id = ?');
    return stmt.run(id);
  }
}

module.exports = Adventure;
