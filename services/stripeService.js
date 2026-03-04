const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = require('../database/db');

console.log('💳 Stripe Service Initialized');
console.log(`   - Secret Key: ${process.env.STRIPE_SECRET_KEY ? '✅ Set (' + process.env.STRIPE_SECRET_KEY.slice(0, 7) + '...)' : '❌ Missing'}`);
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
          db.prepare(`UPDATE vault_splits SET paid = 1, paidViaStripe = 1, paidAt = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(parseInt(splitId));
          db.prepare(`UPDATE vault_transactions SET status = 'completed', completedAt = CURRENT_TIMESTAMP WHERE stripePaymentIntentId = ?`)
            .run(pi.id);
          console.log(`✅ Vault split ${splitId} marked as paid via Stripe`);
        } else if (vaultId && memberId) {
          db.prepare(`UPDATE vault_members SET status = 'paid' WHERE id = ? AND vault_id = ?`)
            .run(parseInt(memberId), parseInt(vaultId));
          console.log(`✅ Vault member ${memberId} marked as paid`);
        }
        break;
      }
      case 'charge.dispute.created': {
        const charge = event.data.object;
        const piId = charge.payment_intent;
        if (piId) {
          const member = db.prepare('SELECT vault_id FROM vault_members WHERE stripe_payment_intent_id = ?').get(piId);
          if (member) {
            db.prepare(`UPDATE vaults SET status = 'frozen' WHERE id = ?`).run(member.vault_id);
            console.log(`⚠️ Vault ${member.vault_id} frozen due to dispute`);
          }
        }
        break;
      }
      default:
        console.log('ℹ️ Unhandled webhook event type:', event.type);
    }
  }
}

module.exports = { StripeService, calculateChargedAmount };
