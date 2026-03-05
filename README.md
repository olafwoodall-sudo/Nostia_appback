# NOSTIA MVP - Social Adventure Platform

A full-stack social adventure platform with friend management, trip planning, expense tracking (Vault), adventure discovery, real-time notifications, direct messaging, and AI-powered trip planning.

## Features

- **Authentication** - Secure login/register with JWT tokens
- **Friend Management** - Add friends, manage requests, view friend status
- **Trip Planning** - Create trips, invite participants, track expenses
- **Vault (Expense Tracking)** - Split expenses, track balances, Stripe payments
- **Adventure Discovery** - Browse and discover adventures by category
- **Social Feed** - Photo feed with likes, comments, and image uploads
- **Notifications** - Real-time notifications for friend requests, trip invitations, and more
- **Direct Messaging** - Chat with friends
- **Nearby Events** - Location-based event discovery using GPS
- **Friend House Status** - See if friends' homes are open/closed for visits
- **AI Trip Assistant** - AI-powered travel planning with itinerary generation

## Architecture

- **Frontend:** React Native mobile app (Expo Go)
- **Backend:** Node.js + Express
- **Database:** SQLite
- **AI:** Local DeepSeek model (with template fallback)
- **Payments:** Stripe integration

## Project Structure

```
nostia-app/
├── server.js                    # Main Express server
├── database/
│   └── db.js                    # SQLite database initialization
├── models/                      # Data models
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
│   ├── aiService.js             # AI integration
│   ├── stripeService.js         # Stripe payments
│   └── notificationService.js   # Push notifications
├── nostia-mobile/               # React Native mobile app (Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── TripsScreen.tsx
│   │   │   ├── FriendsScreen.tsx
│   │   │   ├── VaultScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   └── NotificationsScreen.tsx
│   │   ├── components/
│   │   │   ├── AIChatModal.tsx
│   │   │   ├── CreatePostModal.tsx
│   │   │   └── CommentsModal.tsx
│   │   └── services/
│   │       ├── api.ts
│   │       ├── location.ts
│   │       └── notifications.ts
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Expo Go app on your phone (iOS or Android)

### 1. Install backend dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=3000
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional - for local AI model:
DEEPSEEK_URL=http://localhost:11434/api/generate
DEEPSEEK_MODEL=deepseek-r1:1.5b
```

### 3. Start the backend server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

### 4. Install mobile dependencies

```bash
cd nostia-mobile
npm install
```

### 5. Configure mobile API URL

The mobile app reads the API URL from the `EXPO_PUBLIC_API_URL` environment variable. Create `nostia-mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR-LOCAL-IP:3000/api
```

Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### 6. Start the mobile app

```bash
cd nostia-mobile
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Test Credentials

| Username | Password | Name |
|----------|----------|------|
| testuser | password123 | Test User |
| alex_explorer | password123 | Alex Rivera |
| sarah_wanderer | password123 | Sarah Chen |

## Stripe Payments

### Setup
1. Create account at [stripe.com](https://stripe.com)
2. Add keys to `.env` (see above)

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

### Webhook (local testing)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## AI Integration

The AI assistant falls back to templates if no local model is configured.

To use a local model (optional):
```bash
# Install Ollama, then:
ollama run deepseek-r1:1.5b
```

Set `DEEPSEEK_URL` and `DEEPSEEK_MODEL` in `.env`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile

### Friends
- `GET /api/friends` - Get all friends
- `GET /api/friends/requests` - Get friend requests
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept/:requestId` - Accept request
- `DELETE /api/friends/reject/:requestId` - Reject request

### Trips
- `GET /api/trips` - Get user trips
- `POST /api/trips` - Create trip
- `DELETE /api/trips/:id` - Delete trip
- `POST /api/trips/:id/invite` - Invite user to trip

### Feed
- `GET /api/feed` - Get user feed
- `POST /api/feed` - Create post
- `POST /api/feed/:id/like` - Like post
- `DELETE /api/feed/:id/like` - Unlike post
- `GET /api/feed/:id/comments` - Get comments
- `POST /api/feed/:id/comments` - Add comment

### Events
- `GET /api/events/upcoming` - Get upcoming events
- `GET /api/events/nearby?lat=X&lng=Y&radius=50` - Get nearby events

### Notifications
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

### Messages
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create/get conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message

### AI
- `POST /api/ai/generate` - Generate content (itinerary, summary)
- `POST /api/ai/chat` - Chat with AI assistant

### Vault
- `GET /api/vault/trip/:tripId` - Get trip expenses
- `POST /api/vault` - Create expense
- `PUT /api/vault/splits/:splitId/paid` - Mark as paid

### Stripe
- `POST /api/stripe/payment-intent` - Create payment intent
- `POST /api/stripe/webhook` - Stripe webhook handler

## Security

- JWT authentication (7-day expiration)
- Password hashing with bcrypt
- Secure token storage (SecureStore on mobile)
- Protected API routes

## License

MIT
