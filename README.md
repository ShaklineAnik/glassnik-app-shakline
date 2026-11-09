# Glassnik mobile app (review build)

React Native + Expo app (expo-router, expo-video). SDK 58 is the development line; SDK 54 is preserved on its own branch. This README explains how to run and test the app with the local mock API server, and what is still outstanding.

Nothing here is merged to `main`. Every piece of work lives on its own branch.

## Branches

| Branch | What it contains |
|---|---|
| `main` | Unchanged. |
| `integration/sdk-54` | SDK 54 line, preserved. |
| `integration/sdk-58` | SDK 58 line with Report, Block, Delete Account and API config merged in. |
| `feature/release-prep` | Store prep: iOS "Always" location removed, navigation warning fixed, demo videos only in development builds. |
| `feature/mock-api` | Local mock API server (`mock-server/`). Based on `release-prep`. |
| `feature/auth-navigation-fixes` | Explore/Profile from the feed, sign-in redirect, sign-out, signed-out profile. |
| `feature/empty-feed-state` | Empty and error states for the feed. |
| `feature/add-contacts-permission` | Contacts permission declared (`app.json` only). |
| `feature/music-integration` | Dev-only background music (see below). Based on `integration/sdk-58`. |
| `feature/report-video`, `feature/block-user`, `feature/delete-account` | Original branches for the three App Store requirements. |

No single branch has everything yet: the features above sit on separate branches and have not been combined.

## Run the app

Requirements: Node 18+, pnpm, Android Studio (emulator) or a phone with Expo Go.

1. `pnpm install`
2. Copy `.env.example` to `.env` and set the API address:
    - Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
    - Real phone: `EXPO_PUBLIC_API_URL=http://<your-PC-IP>:3000` (same Wi-Fi)
3. Start the mock API server (on the `feature/mock-api` branch): `node mock-server/server.js`
4. In another terminal: `npx expo start --clear`
5. Android emulator: press `a`. Phone: scan the QR code (Android: Expo Go scanner; iPhone: Camera app, then "Open in Expo Go").

Restart Expo with `--clear` after changing `.env`.

Note: Expo Go is not a store build. It checks app logic and UI but not final native configuration (permission texts, etc.).

## Mock API server

A small fake backend in `mock-server/` for testing without the real backend. Data lives in memory and resets when the server restarts. Not for production.

Test login: `test@glassnik.test` / `password123` (also `maya@glassnik.test`, `leo@glassnik.test`, same password). New accounts can be registered in the app.

Debug pages (browser):
- `http://localhost:3000/_mock/reports` shows reports submitted from the app.
- `http://localhost:3000/_mock/state` shows users, blocks and counts.

Empty-feed test (PowerShell): `$env:EMPTY_FEED=1; node mock-server/server.js`

Implemented: auth, feed (public, no login needed), Report, Block, Delete Account, likes, comments, follow, notifications, fake upload.

## Music integration (development only)

Branch `feature/music-integration`. Based on Bhargav's music prototype.

- Picks a background track from the video's category; the next track comes from the same category, never the same song twice in a row.
- A music button, separate from the speaker button. Three independent controls: video audio, music, music only (speaker off, music on).
- Music pauses and resumes with the video.
- Hidden in release builds (`__DEV__` only).

To try it: check out the branch, then bring the mock server in without committing it: `git checkout feature/mock-api -- mock-server` followed by `git reset mock-server`.

Not done yet: Place/Location-based selection (selection is by Category only), licence confirmation for the tracks, hosting tracks on our own storage.

## Tested so far

Android emulator: all flows (Report, Block, Delete Account, empty and error feed states) against the mock server. Physical Android phone and physical iPhone: the music branch (`feature/music-integration`) through Expo Go, against the mock server. The real Glassnik backend has not been tested.

## Backend dependencies

The app expects these endpoints (the mock server implements them; the real backend needs to match):

| Endpoint | Used for |
|---|---|
| `POST /videos/:id/report` (`reason`, optional `details`) | Report Video |
| `POST` / `DELETE /users/:id/block` | Block / unblock |
| `GET /users/me/blocks` | Blocked users list (screen not built yet) |
| `DELETE /users/me` | Delete Account |
| `GET /mobile/feed` | Must work without a login token and return `[]` when empty |

Other endpoints the app already calls are listed in `lib/api.ts`.

## Outstanding

- Connect the mock endpoints to the real backend and compare request/response shapes.
- Regression test on SDK 54 and 58, Android and iPhone.
- Installable development builds beyond Expo Go (needs Apple Developer and EAS accounts for iPhone).
- Blocked users screen.
- Music: licence confirmation, own-storage hosting, Place/Location selection.
- Decision on Contacts permission for the first release.