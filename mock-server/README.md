# Glassnik mock API (local testing only)

A tiny fake backend so the app's Login, Report Video, Block User and Delete Account flows can be tested without the real server.
Not for production. Data lives in memory and resets when the server restarts.

## Run
    node mock-server/server.js          (needs Node 18+, no npm install)

## Point the app at it
Create a `.env` file in the project root (it is git-ignored; see `.env.example`):

    Android emulator:   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
    Real phone:         EXPO_PUBLIC_API_URL=http://<your-PC-IP>:3000   (same Wi-Fi)

Then restart Expo with `npx expo start --clear` (env values are read at start).

## Test login
    test@glassnik.test / password123
Other seeded users (to block/report): maya@glassnik.test, leo@glassnik.test (same password). New accounts can be registered in the app.

## Debug URLs (browser)
    http://localhost:3000/_mock/reports   -> reports submitted from the app
    http://localhost:3000/_mock/state     -> users, blocks, counts

## Behaviour implemented
- POST /videos/:id/report (reason required) -> stored, visible at /_mock/reports
- POST/DELETE /users/:id/block -> blocked user's videos disappear from /mobile/feed and comments; GET /users/me/blocks lists them
- DELETE /users/me -> removes the user, their videos, tokens, blocks, follows; later login fails
- All other endpoints from lib/api.ts (auth, feed, upload (fake), likes, comments, follow, notifications)
- All mock videos play the same sample clip and are titled "[MOCK]".
