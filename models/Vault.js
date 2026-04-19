const db = require('../database/db');

class Vault {
  // Create a vault entry (expense)
  static createEntry(entryData) {
    const { tripId, description, amount, currency, paidBy, category, date, splits } = entryData;

    const stmt = db.prepare(`
      INSERT INTO vault_entries (tripId, description, amount, currency, paidBy, category, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      tripId,
      description,
      amount,
      currency || 'USD',
      paidBy,
      category || 'general',
      date || new Date().toISOString()
    );

    const entryId = result.lastInsertRowid;

    // Add splits if provided
    if (splits && Array.isArray(splits)) {
      splits.forEach(split => {
        this.addSplit(entryId, split.userId, split.amount);
      });
    }

    return this.findById(entryId);
  }

  // Find entry by ID
  static findById(id) {
    const stmt = db.prepare(`
      SELECT ve.*, u.username as paidByUsername, u.name as paidByName
      FROM vault_entries ve
      INNER JOIN users u ON ve.paidBy = u.id
      WHERE ve.id = ?
    `);

    const entry = stmt.get(id);

    if (entry) {
      entry.splits = this.getSplits(id);
    }

    return entry;
  }

  // Get all entries for a trip
  static getTripEntries(tripId) {
    const stmt = db.prepare(`
      SELECT ve.*, u.username as paidByUsername, u.name as paidByName
      FROM vault_entries ve
      INNER JOIN users u ON ve.paidBy = u.id
      WHERE ve.tripId = ?
      ORDER BY ve.date DESC
    `);

    const entries = stmt.all(tripId);

    entries.forEach(entry => {
      entry.splits = this.getSplits(entry.id);
    });

    return entries;
  }

  // Get trip summary (total expenses, balances)
  static getTripSummary(tripId, userId = null) {
    const entries = this.getTripEntries(tripId);

    const totalExpenses = entries.reduce((sum, entry) => sum + entry.amount, 0);

    // Calculate balances
    const balances = {};

    entries.forEach(entry => {
      // Person who paid
      if (!balances[entry.paidBy]) {
        balances[entry.paidBy] = {
          userId: entry.paidBy,
          username: entry.paidByUsername,
          name: entry.paidByName,
          paid: 0,
          owes: 0,
          balance: 0
        };
      }

      balances[entry.paidBy].paid += entry.amount;

      // People who owe
      entry.splits.forEach(split => {
        if (!balances[split.userId]) {
          balances[split.userId] = {
            userId: split.userId,
            username: split.username,
            name: split.name,
            paid: 0,
            owes: 0,
            balance: 0
          };
        }

        balances[split.userId].owes += split.amount;
      });
    });

    // Calculate net balances
    Object.values(balances).forEach(user => {
      user.balance = user.paid - user.owes;
    });

    // Get unpaid splits for the current user
    let unpaidSplits = [];
    if (userId) {
      unpaidSplits = this.getUserUnpaidSplits(tripId, userId);
    }

    return {
      tripId,
      totalAmount: totalExpenses,
      entryCount: entries.length,
      balances: Object.values(balances).map(b => ({ id: b.userId, name: b.name, paid: b.paid, owes: b.owes, balance: b.balance })),
      entries,
      unpaidSplits
    };
  }

  // Get unpaid splits for a specific user in a trip
  static getUserUnpaidSplits(tripId, userId) {
    const stmt = db.prepare(`
      SELECT
        vs.id, vs.vaultEntryId, vs.userId, vs.amount, vs.paid,
        ve.description, ve.paidBy, ve.category, ve.date, ve.currency,
        payer.username as paidByUsername, payer.name as paidByName
      FROM vault_splits vs
      INNER JOIN vault_entries ve ON vs.vaultEntryId = ve.id
      INNER JOIN users payer ON ve.paidBy = payer.id
      WHERE ve.tripId = ? AND vs.userId = ? AND vs.paid = 0 AND ve.paidBy != vs.userId
      ORDER BY ve.date DESC
    `);

    return stmt.all(tripId, userId);
  }

  // Add a split to an entry
  static addSplit(vaultEntryId, userId, amount) {
    const stmt = db.prepare(`
      INSERT INTO vault_splits (vaultEntryId, userId, amount)
      VALUES (?, ?, ?)
    `);

    return stmt.run(vaultEntryId, userId, amount);
  }

  // Get splits for an entry
  static getSplits(vaultEntryId) {
    const stmt = db.prepare(`
      SELECT vs.id, vs.vaultEntryId, vs.userId, vs.amount, vs.paid, vs.paidAt,
             u.name as userName
      FROM vault_splits vs
      INNER JOIN users u ON vs.userId = u.id
      WHERE vs.vaultEntryId = ?
    `);

    return stmt.all(vaultEntryId);
  }

  // Mark split as paid
  static markSplitPaid(splitId) {
    const stmt = db.prepare(`
      UPDATE vault_splits SET paid = 1 WHERE id = ?
    `);

    return stmt.run(splitId);
  }

  // Delete entry
  static deleteEntry(id) {
    const stmt = db.prepare('DELETE FROM vault_entries WHERE id = ?');
    return stmt.run(id);
  }
}

module.exports = Vault;
