const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = require('../database/db');

console.log('💳 Stripe Service Initialized');
console.log(`   - Secret Key: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   - Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);

function calculateChargedAmount(owed) {
  const percent = 0.029;
  const flat = 0.30;
  return Math.ceil((owed + flat) / (1 - percent) * 100) / 100;
}

class StripeService {
  static calculateChargedAmount(owed) {
    return calculateChargedAmount(owed);
  }

  static async createConnectAccount() {
    return stripe.accounts.create({ type: 'standard' });
  }

  static async getOrCreateConnectAccount(userId) {
    const user = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');
    if (user.stripe_account_id) return user.stripe_account_id;

    const account = await this.createConnectAccount();
    db.prepare('UPDATE users SET stripe_account_id = ?, onboarding_complete = 0 WHERE id = ?')
      .run(account.id, userId);
    return account.id;
  }

  static async createOnboardingLink(userId) {
    const accountId = await this.getOrCreateConnectAccount(userId);
    const appUrl = process.env.APP_URL || 'https://app.nostia.com';
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/reauth`,
      return_url: `${appUrl}/success`,
      type: 'account_onboarding'
    });
    return { url: link.url, accountId };
  }

  static async checkOnboardingComplete(userId) {
    const user = db.prepare('SELECT stripe_account_id, onboarding_complete FROM users WHERE id = ?').get(userId);
    if (!user?.stripe_account_id) return false;

    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    const complete = account.details_submitted;
    if (complete && !user.onboarding_complete) {
      db.prepare('UPDATE users SET onboarding_complete = 1 WHERE id = ?').run(userId);
    }
    return complete;
  }

  static async createVaultPaymentIntent(vaultId, memberId) {
    const vault = db.prepare('SELECT * FROM vaults WHERE id = ?').get(vaultId);
    if (!vault) throw new Error('Vault not found');

    const member = db.prepare('SELECT * FROM vault_members WHERE id = ? AND vault_id = ?').get(memberId, vaultId);
    if (!member) throw new Error('Vault member not found');
    if (member.status === 'paid') throw new Error('This split has already been paid');

    const owner = db.prepare('SELECT stripe_account_id, onboarding_complete FROM users WHERE id = ?').get(vault.owner_id);
    if (!owner?.stripe_account_id || !owner.onboarding_complete) {
      throw new Error('Vault owner has not completed Stripe onboarding');
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(member.charged_amount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: owner.stripe_account_id,
        amount: Math.round(member.owed_amount * 100)
      },
      metadata: {
        vaultId: vaultId.toString(),
        memberId: memberId.toString()
      }
    });

    db.prepare('UPDATE vault_members SET stripe_payment_intent_id = ? WHERE id = ?')
      .run(intent.id, memberId);

    return intent;
  }

  static async handleWebhook(event) {
    console.log('📥 Processing Stripe Webhook:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const { vaultId, memberId, splitId, type } = pi.metadata || {};
        if (type === 'vault_split' && splitId) {
          const splitIdInt = parseInt(splitId, 10);
          if (!Number.isInteger(splitIdInt)) { console.error('Webhook: invalid splitId in metadata', pi.id); break; }
          db.prepare(`UPDATE vault_splits SET paid = 1, paidViaStripe = 1, paidAt = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(splitIdInt);
          db.prepare(`UPDATE vault_transactions SET status = 'completed', completedAt = CURRENT_TIMESTAMP WHERE stripePaymentIntentId = ?`)
            .run(pi.id);
          console.log(`✅ Vault split ${splitId} marked as paid via Stripe`);
        } else if (vaultId && memberId) {
          const memberIdInt = parseInt(memberId, 10);
          const vaultIdInt = parseInt(vaultId, 10);
          if (!Number.isInteger(memberIdInt) || !Number.isInteger(vaultIdInt)) { console.error('Webhook: invalid member/vault id in metadata', pi.id); break; }
          db.prepare(`UPDATE vault_members SET status = 'paid' WHERE id = ? AND vault_id = ?`)
            .run(memberIdInt, vaultIdInt);
          console.log(`✅ Vault member ${memberId} marked as paid`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const { splitId, type, vaultId, memberId } = pi.metadata || {};
        const reason = pi.last_payment_error?.message || 'Payment failed';
        if (type === 'vault_split' && splitId) {
          const splitIdInt = parseInt(splitId, 10);
          if (!Number.isInteger(splitIdInt)) { console.error('Webhook: invalid splitId in metadata', pi.id); break; }
          db.prepare(`UPDATE vault_transactions SET status = 'failed', failureReason = ? WHERE stripePaymentIntentId = ?`)
            .run(reason, pi.id);
          console.log(`❌ Vault split ${splitId} payment failed: ${reason}`);
        } else if (vaultId && memberId) {
          const memberIdInt = parseInt(memberId, 10);
          const vaultIdInt = parseInt(vaultId, 10);
          if (!Number.isInteger(memberIdInt) || !Number.isInteger(vaultIdInt)) { console.error('Webhook: invalid member/vault id in metadata', pi.id); break; }
          db.prepare(`UPDATE vault_members SET status = 'failed' WHERE id = ? AND vault_id = ?`)
            .run(memberIdInt, vaultIdInt);
          console.log(`❌ Vault member ${memberId} payment failed: ${reason}`);
        }
        break;
      }

      case 'charge.dispute.created': {
        const charge = event.data.object;
        const piId = charge.payment_intent;
        if (piId) {
          // Handle dispute for trip expense split (vault_transactions)
          const txn = db.prepare('SELECT vaultSplitId FROM vault_transactions WHERE stripePaymentIntentId = ?').get(piId);
          if (txn) {
            db.prepare(`UPDATE vault_splits SET disputeFlag = 1 WHERE id = ?`).run(txn.vaultSplitId);
            db.prepare(`UPDATE vault_transactions SET status = 'disputed' WHERE stripePaymentIntentId = ?`).run(piId);
            console.log(`⚠️ Vault split ${txn.vaultSplitId} flagged for dispute`);
          }
          // Handle dispute for vault_members (legacy vault system)
          const member = db.prepare('SELECT vault_id, id FROM vault_members WHERE stripe_payment_intent_id = ?').get(piId);
          if (member) {
            db.prepare(`UPDATE vault_members SET disputeFlag = 1 WHERE id = ?`).run(member.id);
            db.prepare(`UPDATE vaults SET status = 'frozen' WHERE id = ?`).run(member.vault_id);
            console.log(`⚠️ Vault ${member.vault_id} frozen due to dispute`);
          }
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object;
        const piId = transfer.source_transaction;
        if (piId) {
          db.prepare(`UPDATE vault_transactions SET transferId = ? WHERE stripePaymentIntentId = ?`)
            .run(transfer.id, piId);
        }
        console.log(`💸 Transfer ${transfer.id} created: $${(transfer.amount / 100).toFixed(2)}`);
        break;
      }

      default:
        console.log('ℹ️ Unhandled webhook event type:', event.type);
    }
  }
}

module.exports = { StripeService, calculateChargedAmount };
