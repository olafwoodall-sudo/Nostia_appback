const db = require('../database/db');

class Payment {
  static addPaymentMethod(userId, stripePaymentMethodId, details) {
    const stmt = db.prepare(`
      INSERT INTO payment_methods
      (userId, stripePaymentMethodId, type, brand, last4, expiryMonth, expiryYear, isDefault)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      userId,
      stripePaymentMethodId,
      details.type || 'card',
      details.brand,
      details.last4,
      details.expiryMonth,
      details.expiryYear,
      details.isDefault ? 1 : 0
    );
  }

  static getUserPaymentMethods(userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE userId = ?
      ORDER BY isDefault DESC, createdAt DESC
    `).all(userId);
  }

  static setDefaultPaymentMethod(userId, paymentMethodId) {
    return db.transaction(() => {
      db.prepare('UPDATE payment_methods SET isDefault = 0 WHERE userId = ?').run(userId);
      return db.prepare('UPDATE payment_methods SET isDefault = 1 WHERE id = ? AND userId = ?')
        .run(paymentMethodId, userId);
    })();
  }

  static deletePaymentMethod(id, userId) {
    return db.prepare('DELETE FROM payment_methods WHERE id = ? AND userId = ?').run(id, userId);
  }

  static getDefaultPaymentMethod(userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE userId = ? AND isDefault = 1
      LIMIT 1
    `).get(userId);
  }

  static getPaymentMethod(id, userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE id = ? AND userId = ?
    `).get(id, userId);
  }
}

module.exports = Payment;
