# Disabled Features

These features have been temporarily removed for the initial production launch.
They are preserved here for future re-integration.

## stripe/
- `stripeService.js` — Payment intent creation, customer management, webhook handling, transaction history
- `Payment.js` — Payment methods model (saved cards, default payment method)

**To re-enable Stripe:**
1. Move files back to `services/` and `models/`
2. Add `const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);` to top of `server.js`
3. Add `const StripeService = require('./services/stripeService');` and `const Payment = require('./models/Payment');` imports
4. Restore payment routes (`/api/payments/*`, `/api/webhooks/stripe`, `/api/payment-methods/*`) in `server.js`
5. Add `"stripe": "^14.25.0"` back to root `package.json`
6. Restore `paymentsAPI` in `nostia-mobile/src/services/api.ts`
7. Add `"@stripe/stripe-react-native": "^0.50.3"` to `nostia-mobile/package.json`
8. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in DigitalOcean environment variables

## ai/
- `aiService.js` — Content generation (itineraries, trip summaries, event descriptions) and chat via DeepSeek
- `AIChatModal.tsx` — Full AI chat UI component (trip planning assistant)

**To re-enable AI:**
1. Move `aiService.js` back to `services/`
2. Move `AIChatModal.tsx` back to `nostia-mobile/src/components/`
3. Add `const AIService = require('./services/aiService');` import to `server.js`
4. Restore AI routes (`POST /api/ai/generate`, `POST /api/ai/chat`) in `server.js`
5. Restore `aiAPI` in `nostia-mobile/src/services/api.ts`
6. Re-add `import AIChatModal` and floating AI button to `HomeScreen.tsx`
7. Re-add `aiAPI` import and `handleGenerateItinerary` to `CreateTripModal.tsx`
8. Set `DEEPSEEK_URL`, `DEEPSEEK_MODEL`, `AI_TIMEOUT` in environment variables
