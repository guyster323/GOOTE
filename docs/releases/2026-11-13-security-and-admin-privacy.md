# Security and administrator privacy release — 2026-11-13

- Release PR: https://github.com/guyster323/GOOTE/pull/2
- Reviewed source commit: `f47b16e93f7397af55b9a9b403be45bb69169f3a`
- Merge commit deployed: `8ba0df84d1e9f10095e3fd5ef2b78bfe51623476`
- Previous main: `25d8c90e0b9fe5fbf448a70bcce012871bd015f1`
- Hosting: https://goote-f48d8.web.app
- Hosting release: `sites/goote-f48d8/releases/1794535977917000`
- Hosting version: `sites/goote-f48d8/versions/bfc70c202208fbc9`
- Hosting release time: 2026-11-13T02:12:57.917Z
- Firestore ruleset: `projects/goote-f48d8/rulesets/8df6f789-9d8a-49c4-935b-8c3025026036`
- Private rollback backup: `C:/Users/windo/goote-backups/security-2026-11-13T02-01-42Z`

## Change

Existing onboarding updates only nickname and update time, and account creation no longer replaces a profile that already exists. Scheduled and notification mail escapes untrusted text and keeps platform tracking buttons. Likes must be created by the signed-in sender, and the notification name comes from that user's stored profile.

Member emails remain on the existing user and participation documents. Only the document owner can raw-read a user profile, client participation updates are denied, and cross-user screens use server projections. The verified primary admin sees full member emails. Other admins see masked emails, including on apps they own and in outgoing notification bodies and Reply-To headers. An ordinary non-admin developer still sees tester contacts for their own app.

## Validation before deploy

- Root `npm run lint` and `npm run build` passed. Production build id `zN1JxnCTf-TQzeNXvQXEJ`.
- `npm --prefix functions run lint` and `npm --prefix functions run build` passed.
- Firestore emulator rules: 11 passed, 0 failed, project `demo-goote-rules`, JDK 21.
- `PLAYWRIGHT_USE_PRODUCTION=1 PLAYWRIGHT_PORT=4173 npx playwright test`: 23 passed, 1 skipped. The skip is `participation-leave` because `PW_LEAVE_APP_ID` and `PW_STORAGE_STATE` are unset.
- Coordinator recheck on the same commit with `PLAYWRIGHT_PORT=4174`: 23 passed, 1 skipped. Functions lint and build and root lint exited 0.

## Deployment

Completed in order, all with `--project goote-f48d8 --non-interactive`:

1. `node functions/scripts/deploy-functions.js deploy --only functions` created `getMemberDirectory`, `getPublicProfiles`, and `getAppParticipants` and updated the existing shared handlers. Deploy complete. No existing function was deleted.
2. `firebase deploy --only hosting` released the merged Next.js app. The generated SSR function `ssrgootef48d8` was updated and remains Node.js 24.
3. `firebase deploy --only firestore:rules` released `firestore.rules`. The deployed rules text matches the merged source.

## Post-deployment evidence

- 50 functions are ACTIVE: 49 shared exports from `functions/shared-contract.json` on Node.js 22, plus `ssrgootef48d8` on Node.js 24. No shared contract name is missing.
- The three new callables are ACTIVE in `us-central1` on Node.js 22.
- GMAIL, Google Play, and the other existing function environment keys and value fingerprints are unchanged. `PRIMARY_ADMIN_EMAIL` was not present on the inspected functions before or after this deploy, and it is not in the local functions env file. Full-email mode therefore stays fail-closed until that server variable is configured. No secret values were printed or committed.
- Released Firestore rules match the merged `firestore.rules` byte for byte.
- Homepage `GET /` returned 200. Public `GET /apps/test-app-id` returned 200. A fresh browser session, not an existing signed-in profile, reached `/?mode=login&redirect=%2Fdashboard` from `/dashboard`.
- `GET /api/track-daily` without a token returned 400 `Missing pid or token`.
- Unauthenticated `POST /getMemberDirectory` returned 401.
- No scheduler was invoked, no test email was sent, and no production member data was created or changed.

## Rollback

Previous Hosting version: `sites/goote-f48d8/versions/5835a238fc2d2292` (release `sites/goote-f48d8/releases/1794488560592000`, 2026-11-12T13:02:40.592Z).

Previous Firestore ruleset: `projects/goote-f48d8/rulesets/f46d3857-6f4d-4bdf-92fc-0d77e84209c3`.

Function names, runtime, status, and private environment fingerprints from before the deploy are in the backup directory above. Roll rules back first, then Hosting. Do not deploy an older web-only Functions snapshot. The new callables are additive.

## Limits

The authenticated participation-leave browser spec was skipped. A signed-in primary-admin versus secondary-admin screen was not driven, and no real account was impersonated. Canonical Android onboarding in `goote_app` was not part of this release and still uses its older profile merge. Because `PRIMARY_ADMIN_EMAIL` is unset on the deployed functions, every admin currently receives the masked-email path.
