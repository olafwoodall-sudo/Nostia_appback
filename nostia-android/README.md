# Nostia Android

Native Android app — Kotlin + Jetpack Compose port of the Expo/React Native Nostia app.

## Prerequisites

- Android Studio Ladybug (2024.2) or newer
- JDK 17
- Android SDK 35

## Setup

1. Open the `nostia-android/` folder in Android Studio (File → Open).
2. Let Gradle sync complete.
3. Replace all placeholder values (see below).
4. Run on a device or emulator (API 26+).

---

## Placeholder Values — Required Before Release

### 1. `PLACEHOLDER_GOOGLE_MAPS_API_KEY`

Location in two places:

- **`app/src/main/AndroidManifest.xml`** — `<meta-data android:name="com.google.android.geo.API_KEY" android:value="PLACEHOLDER_GOOGLE_MAPS_API_KEY" />`
- **`app/src/main/java/com/nostia/app/constants/AppConstants.kt`** — `const val GOOGLE_MAPS_API_KEY = "PLACEHOLDER_GOOGLE_MAPS_API_KEY"`

To obtain a key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Maps SDK for Android** API.
3. Create an API key and restrict it to the `com.nostia.app` package + SHA-1 fingerprint.
4. Replace both placeholder values with the actual key.

### 2. `PLACEHOLDER_STRIPE_PUBLISHABLE_KEY`

Location:

- **`app/src/main/java/com/nostia/app/constants/AppConstants.kt`** — `const val STRIPE_PUBLISHABLE_KEY = "PLACEHOLDER_STRIPE_PUBLISHABLE_KEY"`

Stripe is not yet integrated as a native SDK. The VaultScreen currently shows a Toast with this placeholder value when "Pay" is tapped. To enable real Stripe payments:
1. Add `implementation 'com.stripe:stripe-android:20.x.x'` to `app/build.gradle`.
2. Replace the placeholder with your Stripe publishable key from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys).
3. Implement `PaymentSheet` flow in `VaultScreen.kt`.

### 3. `PLACEHOLDER_IOS_BUNDLE_ID`

Not applicable to Android. The iOS bundle ID is only relevant for the separate iOS build. No action needed here.

### 4. Keystore Signing Config

Signing is not yet configured. This is required for Play Store upload.

To configure:
1. Generate a keystore: `keytool -genkey -v -keystore nostia-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nostia`
2. Store the keystore file securely (do NOT commit it to git).
3. Add signing config to `app/build.gradle`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file('path/to/nostia-release.jks')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias 'nostia'
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

Use environment variables or a `local.properties` file (gitignored) to keep credentials out of source control.

---

## Architecture

```
com.nostia.app/
├── MainActivity.kt              Entry point, sets up Compose + theme
├── NostiaApplication.kt         Application class, initialises TokenManager + RetrofitClient
├── constants/
│   └── AppConstants.kt          BASE_URL and all key placeholders
├── data/
│   ├── api/
│   │   ├── ApiService.kt        Retrofit interface — all 40+ endpoints
│   │   ├── RetrofitClient.kt    OkHttp client with auth interceptor
│   │   └── models/
│   │       └── ApiModels.kt     All request/response data classes
│   └── auth/
│       └── TokenManager.kt      EncryptedSharedPreferences JWT storage
├── location/
│   └── LocationHelper.kt        FusedLocationProviderClient wrapper
├── navigation/
│   └── NostiaNavigation.kt      Root NavHost + MainScreen with BottomNavigation
└── ui/
    ├── screens/                 12 screens (see below)
    └── theme/
        ├── Color.kt             Dark palette constants
        └── Theme.kt             MaterialTheme with dark colour scheme
```

## Screens

| Screen | Route | Notes |
|---|---|---|
| LoginScreen | `login` | JWT stored on success |
| SignupScreen | `signup` | Both consents required |
| HomeScreen | `home` (tab) | Location permission, home status toggle |
| TripsScreen | `trips` (tab) | Long-press to delete, tap → VaultScreen |
| AdventuresScreen | `discover` (tab) | Adventures + Feed tabs |
| FriendsScreen | `friends` (tab) | Search, Friends + Requests tabs |
| FriendsMapScreen | `map` (tab) | Google Maps, friend markers |
| ChatScreen | `chat/{id}/{name}` | 5-second polling |
| NotificationsScreen | `notifications` | Badge on header icon |
| VaultScreen | `vault/{tripId}/{tripTitle}` | Stripe placeholder |
| AnalyticsScreen | `analytics` | Date range selector |
| PrivacyScreen | `privacy` | Profile edit, consent toggles, data export, delete account |

## Dependencies

| Library | Version |
|---|---|
| Kotlin | 1.9.25 |
| Compose BOM | 2024.09.00 |
| Retrofit | 2.11.0 |
| OkHttp | 4.12.0 |
| Navigation Compose | 2.8.3 |
| Maps Compose | 4.4.1 |
| Play Services Location | 21.3.0 |
| Security Crypto | 1.1.0-alpha06 |
| Kotlin Coroutines | 1.8.1 |
| Coil | 2.7.0 |
