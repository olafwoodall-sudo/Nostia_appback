# Nostia — External Work TODO

Tasks that require action outside the codebase (accounts, dashboards, terminals).

---

## BLOCKING — Nothing ships without these

- [ ] **1A** Audit git history for committed `.env` files — rotate all credentials if found
- [x] **1B** ~~DigitalOcean: set env vars~~ — `.env` written to `/var/www/nostia-backend/.env` on VPS (chmod 600)
- [x] **1C** ~~Persistent DB~~ — DB at `/var/data/nostia/nostia.db`, outside app dir, survives redeploys
- [ ] **1D** Generate Android release keystore (`nostia-release.jks`) + update `local.properties` passwords + **back up securely**
- [ ] **1E** Google Cloud: create Maps API key, restrict to `com.nostia.app` + SHA-1, update `app.json` (`PLACEHOLDER_GOOGLE_MAPS_API_KEY`) + `local.properties`
- [ ] **1F** Apple Developer ($99/yr): register bundle ID `com.nostia.app`, enable Maps + Push Notifications capabilities
- [x] **1G** ~~Create Xcode project~~ — `nostia-ios-final/NostiaApp.xcodeproj` created, pushed to github.com/olafw666-cpu/nostia-ios
- [ ] **1H** Apple Developer: register Apple Pay Merchant ID `merchant.com.nostia` → add Apple Pay capability in Xcode → wire into `VaultViewModel.swift` PaymentSheet config

---

## HIGH — Fix before submitting to stores

- [ ] **2A** Stripe Dashboard: update webhook endpoint to `https://api.nostia.io/api/stripe/webhook` + verify all 4 events enabled (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`, `transfer.created`)
- [ ] **2B** Android: implement OkHttp `CertificatePinner` with `api.nostia.io` Let's Encrypt SHA-256 pin
- [ ] **2C** iOS: add TrustKit (Swift Package) + configure certificate pinning for `api.nostia.io`
- [ ] **2D** iOS: add IOSSecuritySuite (Swift Package) + jailbreak check at app launch
- [ ] **2E** Android: add RootBeer library + root check in `Application.onCreate()`
- [ ] **2F** JWT refresh token architecture — new `/api/auth/refresh` endpoint + short-lived tokens on all clients
- [ ] **2G** expo.dev: get real Expo project ID → update `nostia-expo/src/services/notifications.ts` (`'your-project-id'`)
- [x] **2H** ~~npm audit~~ — all HIGH/CRITICAL fixed. 1 moderate (`brace-expansion`) has no upstream fix yet.
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
- [x] **4D** ~~Custom domain~~ — `api.nostia.io` live with Let's Encrypt TLS (auto-renews). All frontends updated.

---

## Placeholder Values Still in Code

| File | Value to Replace | Status |
|------|-----------------|--------|
| `nostia-expo/app.json` | `PLACEHOLDER_GOOGLE_MAPS_API_KEY` | Needs Step 1E |
| `nostia-android/local.properties` | `your_google_maps_key` | Needs Step 1E |
| `nostia-android/local.properties` | `your_password` (×2) | Needs Step 1D |
| `nostia-expo/src/services/notifications.ts` | `'your-project-id'` | Needs Step 2G |
| ~~`nostia-expo/app.json` iOS bundle ID~~ | ~~`PLACEHOLDER_IOS_BUNDLE_ID`~~ | ✅ Fixed → `com.nostia.app` |

---

## Server Quick Reference

| | |
|---|---|
| SSH | `ssh -i ~/.ssh/id_ed25519 root@142.93.116.6` |
| Deploy | `/root/deploy.sh` |
| Logs | `pm2 logs nostia` |
| Restart | `pm2 restart nostia` |
| Nginx config | `/etc/nginx/sites-available/api.nostia.io` |
| SSL cert | `/etc/letsencrypt/live/api.nostia.io/` (auto-renews) |
| DB | `/var/data/nostia/nostia.db` |
| App | `/var/www/nostia-backend/` |
