# NOSTIA — Social Adventure Platform

A full-stack social adventure platform with friend management, trip planning, expense tracking (Vault), adventure discovery, real-time notifications, direct messaging, and AI-powered trip planning.

## Features

- **Authentication** — Secure login/register with JWT tokens
- **Friend Management** — Add friends, manage requests, view friend status
- **Trip Planning** — Create trips, invite participants, track expenses
- **Vault (Expense Tracking)** — Split expenses, track balances, Stripe card payments
- **Adventure Discovery** — Browse and discover adventures by category
- **Social Feed** — Photo feed with likes, comments, and image uploads
- **Notifications** — Push notifications for friend requests, trip invitations, and more
- **Direct Messaging** — Chat with friends
- **Nearby Events** — Location-based event discovery using GPS
- **Friend House Status** — See if friends' homes are open/closed for visits
- **AI Trip Assistant** — AI-powered travel planning with itinerary generation

## Architecture

| Layer | Tech |
|-------|------|
| Mobile | React Native (Expo) |
| Backend | Node.js + Express — hosted on DigitalOcean App Platform |
| Database | SQLite (persisted on DO) |
| Payments | Stripe Connect (live) |
| Push Notifications | Expo Push Notification Service |

## Project Structure

```
nostia-app/
├── server.js                    # Main Express server
├── database/
│   └── db.js                    # SQLite schema + migrations
├── models/                      # Data access layer
│   ├── User.js
│   ├── Friend.js
│   ├── Trip.js
│   ├── Event.js
│   ├── Vault.js
│   ├── Feed.js
│   ├── Adventure.js
│   └── Message.js
├── middleware/
│   └── auth.js                  # JWT authentication
├── services/
│   ├── stripeService.js         # Stripe Connect + webhook handling
│   └── notificationService.js   # Expo push notifications
└── nostia-mobile/               # React Native mobile app
    ├── app.json                 # Expo config (package ID, version)
    ├── App.tsx                  # Root: StripeProvider + Navigation
    └── src/
        ├── screens/
        │   ├── HomeScreen.tsx
        │   ├── TripsScreen.tsx
        │   ├── FriendsScreen.tsx
        │   ├── VaultScreen.tsx
        │   ├── ChatScreen.tsx
        │   └── NotificationsScreen.tsx
        ├── components/
        └── services/
            ├── api.ts           # Axios client pointed at production API
            └── notifications.ts
```

---

## Running the Mobile App Against the Production Backend

The backend is deployed at:
```
https://king-prawn-app-44tki.ondigitalocean.app
```

You do **not** need to run the backend locally. The mobile app is pre-configured to point at the production server.

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS or Android) — [expo.dev/go](https://expo.dev/go)

### 1. Install mobile dependencies

```bash
cd nostia-mobile
npm install
```

### 2. Check the environment file

`nostia-mobile/.env` should already contain:

```env
EXPO_PUBLIC_API_URL=https://king-prawn-app-44tki.ondigitalocean.app/api
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

These point the app directly at the production API and live Stripe. No local backend needed.

### 3. Start Expo

```bash
cd nostia-mobile
npx expo start
```

Scan the QR code in the terminal with **Expo Go** on your phone.

> **Note:** The app uses live Stripe keys. Any card payments made during testing will be real charges. Use Stripe's [test card numbers](https://stripe.com/docs/testing#cards) only if you switch to test mode keys.

---

## Running the Backend Locally (Optional)

Only needed if you're developing or testing backend changes before deploying.

### 1. Install backend dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=any-local-secret-32-chars-min

# Stripe — use TEST keys for local dev, never live keys locally
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS (not enforced in development)
ALLOWED_ORIGINS=http://localhost:3000
```

### 3. Start the backend

```bash
# With auto-reload (development)
npm run dev

# Production-like
npm start
```

Server runs at `http://localhost:3000`.

### 4. Point the mobile app at local backend

Update `nostia-mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR-LOCAL-IP:3000/api
```

Find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux). Must be your LAN IP, not `localhost`, so your phone can reach it.

### 5. Local Stripe webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Deploying Backend Changes to DigitalOcean

Push to `main` — DigitalOcean Auto-Deploy picks it up automatically.

```bash
git add .
git commit -m "your message"
git push origin main
```

The DO app rebuilds and redeploys. Monitor progress in the DO dashboard under **Runtime Logs**.

---

## Stripe Setup

### Webhook events to enable (Stripe Dashboard → Developers → Webhooks)

| Event | Purpose |
|-------|---------|
| `payment_intent.succeeded` | Mark split as paid |
| `payment_intent.payment_failed` | Mark transaction as failed |
| `charge.dispute.created` | Flag disputed splits, freeze vault |
| `transfer.created` | Record transfer ID on transaction |

Webhook endpoint:
```
https://king-prawn-app-44tki.ondigitalocean.app/api/stripe/webhook
```

### Stripe Connect onboarding flow

Users who paid an expense must complete Stripe Connect onboarding before trip-mates can pay them via card. The app guides them through this in the Vault screen.

---

## Security

- JWT authentication (7-day expiration), tokens stored in SecureStore
- Passwords hashed with bcrypt
- HTTPS enforced in production via `x-forwarded-proto` header check
- CORS restricted to `ALLOWED_ORIGINS` in production
- Rate limiting: 15 req/15 min on auth, 10 req/15 min on payment endpoints, 300 req/15 min general
- Stripe webhook signatures verified on every event
- Sensitive audit actions logged to `audit_log` DB table

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/users/me` | Get current user |
| PUT | `/api/users/me` | Update profile |

### Friends
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/friends` | Get all friends |
| GET | `/api/friends/requests` | Get pending requests |
| POST | `/api/friends/request` | Send friend request |
| POST | `/api/friends/accept/:id` | Accept request |
| DELETE | `/api/friends/reject/:id` | Reject request |

### Trips & Vault
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trips` | Get user trips |
| POST | `/api/trips` | Create trip |
| POST | `/api/trips/:id/invite` | Invite user |
| GET | `/api/vault/trip/:tripId` | Get trip expenses + balances |
| POST | `/api/vault` | Add expense |
| PUT | `/api/vault/splits/:splitId/paid` | Mark split settled (manual) |
| POST | `/api/vault/splits/:splitId/payment-intent` | Create Stripe PaymentIntent for split |

### Stripe
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stripe/connect/onboard` | Start Connect onboarding |
| GET | `/api/stripe/connect/status` | Check onboarding status |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

### Feed, Events, Notifications, Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | Get social feed |
| POST | `/api/feed` | Create post |
| GET | `/api/events/upcoming` | Upcoming events |
| GET | `/api/events/nearby?lat=X&lng=Y` | Nearby events |
| GET | `/api/notifications` | All notifications |
| PUT | `/api/notifications/read-all` | Mark all read |
| GET | `/api/conversations` | All conversations |
| POST | `/api/conversations/:id/messages` | Send message |

---

## License

MIT
