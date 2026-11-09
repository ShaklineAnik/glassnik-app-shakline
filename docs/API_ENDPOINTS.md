# API endpoints: mock server vs real Glassnik backend

What the app calls (`lib/api.ts`), what the mock server returns, and what the real backend must match. Written from the app code and the mock server; the real backend has not been tested.

Legend: ✅ mock matches what the app expects · ❓ please confirm on the real backend · ⚠️ gap or risk

## A. New for App Store / Google Play compliance

| Endpoint | App sends | App expects | Mock | Status |
|---|---|---|---|---|
| `POST /videos/:id/report` | `{ reason, details? }` | `{ success: true }` | Stores the report; `reason` required; status `PENDING` | ❓ CTO says implemented; confirm shape. Moderation workflow (who reviews, within what time) is not in the mock. |
| `POST /users/:id/block` | none | `{ success: true }` | Stores the block | ❓ |
| `DELETE /users/:id/block` | none | `{ success: true }` | Removes the block | ❓ (no unblock screen in the app yet) |
| `GET /users/me/blocks` | none | list of users | Returns blocked users | ❓ (no screen yet) |
| `DELETE /users/me` | none | `{ success: true }` | Removes user, their videos, tokens, blocks, follows | ❓ Must define what is deleted or retained. App then signs out locally. |

Server-side behaviour needed beyond the endpoints:
- Blocked users' content must disappear from the blocker's feed, Explore, comments and notifications. The mock filters feed and comments only.
- Google Play also requires a web page or URL to request account deletion (not an app endpoint).

## B. Existing endpoints the app already calls

| Endpoint | Used for | Mock | Status |
|---|---|---|---|
| `POST /auth/register` | Sign-up | 201 `{ user, accessToken, refreshToken }` | ❓ App reads this exact shape |
| `POST /auth/login` | Sign-in | 200 `{ user, accessToken, refreshToken }` | ❓ Same shape; 401 with `message` on bad login |
| `POST /auth/refresh` | Token refresh on 401 | `{ accessToken, refreshToken }` | ❓ |
| `POST /auth/logout` | Sign-out | `{ success: true }` | ❓ |
| `GET /mobile/feed?page&limit` | Feed | Array of videos; public; `[]` when empty | ⚠️ see C1, C2 |
| `POST /videos/request-upload` | Upload step 1 (`title`, `fileSize`, `description?`, `source: MOBILE`) | `{ id, uploadUrl }` (fake) | ⚠️ see C3 |
| `PUT <uploadUrl>` | Upload step 2 (signed storage URL) | fake endpoint | ❓ Real flow uses cloud storage |
| `POST /videos/:id/complete` | Upload step 3 | `{ success: true }` | ❓ |
| `GET /videos/:id/status` | Processing status | always `PUBLISHED` | ❓ Real: processing states and errors |
| `GET /me/capabilities` | Capabilities | always `[]` | ❓ Meaning unknown |
| `GET /users/me`, `PATCH /users/me` | Own profile | user object | ❓ |
| `GET /users/:id`, `GET /users/:id/videos` | Other profiles | user + counts + `isFollowing`, `isBlocked` | ❓ Confirm fields |
| `POST/DELETE /users/:id/follow` | Follow | `{ following, followerCount }` | ❓ |
| `POST/DELETE /videos/:id/like` | Like | `{ liked, likeCount }` | ❓ |
| `GET/POST /videos/:id/comments` | Comments | `{ comments, total }`, items with `author` | ❓ App also accepts `{ data }` |
| `GET/DELETE /videos/:id` | Single video / delete own | video / `{ success }` | ❓ |
| `GET /notifications`, `/unread-count`, `POST /read-all`, `PATCH /:id/read` | Notifications | array | ❓ App accepts array, `{ notifications }` or `{ data }` |

## C. Differences and gaps to resolve

1. **Feed response shape.** The app expects a plain array of videos. The app's own types also define `{ data, total }` (a wrapped response). If the real feed is wrapped, the app will break. Please confirm.
2. **Feed fields.** The app needs `id`, `publicUrl` (videos without it are hidden), `thumbnailUrl`, `owner { id, displayName, username, avatarUrl }`, `likes`, `createdAt`, and `place`, `city`, `country`, `category`.
3. **Category and location are never sent.** The upload screen collects Location and Category, but `request-upload` only sends title, size, description and source. So the real backend has no category or place for uploaded videos. The music feature picks tracks by category, so the backend must store and return these fields, and the app must start sending them. This needs an app change plus a backend change.
4. **Feed must be public.** `GET /mobile/feed` must work without a login token and return `[]` when empty; otherwise signed-out users see "Couldn't load Experiences".
5. **Error format.** The app reads the `message` field from JSON error bodies.
6. **Tokens.** A `401` triggers one refresh attempt using `refreshToken`.
7. **Pagination.** The app requests `page` and `limit`; confirm the real paging and whether Explore needs more.
8. **Upload.** The mock fakes the signed-URL upload and processing; the real flow (cloud storage, video processing) is untested from the app.
9. **Notifications and Explore** do not filter blocked users in the mock.

## D. Questions for the backend owner
- Is the feed a plain array or `{ data, total }`?
- Can the backend store and return `category`, `place`, `city`, `country`, and how will the app send them?
- What does `GET /me/capabilities` return?
- Account deletion: what is removed or retained, and for how long?
- Who reviews reports, and how fast?