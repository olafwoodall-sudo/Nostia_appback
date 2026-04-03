# Nostia — External Work TODO

Tasks that require action outside the codebase (accounts, dashboards, terminals).
See `EXTERNAL_GUIDE.html` for full step-by-step instructions on each item.

---

## BLOCKING — Nothing ships without these

- [ ] **1A** Audit git history for committed `.env` files — rotate all credentials if found
- [ ] **1B** DigitalOcean: set `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` as encrypted env vars
- [ ] **1C** DigitalOcean: configure persistent database volume at `/app/database` (stops DB wiping on redeploy)
- [ ] **1D** Generate Android release keystore (`nostia-release.jks`) + update `local.properties` passwords + **back up securely**
- [ ] **1E** Google Cloud: create Maps API key, restrict to `com.nostia.app` + SHA-1, update `app.json` + `local.properties`
- [ ] **1F** Apple Developer ($99/yr): register bundle ID `com.nostia.app`, enable Maps + Push Notifications capabilities

---

## HIGH — Fix before submitting to stores

- [ ] **2A** Stripe Dashboard: verify webhook endpoint + all 4 events enabled (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`, `transfer.created`)
- [ ] **2B** Android: implement OkHttp `CertificatePinner` with DigitalOcean domain SHA-256 hash
- [ ] **2C** iOS: add TrustKit (Swift Package) + configure certificate pinning for DigitalOcean domain
- [ ] **2D** iOS: add IOSSecuritySuite (Swift Package) + jailbreak check at app launch
- [ ] **2E** Android: add RootBeer library + root check in Application.onCreate()
- [ ] **2F** JWT refresh token architecture — new `/api/auth/refresh` endpoint + short-lived tokens on all clients
- [ ] **2G** expo.dev: get real Expo project ID → update `nostia-expo/src/services/notifications.ts`
- [ ] **2H** Run `npm audit --audit-level=high` in `nostia-expo/` — fix HIGH/CRITICAL findings
- [ ] **2I** Run `./gradlew dependencyUpdates` in `nostia-android/` — update Stripe SDK, OkHttp

---

## APP STORE SETUP

- [ ] **3A** Apple App Store Connect: create app entry, fill listing, upload screenshots, add privacy policy URL, submit build
- [ ] **3B** Google Play Console ($25 one-time): create app entry, fill listing, upload screenshots, upload signed AAB, complete data safety + content rating

---

## MEDIUM — Before/after launch

- [ ] **4A** EAS code signing: `eas update:configure` + `eas credentials` (only needed if using Expo OTA updates)
- [ ] **4B** All platforms: implement 15-min inactivity timeout before Vault/payment access
- [ ] **4C** Write and publish privacy policy at a stable public URL
- [ ] **4D** *(Optional)* Register custom domain + update DigitalOcean + regenerate SSL pin hash

---

## Placeholder Values Still in Code

| File | Value to Replace | Instructions |
|------|-----------------|--------------|
| `nostia-expo/app.json:17` | `PLACEHOLDER_IOS_BUNDLE_ID` | Step 1F |
| `nostia-expo/app.json:42` | `PLACEHOLDER_GOOGLE_MAPS_API_KEY` | Step 1E |
| `nostia-android/local.properties` | `your_google_maps_key` | Step 1E |
| `nostia-android/local.properties` | `your_password` (×2) | Step 1D |
| `nostia-expo/src/services/notifications.ts` | `'your-project-id'` | Step 2G |
