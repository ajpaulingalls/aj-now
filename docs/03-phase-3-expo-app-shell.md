# Phase 3 — Expo Reporter App shell: navigation, i18n, auth

## Goal

Stand up the Reporter mobile app on the latest **Expo** with an **EAS development build** (iOS + Android). Wire navigation, theming, English/Arabic with full RTL, secure storage, the **passwordless email-code login** flow with optional **biometric unlock** of a stored refresh token, and a placeholder Home screen authenticated against the Phase-2 API.

> SSO (REQ-R550) is **deferred**. The login surface is intentionally a single email-code path so we don't ship dead UI.

## Definition of Done

- `bun run --filter @aj-now/reporter ios` and `… android` produce EAS dev builds that install and launch on a real device or simulator.
- A reporter can:
  - Enter their email → receive a 6-digit code → enter the code → land authenticated.
  - On success, opt in to **biometric unlock** (Face ID / Touch ID / Android BiometricPrompt). The refresh token is stored in the OS keychain behind biometric protection and used silently on next launch.
  - Switch UI language between English and Arabic; the entire app instantly mirrors layout (RTL) and text direction.
  - View their profile (read-only display of fields from `/v1/me`).
  - Log out, which clears tokens from secure storage and revokes the refresh token via `/v1/auth/logout`.
- All screens render correctly in both languages and have accessibility labels.
- No secrets, codes, or tokens appear in any log output.

## Stories satisfied

- REQ-R040, REQ-R050: native iOS + Android.
- REQ-R070, REQ-R080: English LTR + Arabic RTL from day 1.
- REQ-R120, REQ-R130: fingerprint + facial recognition (used as **unlock-of-stored-credential**, not as the primary login factor in MVP).
- REQ-R140: reporter login (email-code UI).
- REQ-R510 (client): tokens stored in `expo-secure-store`; encrypted at rest by the OS keychain. Biometric-protected when the user opts in.
- REQ-R520 (client): `fetch` wrapper rejects non-HTTPS URLs in non-dev builds.
- REQ-R550: **deferred** — no SSO surface in MVP; an `auth/method` selector is **not** added until SSO is in.

## App stack

- Expo SDK latest, **dev client** (`expo-dev-client`).
- Routing: **`expo-router`** (file-based).
- State: **Zustand** for app state, **TanStack Query** for server state.
- Storage: **`expo-secure-store`** for tokens, **`expo-sqlite`** + **MMKV** (`react-native-mmkv`) for app data cache (encrypted via OS keychain for the MMKV key).
- Networking: a typed `apiClient` generated from `@aj-now/api-contract` route paths and Zod response schemas.
- i18n: `i18next` + `react-i18next`; `expo-localization` for default locale; `I18nManager.forceRTL` triggered on language change with a controlled app reload.
- Theming: `@aj-now/ui-tokens` consumed via a `ThemeProvider`. Use logical properties (`paddingStart` etc.) everywhere.
- Biometrics: `expo-local-authentication`.
- Forms: `react-hook-form` + `@hookform/resolvers/zod` against shared Zod schemas.

## App structure

```
apps/reporter/
├── app/                          # expo-router
│   ├── _layout.tsx               # root: theme, i18n, auth gate, query client
│   ├── (auth)/
│   │   ├── email.tsx             # step 1: enter email
│   │   └── code.tsx              # step 2: enter 6-digit code
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Home (placeholder; assignments in Phase 4)
│   │   └── profile.tsx
│   └── +not-found.tsx
├── src/
│   ├── api/
│   │   ├── client.ts             # fetch wrapper, auth interceptor
│   │   └── hooks.ts              # useMe, useRequestCode, useVerifyCode, useLogout, ...
│   ├── auth/
│   │   ├── store.ts              # zustand: tokens, currentUser
│   │   └── biometric.ts          # protect/retrieve refresh token behind biometrics
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── en.json
│   │   └── ar.json
│   ├── theme/
│   │   ├── ThemeProvider.tsx
│   │   └── useTheme.ts
│   └── components/
│       ├── PrimaryButton.tsx
│       ├── TextField.tsx
│       ├── OtpInput.tsx          # 6-segment code field
│       └── LanguageSwitcher.tsx
├── assets/
├── app.config.ts                 # expo config; reads APP_VARIANT, API base URL
├── eas.json                      # development, preview, production profiles
└── package.json
```

## Tasks

1. `bun create expo apps/reporter --template blank-typescript`. Move into Bun workspace, fix paths.
2. Install: `expo-router`, `expo-dev-client`, `expo-secure-store`, `expo-local-authentication`, `expo-localization`, `react-native-mmkv`, `i18next`, `react-i18next`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`. Workspace deps: `@aj-now/api-contract`, `@aj-now/ui-tokens`, `@aj-now/auth`, `@aj-now/db` (types only). (No `expo-auth-session` / `expo-web-browser` in MVP — added with SSO later.)
3. `app.config.ts`: read `EXPO_PUBLIC_API_BASE_URL`; declare `expo-router` plugin and the dev client.
4. Configure EAS: `eas.json` with `development` (internal distribution, dev client), `preview`, `production`. Document `eas build --profile development --platform ios|android`.
5. Build the API client wrapper. Auth interceptor: on 401 with valid refresh token, call `/v1/auth/refresh` once, retry. On refresh failure, clear tokens and route to `/email`.
6. Implement i18n. `en.json` and `ar.json` cover every string used in this phase. App boot loads device locale, clamped to `en`/`ar`. Language switcher writes to MMKV and triggers `I18nManager.forceRTL(...)` plus `Updates.reloadAsync()` (or a soft reload via a key on the root component for dev).
7. Theme + tokens. All components consume tokens; no hard-coded colors or spacings.
8. **Email screen**: validate email; submit `POST /v1/auth/code/request`; navigate to code screen carrying email + a "code expires at" timestamp. Always-success UX (no enumeration leak).
9. **Code screen**: 6-segment OTP input; submit `POST /v1/auth/code/verify`. On success, persist tokens. Offer "Resend code" with a 30s cooldown; show remaining-attempts hint after a wrong code.
10. **Biometric opt-in** (post-login modal, first time only): if `expo-local-authentication` reports hardware available + enrolled, prompt to "Use Face ID / fingerprint to stay signed in"; on accept, re-store the refresh token under `expo-secure-store` with `requireAuthentication: true`. On next launch, attempt biometric unlock → silent refresh.
11. Profile tab: read `/v1/me`. Read-only in this phase; editing of skills/languages/expertise comes in Phase 4.
12. Logout button on profile: calls API, clears tokens, navigates to `/email`.
13. Tests: Jest + RNTL. Render email + code screens in EN and AR snapshot, biometric module mocked, API client unit tests, OTP input behavior (paste, autofill via SMS code on iOS).
14. Add `bun run --filter @aj-now/reporter typecheck/lint/test` to CI.
15. Commit, push, tag `phase-3-complete`.

## Tests to add

- Email form validation (empty, invalid email).
- Code screen: paste 6-digit code auto-submits; wrong code shows attempts-left; expired code routes back to email.
- API client retries once on 401 then fails through.
- Language switch flips `I18nManager.isRTL` (mocked) and persists to MMKV.
- Biometric path: when keychain has biometric-protected token + biometrics succeed → user lands authenticated silently.

## Risks / open questions

- `I18nManager.forceRTL` requires an app reload on iOS; in dev builds use `Updates.reloadAsync()`. In prod we accept the reload.
- iOS may not autofill the OTP from email (it auto-fills SMS, not email). Document this; the OTP input still supports manual entry + paste.
- Real email deliverability is a Phase-2-server concern, but bad SMTP will surface here as "code never arrives" — make sure the dev `LogMailer` path is obvious.
- Bun + Expo Metro: confirm Metro picks up workspace packages. Add `metro.config.js` with `watchFolders` pointing at `../../packages` and `nodeModulesPaths` including the workspace root.
