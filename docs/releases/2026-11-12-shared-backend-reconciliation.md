# Shared backend reconciliation release — 2026-11-12

- Release PR: https://github.com/guyster323/GOOTE/pull/1
- Source commit: 940c7b1682254e30aa9f197b1b00e11337c9b004
- Merge/deployed release: 9973561233ec034ffd189da9a3088855e1707b12
- Firebase deployment completed on 2026-11-12 at 22:02 KST.
- Hosting: https://goote-f48d8.web.app
- Hosting version: sites/goote-f48d8/versions/5835a238fc2d2292

## Change

Restored the byte-identical deployed shared backend archives, aligned the Functions package/lock to Node.js 22 and retained all 46 shared exports. Integrated pending web changes and local in-app notification/custom email-template behavior while preserving production OAuth, Play Console integration, mail concurrency, check-in filtering and feedback emails. Shared backend ownership is documented in docs/shared-backend.md; GOOTEAPP remains the canonical Android repository.

## Validation

- Next.js production build and Functions TypeScript build: passed.
- Root ESLint and Functions ESLint: no errors; root local browser-helper scripts retain 8 pre-existing warnings.
- Production-mode Playwright: 14 passed, 1 skipped.
- Firestore emulator: 5 permission regressions passed.
- GOOTEAPP: backend type check passed; Flutter analyze reported no issues; 6 Flutter tests passed.
- All 24 web/Android callable references resolve to preserved function exports.
- Independent review: template persistence, admin participation reads, roleless-profile updates and owner-only controls corrected; no remaining blockers reported.

## Post-deployment evidence

- All 47 deployed functions ACTIVE, no previously deployed names missing. Shared runtime Node.js 22; generated web SSR runtime Node.js 24.
- Existing GMAIL/GOOGLE_PLAY/PRIMARY_ADMIN environment values unchanged.
- Released Firestore rules exactly match the locally tested source.
- HTTP checks: home 200, API 200, missing tracking token 400, unauthenticated createApp callable 401.
- In-app browser: dashboard redirects an unauthenticated session to /?mode=login&redirect=%2Fdashboard; Google login button and public listings render; no browser error/warning logs.

## Preservation and rollback

Both original working trees, deployed source archives, function configurations before/after deployment and previous Firestore rules are backed up locally at:

`C:/Users/windo/goote-backups/reconcile-2026-11-12T12-40-50-678Z`

All 75 backed-up GOOTEAPP working files remain byte-identical. Local scratch images/logs and the existing local settings deletion were left outside the release commit. Raw runtime configurations (which may include secrets) remain outside Git.

To roll back, use the saved pre-deployment source/configuration and previous Firestore rules, or choose a previous Hosting release. The old Git main alone does not contain the full formerly deployed shared backend; do not deploy that older backend blindly.

## Limits

The authenticated participation-leave E2E was skipped because it needs a real signed-in tester account. Actual email delivery and Google Play release submission were not exercised by these deployment smoke checks. Existing dependency advisories from the recovered production dependency lock remain; no broad dependency migration was attempted in this recovery release.
