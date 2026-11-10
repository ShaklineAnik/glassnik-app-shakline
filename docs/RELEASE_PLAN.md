# Release blockers and post-release enhancements

Based on the app code, the mock-server testing and the Apple/Google requirements discussed so far. "Owner" is a suggestion. Last updated 10 Nov 2026 (music engine integration and Android development build added).

## 1. Release blockers (must be done before the first App Store / Play release)

| # | Item | Why it blocks | Owner |
|---|---|---|---|
| 1 | Report, Block and Delete Account tested end to end against the real backend | Apple 1.2 (report/block) and 5.1.1(v) (in-app account deletion). So far tested only on the mock server. | Kazi + backend owner |
| 2 | Report moderation workflow (who reviews, how fast; Apple expects action within 24 hours) | Apple 1.2 | Backend / CTO |
| 3 | Web page or URL to request account deletion | Google Play requirement | Backend / CTO |
| 4 | Account deletion rules: what is removed or retained, and for how long | Needed for the Privacy Policy and store forms | CTO |
| 5 | Apple Developer account and a Glassnik-controlled Expo/EAS account | No store build or submission without them | Steve |
| 6 | Installable Android and iPhone builds (beyond Expo Go). **Android done**: development build on branch `feature/android-dev-build`, tested on 10 Nov (app and music work, same behaviour as in Expo Go). **iPhone pending** the Apple Developer and Expo/EAS accounts (#5). For iPhone, `ios.simulator` in the `development` profile of `eas.json` must be set to `false`, and real Apple IDs added under `submit` (empty placeholders were removed because EAS rejects empty values). | Expo Go does not check the final native config (permission texts, etc.) | Kazi, after #5 |
| 7 | Combine the separate feature branches into one release branch and resolve conflicts | No single branch has everything today | Kazi, with Steve's approval |
| 8 | Regression test on SDK 54 and SDK 58, Android and iPhone, before anything is merged to `main` | Steve's rule | Kazi |
| 9 | Feed response shape confirmed against the real backend (plain array or `{ data, total }`); feed must work without login and return `[]` when empty | App breaks or shows "Couldn't load Experiences" otherwise | Backend / CTO |
| 10 | Login verified on real devices with the real backend (tokens are now stored in secure storage; the original commit notes the login flow was not yet verified on a device) | Sign-in could fail in the release build | Kazi |
| 11 | Production API served over https | Store requirement and security | CTO |
| 12 | Real Experiences in the release feed instead of demo videos (demo videos now show only in development builds; an empty-feed screen exists) **(decision needed)** | Apple 2.1: the app must not look empty or unfinished | Steve |
| 13 | Permissions review: camera, microphone, location (when in use) and contacts are declared; remove those without a live feature, and make the purpose texts match what the app really does. The location text mentions features that do not exist. **(decision needed)** | Apple 5.1.1 and Play sensitive-permission rules | Steve + Kazi |
| 14 | Privacy Policy "DEVELOPERS TO CONFIRM" items verified | Required for both stores | Kazi + backend owner |
| 15 | Store listings: name, descriptions, screenshots, age rating, privacy answers (Apple App Privacy, Play Data safety) | Required to submit | Kazi (drafts) + Steve |
| 16 | Upload sends category and location **(decision needed)**: the upload form forces users to fill them in, but the app does not send them to the backend | Users enter data that goes nowhere; Explore category filtering depends on it | Kazi + backend owner |
| 17 | "Following" tab does nothing different from "For You" **(decision needed)**: hide it or implement it | An inactive tab looks unfinished to reviewers | Steve |

Music is not a blocker: it is already disabled in release builds (development only) until licensing is confirmed. Because of this, music can only be tested on development builds, not on release builds.

## 2. Enhancements that can follow the initial release

| # | Item | Notes |
|---|---|---|
| 1 | Blocked users screen in Settings (unblock) | Unblock API exists in the app; no screen yet. Confirm whether the stores require it for the first release. |
| 2 | Music: confirm licences for the 59 tracks (0 of 59 verified so far) | Required before music is ever enabled in release |
| 3 | Music: host tracks on our own storage (currently streamed from a public GitHub repo) | Needed when music goes live |
| 4 | Music: Place and Location based selection (currently Category plus city/place). The recommendation engine also supports a `place_type`, which the app and backend do not have yet | Needs category, place, city and a place type from the backend (see blocker 16). Next step: a short call with the music prototype author to agree where `place_type` comes from. |
| 5 | Music: stop playing when leaving the feed; smoother continuous playback between Experiences; ability for creators to choose their own music | Product decisions |
| 6 | Invite-friends feature (uses the Contacts permission) | Add the permission again when this ships |
| 7 | Real comment and share counts on feed items (currently shown as 0 for backend videos) | Minor |
| 8 | Block filtering in Explore and notifications on the backend | The mock filters feed and comments only |
| 9 | Update Expo patch versions (`expo` 58.0.21 to ~58.0.23, 6 other packages) | After regression testing |
| 10 | Tidy the repository: combine branches, remove the unused `server/` scripts if not needed | Housekeeping |
| 11 | Background playback **(decision needed)**: in Expo Go on iPhone, music and video keep playing when the app goes to the background; on Android both stop. On both phones music and video stop on the lock screen and during a phone call | Decide the intended behaviour (a short-video feed usually stops in the background) and re-test on a native iPhone build once the Apple account exists |
| 12 | Clean up the 27 existing TypeScript errors reported under the SDK 58 / React Native 0.88 typings | None are in the music files; the app runs. Housekeeping. |