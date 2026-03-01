const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database/db');

// Log Stripe configuration status on load
console.log('💳 Stripe Service Initialized');
console.log(`   - Secret Key: ${process.env.STRIPE_SECRET_KEY ? '✅ Set (' + process.env.STRIPE_SECRET_KEY.slice(0, 7) + '...)' : '❌ Missing'}`);
console.log(`   - Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);

class StripeService {
  /**
   * Create a Stripe customer for a Nostia user
   * @param {number} userId - Nostia user ID
   * @param {string} email - User email
   * @param {string} name - User name
   * @returns {Promise<object>} Stripe customer object
   */
  static async createCustomer(userId, email, name) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { nostiaUserId: userId.toString() }
      });

      db.prepare(`
        INSERT INTO stripe_customers (userId, stripeCustomerId, email)
        VALUES (?, ?, ?)
      `).run(userId, customer.id, email);

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Get or create a Stripe customer for a user
   * @param {number} userId - Nostia user ID
   * @param {string} email - User email
   * @param {string} name - User name
   * @returns {Promise<string>} Stripe customer ID
   */
  static async getOrCreateCustomer(userId, email, name) {
    try {
      // Check if customer already exists
      const existing = db.prepare(
        'SELECT * FROM stripe_customers WHERE userId = ?'
      ).get(userId);

      if (existing) {
        return existing.stripeCustomerId;
      }

      // Create new customer
      const customer = await this.createCustomer(userId, email, name);
      return customer.id;
    } catch (error) {
      console.error('Error getting/creating customer:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent for a vault split
   * @param {number} amount - Amount in dollars
   * @param {string} currency - Currency code (usd, eur, etc.)
   * @param {number} payerUserId - User making the payment
   * @param {number} recipientUserId - User receiving the payment
   * @param {number} vaultSplitId - Vault split ID
   * @param {number} tripId - Trip ID
   * @returns {Promise<object>} Stripe payment intent
   */
  static async createPaymentIntent(amount, currency, payerUserId, recipientUserId, vaultSplitId, tripId) {
    console.log('💳 Creating Payment Intent:', {
      amount,
      currency,
      payerUserId,
      recipientUserId,
      vaultSplitId,
      tripId
    });

    try {
      // Get payer details
      const payer = db.prepare('SELECT * FROM users WHERE id = ?').get(payerUserId);

      if (!payer) {
        console.error('❌ Payer not found:', payerUserId);
        throw new Error('Payer user not found');
      }

      console.log('   - Payer found:', payer.name, payer.email || '(no email)');

      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(
        payerUserId,
        payer.email,
        payer.name
      );

      console.log('   - Stripe customer ID:', customerId);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert dollars to cents
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata: {
          nostiaUserId: payerUserId.toString(),
          recipientUserId: recipientUserId.toString(),
          vaultSplitId: vaultSplitId.toString(),
          tripId: tripId.toString()
        },
        automatic_payment_methods: { enabled: true },
        description: `Nostia Trip Vault Payment - Split #${vaultSplitId}`
      });

      console.log('✅ Payment Intent created:', paymentIntent.id);

      // Record transaction in database
      db.prepare(`
        INSERT INTO vault_transactions (
          vaultSplitId, stripePaymentIntentId, amount, currency,
          status, payerUserId, recipientUserId, tripId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        vaultSplitId,
        paymentIntent.id,
        amount,
        currency,
        'pending',
        payerUserId,
        recipientUserId,
        tripId
      );

      return paymentIntent;
    } catch (error) {
      console.error('❌ Error creating payment intent:', error.message);
      console.error('   Full error:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  /**
   * Confirm a payment and update vault split
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Promise<object>} Transaction record
   */
  static async confirmPayment(paymentIntentId) {
    try {
      // Get transaction record
      const transaction = db.prepare(
        'SELECT * FROM vault_transactions WHERE stripePaymentIntentId = ?'
      ).get(paymentIntentId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Retrieve payment intent from Stripe to get charge details
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      const chargeId = paymentIntent.latest_charge;
      const stripeFee = paymentIntent.charges?.data[0]?.balance_transaction
        ? (await stripe.balanceTransactions.retrieve(paymentIntent.charges.data[0].balance_transaction)).fee / 100
        : 0;
      const netAmount = transaction.amount - stripeFee;

      // Update transaction status
      db.prepare(`
        UPDATE vault_transactions
        SET status = 'succeeded',
            completedAt = CURRENT_TIMESTAMP,
            stripeChargeId = ?,
            stripeFee = ?,
            netAmount = ?
        WHERE stripePaymentIntentId = ?
      `).run(chargeId, stripeFee, netAmount, paymentIntentId);

      // Mark vault split as paid
      db.prepare(`
        UPDATE vault_splits
        SET paid = 1,
            paidViaStripe = 1,
            paidAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transaction.vaultSplitId);

      // Return updated transaction
      return db.prepare(
        'SELECT * FROM vault_transactions WHERE stripePaymentIntentId = ?'
      ).get(paymentIntentId);
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for a trip
   * @param {number} tripId - Trip ID
   * @returns {Array} List of transactions
   */
  static getTransactionHistory(tripId) {
    try {
      return db.prepare(`
        SELECT
          vt.*,
          payer.username as payerUsername,
          payer.name as payerName,
          recipient.username as recipientUsername,
          recipient.name as recipientName
        FROM vault_transactions vt
        INNER JOIN users payer ON vt.payerUserId = payer.id
        INNER JOIN users recipient ON vt.recipientUserId = recipient.id
        WHERE vt.tripId = ?
        ORDER BY vt.createdAt DESC
      `).all(tripId);
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {object} event - Stripe webhook event
   */
  static async handleWebhook(event) {
    console.log('📥 Processing Stripe Webhook:', event.type);
    console.log('   - Event ID:', event.id);
    console.log('   - Object ID:', event.data.object.id);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('✅ Payment succeeded:', event.data.object.id);
          console.log('   - Amount:', event.data.object.amount / 100, event.data.object.currency);
          await this.confirmPayment(event.data.object.id);
          console.log('   - Vault split marked as paid');
          break;

        case 'payment_intent.payment_failed':
          console.log('❌ Payment failed:', event.data.object.id);
          const errorMessage = event.data.object.last_payment_error?.message || 'Payment failed';
          console.log('   - Error:', errorMessage);

          db.prepare(`
            UPDATE vault_transactions
            SET status = 'failed',
                errorMessage = ?,
                completedAt = CURRENT_TIMESTAMP
            WHERE stripePaymentIntentId = ?
          `).run(errorMessage, event.data.object.id);
          break;

        case 'payment_intent.canceled':
          console.log('⚠️ Payment canceled:', event.data.object.id);
          db.prepare(`
            UPDATE vault_transactions
            SET status = 'canceled',
                completedAt = CURRENT_TIMESTAMP
            WHERE stripePaymentIntentId = ?
          `).run(event.data.object.id);
          break;

        case 'payment_intent.created':
          console.log('ℹ️ Payment intent created:', event.data.object.id);
          break;

        case 'charge.succeeded':
          console.log('ℹ️ Charge succeeded:', event.data.object.id);
          break;

        default:
          console.log('ℹ️ Unhandled webhook event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling webhook:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Get all unpaid splits for a user
   * @param {number} userId - User ID
   * @returns {Array} List of unpaid splits
   */
  static getUserUnpaidSplits(userId) {
    try {
      return db.prepare(`
        SELECT
          vs.*,
          ve.tripId,
          ve.description,
          ve.paidBy,
          ve.currency,
          ve.category,
          ve.date,
          t.title as tripTitle,
          t.destination as tripDestination,
          payer.username as paidByUsername,
          payer.name as paidByName
        FROM vault_splits vs
        INNER JOIN vault_entries ve ON vs.vaultEntryId = ve.id
        INNER JOIN trips t ON ve.tripId = t.id
        INNER JOIN users payer ON ve.paidBy = payer.id
        WHERE vs.userId = ?
          AND vs.paid = 0
          AND vs.stripePayable = 1
        ORDER BY ve.date DESC
      `).all(userId);
    } catch (error) {
      console.error('Error getting unpaid splits:', error);
      throw error;
    }
  }
}

module.exports = StripeService;
