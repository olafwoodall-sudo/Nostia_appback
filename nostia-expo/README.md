# nostia-expo

Expo / React Native version of Nostia — used for **development and testing only**.
This is a copy of `nostia-mobile` (the reference) with the following changes applied:

- `FriendsMapScreen` replaced with a working `react-native-maps` implementation
- `react-native-maps` added as a dependency
- `app.json` updated with location permissions and maps plugin

Do not use this folder as a production build target. For production, use `nostia-ios` or `nostia-android`.

---

## Setup

```bash
npm install
npx expo start
```

---

## Placeholders

The following values must be replaced before this app can be fully tested or submitted.

### 1. Google Maps API Key — REQUIRED for Android map rendering

**Files:**
- [`app.json`](app.json) — two locations:
  - `expo.android.config.googleMaps.apiKey`
  - `expo.plugins[react-native-maps].googleMapsApiKey`

**Current value:** `PLACEHOLDER_GOOGLE_MAPS_API_KEY`

**How to get one:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Maps SDK for Android** API
3. Create an API key and restrict it to your app's package name (`com.nostia.app`)
4. Replace both occurrences of `PLACEHOLDER_GOOGLE_MAPS_API_KEY` in `app.json`

> iOS uses Apple Maps by default via `react-native-maps` and does not require a Google Maps key unless you explicitly want Google Maps on iOS too.

---

### 2. iOS Bundle Identifier — REQUIRED for iOS builds

**File:** [`app.json`](app.json)
- `expo.ios.bundleIdentifier`

**Current value:** `PLACEHOLDER_IOS_BUNDLE_ID`

**Action required:** Replace with your Apple Developer bundle ID (e.g. `com.nostia.app`).
Must match the identifier registered in your Apple Developer account.

---

## Known Differences from nostia-mobile (reference)

| Feature | nostia-mobile | nostia-expo |
|---|---|---|
| FriendsMapScreen | Visual placeholder only | Live `react-native-maps` MapView with friend markers |
| Maps dependency | None (`@types/leaflet` stub) | `react-native-maps ^1.18.0` |
| app.json name/slug | `nostia-mobile` | `nostia-expo` |
| Location permissions | Not explicitly declared | Declared in `app.json` (Android + iOS) |

---

## API

- **Base URL:** Configured via `EXPO_PUBLIC_API_URL` in `.env`
- **Current value:** `https://king-prawn-app-44tki.ondigitalocean.app/api`
- Auth tokens stored in device Keychain/Keystore via `expo-secure-store`

---

## Platform Notes

**Android:**
- Requires Google Maps API key (see Placeholder #1 above)
- Location permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` declared in `app.json`

**iOS:**
- Location usage description declared: `NSLocationWhenInUseUsageDescription`
- Requires bundle identifier (see Placeholder #2 above)
- Uses Apple Maps by default (no API key needed for maps)
