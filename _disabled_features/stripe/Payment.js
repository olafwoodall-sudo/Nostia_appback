const db = require('../database/db');

class Payment {
  /**
   * Add a payment method for a user
   * @param {number} userId - User ID
   * @param {string} stripePaymentMethodId - Stripe payment method ID
   * @param {object} details - Payment method details (type, brand, last4, etc.)
   * @returns {object} Insert result
   */
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

  /**
   * Get all payment methods for a user
   * @param {number} userId - User ID
   * @returns {Array} List of payment methods
   */
  static getUserPaymentMethods(userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE userId = ?
      ORDER BY isDefault DESC, createdAt DESC
    `).all(userId);
  }

  /**
   * Set a payment method as default
   * @param {number} userId - User ID
   * @param {number} paymentMethodId - Payment method ID
   * @returns {object} Update result
   */
  static setDefaultPaymentMethod(userId, paymentMethodId) {
    // First, unset all defaults for this user
    db.prepare('UPDATE payment_methods SET isDefault = 0 WHERE userId = ?')
      .run(userId);

    // Then set the new default
    return db.prepare('UPDATE payment_methods SET isDefault = 1 WHERE id = ? AND userId = ?')
      .run(paymentMethodId, userId);
  }

  /**
   * Delete a payment method
   * @param {number} id - Payment method ID
   * @param {number} userId - User ID (for security check)
   * @returns {object} Delete result
   */
  static deletePaymentMethod(id, userId) {
    return db.prepare('DELETE FROM payment_methods WHERE id = ? AND userId = ?')
      .run(id, userId);
  }

  /**
   * Get default payment method for a user
   * @param {number} userId - User ID
   * @returns {object|null} Default payment method or null
   */
  static getDefaultPaymentMethod(userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE userId = ? AND isDefault = 1
      LIMIT 1
    `).get(userId);
  }

  /**
   * Get a specific payment method
   * @param {number} id - Payment method ID
   * @param {number} userId - User ID (for security check)
   * @returns {object|null} Payment method or null
   */
  static getPaymentMethod(id, userId) {
    return db.prepare(`
      SELECT * FROM payment_methods
      WHERE id = ? AND userId = ?
    `).get(id, userId);
  }
}

module.exports = Payment;
