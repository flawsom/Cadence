# Cadence Android

> A pace you can actually keep — the native Android client for Cadence.

## Architecture

Thin native client. **Zero business logic on device.** All parsing, pacing, evaluation, and analytics happen server-side via identical REST API. Android handles: offline cache/sync, FCM notifications, Glance widget, share-sheet, biometric lock, Material 3 Expressive UI.

```
app → core:common, core:network, core:database, core:security
    → feature:onboarding, feature:today, feature:taskdetail, feature:trackdetail
    → feature:pods, feature:practice, feature:analytics, feature:settings
    → sync, widget, notifications
```

Features never depend on each other. Only core + sync.

## Stack

- **Kotlin 2.1** + Jetpack Compose BOM 2024.12
- **Material 3** Expressive (seed: `#B5533C` terracotta)
- **Hilt 2.52** DI throughout
- **Room 2.7** + SQLCipher 4.x (encrypted offline cache)
- **Retrofit 2.11** + OkHttp 4.12 (TLS 1.3, cert pinning)
- **WorkManager 2.10** (sync with exponential backoff)
- **Glance** (home screen widget)
- **Firebase Cloud Messaging** (push notifications)
- **Target SDK 36** (Android 16), **Min SDK 28** (Android 9, ~95% devices)

## Setup

### 1. Firebase (for FCM push notifications)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project `cadence-app` (or use existing)
3. Add Android app with package `unifies.cadence`
4. Download `google-services.json` → replace `app/google-services.json`
5. Enable Cloud Messaging in Project Settings

### 2. Build

```bash
cd android
./gradlew assembleDebug
```

Or open in Android Studio and hit Run.

### 3. Release Signing

The release keystore is pre-generated at `keystore/release.p12`:
- **Alias:** `cadence`
- **Password:** `cadence123`

For production, regenerate with your own key:
```bash
keytool -genkeypair -v -keystore keystore/release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias cadence
```

Then update `KEYSTORE_PASSWORD` and `KEY_ALIAS` env vars.

## Module Summary

| Module | Purpose | Key APIs |
|--------|---------|----------|
| `core:common` | Theme, models, utilities | CadenceTheme, Models, DateUtil |
| `core:network` | API layer, auth, SSL | CadenceApi (25+ endpoints), AuthInterceptor |
| `core:database` | Encrypted offline cache | Room + SQLCipher, TaskDao (30+ queries) |
| `core:security` | Biometric, tokens | TokenStore, BiometricHelper |
| `feature:onboarding` | Plan creation | IngestScreen (MVI), PDF upload, share intent |
| `feature:today` | Main dashboard | Tasks, streak 🔥, heatmap, review card |
| `feature:taskdetail` | Task deep-dive | Timer, practice, answer eval, history |
| `feature:trackdetail` | Plan deep-dive | Burn-up chart, topics, schedule |
| `feature:pods` | Study groups | Create/join, boards, comparison, digest |
| `feature:practice` | Practice & eval | Questions, feedback, score history |
| `feature:analytics` | Stats & charts | Heatmap, trend, streak visualization |
| `feature:settings` | Preferences | Dark mode, biometric lock, account |
| `sync` | Offline sync | WorkManager, conflict resolution |
| `widget` | Home screen | GlanceAppWidget (task count, reviews) |
| `notifications` | Push | FCM, 4 channels, deep links |

## Screens

| Screen | Route | What It Does |
|--------|-------|-------------|
| Onboarding | `onboarding` | Paste syllabus or type subject → generate roadmap |
| Today | `dashboard` | Tasks, streak, heatmap/trend, review card, rollover |
| Task Detail | `task/{taskId}` | Timer, practice problems, answer form, feedback |
| Track Detail | `track/{planId}` | Topic progress, burn-up chart, day-by-day schedule |
| Pods | `pods` | Study groups, member comparison, daily digest |
| Practice | `practice/{topicTitle}` | Questions, answer submission, evaluation |
| Analytics | `analytics` | Full heatmap, trend chart, streak, stats grid |
| Settings | `settings` | Dark mode, biometric lock, account, about |

## Security

- **SQLCipher 4.x** — database encrypted at rest
- **EncryptedSharedPreferences** — tokens in AES-256-GCM
- **BiometricPrompt** — CryptoObject + AndroidKeyStore
- **TLS 1.3** — certificate pinning (real SHA-256 pins from Convex)
- **NetworkSecurityConfig** — no cleartext, no user CAs in production
- **OAuth 2.0 + PKCE** — Custom Tabs flow, deep link callback

## Offline / Sync

1. User completes task offline → `PendingActionEntity` queued in Room
2. `WorkManager` picks up on network restore (respects Doze, battery)
3. Push pending actions to server → server wins on structure, client wins on status
4. Conflict UI: "Your plan updated overnight" with diff summary
5. Exponential backoff: 1s → 2s → 4s → 8s → max 1h

## What's Ready

- ✅ 16-module architecture (zero feature-to-feature dependencies)
- ✅ 25+ API endpoints wired to Convex backend
- ✅ Full offline cache with SQLCipher encryption
- ✅ Biometric lock with AndroidKeyStore
- ✅ Real certificate pins (fetched from `blessed-mosquito-123.convex.cloud`)
- ✅ Release keystore generated
- ✅ FCM service with 4 notification channels
- ✅ Glance widget with task count
- ✅ Share intent (PDF + text)
- ✅ Deep links (`cadence://today`, `cadence://reviews`, `cadence://pods/{id}`)
- ✅ Material 3 Expressive theme (terracotta seed, dark mode)
- ✅ Baseline profiles for cold start optimization
- ✅ ProGuard rules for R8 minification

## Before Production

1. Replace `google-services.json` with real Firebase config
2. Regenerate release keystore with production credentials
3. Add `google-services.json` to `.gitignore`
4. Set up CI/CD (GitHub Actions → Firebase App Distribution)
5. Add Macrobenchmark tests for startup/scroll performance
