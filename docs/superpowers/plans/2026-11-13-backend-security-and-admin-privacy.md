# Backend regression and administrator privacy implementation plan

**Goal:** Repair the four findings reported against 940c7b1682254e30aa9f197b1b00e11337c9b004, apply the requested administrator email masking, then review, commit, push, merge and deploy the verified release.

**Execution:** The coordinator owns this plan and independent review. Actual source/test changes and review repairs belong to an Orca supervised Grok Build CLI worker using grok-4.7-build-fast, xhigh reasoning and a verified 500k context window. Report every assignment through worker_done. No substitute model or silent context downgrade.

**Architecture:** Preserve the existing Firebase security boundary and web/Android callable contracts. Fix profile persistence at the writer, render untrusted mail content as escaped text inside a platform-owned HTML structure, and derive notification identity from authenticated persisted data. Keep existing email data in place, restrict raw user-document reads to their owner, and serve cross-user lists through server-authorized projections. No public-field deletion/backfill or Android profile migration is necessary for this boundary.

**Tech stack:** Next.js 15 / React 19 / TypeScript, Firebase Auth/Firestore/Functions, Node.js 22 shared backend, Playwright and Firestore emulator tests.

## Scope and acceptance criteria

- Existing users, including roleless legacy profiles and accounts with activity, can finish onboarding without changing email, role, statistics, original creation time or dismissed guides. New profile creation and a concurrent onUserCreated event remain safe.
- Developer-controlled templates, app names, categories, icon URLs and nicknames cannot inject HTML or replace official tracking destinations in daily/reminder mail. Existing stored templates are handled safely at send time. Normal Unicode, newlines and supported placeholders still work. Literal dollar replacement sequences and placeholder-like names stay literal.
- Like documents cannot impersonate another sender; the notification uses the stored sender identity. Existing web and canonical Android like payloads remain compatible, including legacy documents. Both user and app target paths are covered.
- Dynamic names in the affected participation/approval and scheduled emails render as text without markup or attribute injection. Tracking/check-in, OAuth, Play Console, scheduler concurrency and Gmail retry behavior remain intact.
- Confirmed email masking policy: only the PRIMARY_ADMIN_EMAIL owner can view full member emails; other admins must receive masked member emails. Do not equate any admin or the current viewer with the primary owner. Inspect raw reads/search/fallback names and enforce this at the server/data boundary; UI-only masking cannot meet the full-read restriction.
- Preserve all unrelated local files. Do not copy secret environment values into Git or reports. Preserve all current shared function exports; extend the shared contract explicitly if a necessary new callable is introduced.

## Stage 1: Independent investigation and runtime verification

- [x] Start a fresh read-only Orca Grok worker in a new child worktree based on current main (25d8c90e).
- [x] Confirm the effective model, xhigh effort and actual 500k context through session/runtime metadata. Both the coordinator's TUI inspection and the worker's summary/signals files confirm grok-4.7-build-fast, xhigh, 500000 tokens.
- [x] Independently trace each reported source-to-sink path, inspect direct callers and legitimate web/Android behavior, and report concrete file/line evidence, a useful reproducer and the proposed smallest boundary. Read-only investigation completed via worker_done; no source changed.
- [x] Coordinator reconciles evidence and user masking preference. The investigation's proposed public-field deletion is replaced with owner-only raw reads and safe server projections to preserve existing data and Android own-profile reads.

## Stage 2: Grok implementation

### Story A: Preserve existing profile state during onboarding

Affected paths: src/app/onboarding/page.tsx; relevant existing auth/profile writers; tests/firestore-rules.test.mjs; focused onboarding regression test.

- [x] Reproduce a failing onboarding save against the current rules with nonzero existing statistics and a legacy profile.
- [x] Use an atomic/retry-safe existing-vs-new profile persistence path that writes only permitted existing-profile fields and safely initializes a truly missing profile.
- [x] Prove existing statistics/email/role/creation time/guides stay unchanged; prove new profile creation succeeds and protected writes remain denied.

### Story B: Close mail markup injection and preserve literal content

Affected paths: functions/src/index.ts renderMailTemplate and its direct email callers; optional focused utility under functions/src/utils; tests/backend-contract.spec.ts and focused mail tests; mail editor copy/preview only if its contract changes.

- [x] Capture failing security cases before patching: custom anchor/image markup, escaped/encoded variants, a nickname containing HTML/quotes and $&/$`/$', and placeholder-looking replacement values.
- [x] Render developer content as escaped plain text, preserve line breaks and supported substitutions with a single nonrecursive callback pass. Platform code alone creates tracking anchors from validated trusted URLs. Keep a working default reminder and daily template.
- [x] Escape dynamic text and validate/escape URL attributes at every affected HTML sink, including participation and approval emails; verify malicious stored templates are safe without a data migration.
- [x] Verify both daily and nudge output, normal Unicode names, special literals, and legitimate tracking URLs. Do not send test email to real users.

### Story C: Prevent like sender spoofing

Affected paths: firestore.rules likes create; functions/src/index.ts onLikeCreated; src/lib/community.ts and canonical Android callers for compatibility inspection; focused rule/notification regressions.

- [x] Reproduce create-as-another-user and forged notification nickname; keep a legitimate app/user like as controls.
- [x] Enforce the sender UID at document creation, validate the existing target shape as needed, and resolve display identity from the sender's user record rather than submitted nickname for both notification branches.
- [x] Prove spoofed writes fail and ordinary likes, unlike permissions and notifications remain compatible.

### Story D: Apply the confirmed email masking policy

Affected paths: src/app/(dashboard)/admin/members/page.tsx; ranking/page.tsx; explore/page.tsx; my-apps/[id]/manage/page.tsx; a focused src/lib member-data wrapper; functions/src/index.ts; functions/shared-contract.json; firestore.rules; focused callable/projection and rule tests. Canonical Android remains read-only for this release.

- [x] Resolve the primary owner from the established server-side PRIMARY_ADMIN_EMAIL configuration and a verified authenticated email, requiring the persisted admin role. A missing configuration or unverified caller must fail closed. Never use a Firestore email field or a client flag to choose the full-email branch.
- [x] Add getMemberDirectory: admin-only callable; explicit safe member projection with full email only for the verified primary owner and masked email for every other admin, including their own directory row. Mask as first Unicode character + *** + @domain, or *@domain for one character; absent/invalid input returns no raw email. Search only projected visible fields.
- [x] Add getPublicProfiles: signed-in callable returning an explicit allowlist of uid/nickname/profileImage/ranking statistics needed by ranking/explore, never contact email, email local-part fallback, settings, tokens or private data. Replace their raw users collection reads. Preserve current sorting and ranking semantics.
- [x] Restrict raw /users document get to its owner and deny cross-user list queries. Each user and canonical Android can still read their own existing profile unchanged. The primary owner also uses the callable for the full directory; do not introduce a rule-visible mutable primary flag or a global claim migration.
- [x] Add getAppParticipants: callable scoped to an app's actual developer or an admin, with explicit safe participation fields and server-derived profile information. The verified primary admin gets full email; other admins get masked email even when they own the app. Ordinary non-admin developers retain the existing app-scoped tester contact workflow. Own Auth/profile email remains readable to its subject.
- [x] Remove the generic-admin raw participation read exemption, and prevent non-primary admins from using raw developer-side participation reads to bypass masking. Keep testerId == caller raw reads for the caller's own participation and keep ordinary non-admin app-developer raw reads compatible. Web management uses getAppParticipants, including primary admins. Do not remove tracking tokens required by a legitimate tester's own check-in, and do not expose them through directory/public projections.
- [x] Audit other authorized raw copies/callables for a concrete same-policy bypass. Protect the affected client write boundaries so a secondary admin cannot rewrite member identity/contact or grant a primary privilege to defeat this policy. Keep intended moderation/deletion actions and server statistics writes intact.
- [x] Implement the policy consistently across visible email, fallback display names, search, accessibility labels and confirmations. Refresh management data after actions; preserve functional loading/error states and avoid losing current ranking/explore behavior.
- [x] Prove primary full/secondary masked/public no-email behavior, verified-email and missing-config failure, direct SDK cross-user denial, admin participation bypass denial, tester self and ordinary developer compatibility, short/Unicode/missing emails, and a forged Firestore email/role not granting primary access.
- [x] No production data deletion/backfill, private-contact migration, new primary configuration document, or Android source edits. Deploy the additive callables first; then ship compatible web clients and the restrictive rules in the reviewed release. Record rollback ordering and the temporary compatibility limits of older open browser tabs.

## Stage 3: Review, repairs and release

- [x] Grok runs root lint/build, Functions lint/build, emulator permission tests and the relevant Playwright suite, preserving exact commands, counts and any skipped authenticated checks. Inspect canonical Android callable/like/profile references in ../goote_app without modifying unrelated changes there.
- [x] Grok reports worker_done with the candidate diff, tests and remaining limits; no release in this first implementation assignment.
- [x] Coordinator independently checks the complete diff, every changed security condition/caller, a surviving bypass candidate and a legitimate regression candidate; run focused independent checks for evidence gaps.
- [x] Coordinator sends review results back through Orca for Grok to repair and rerun affected checks; require another worker_done even if the follow-up is verification only.

### Review repair pass

- [x] Participation client updates are denied. An admin can no longer rewrite `testerId` and then read another tester's email. Own tester reads, non-admin developer reads, and tester/developer/admin deletes stay allowed. Server callables still update participations through the Admin SDK.
- [x] Participation and comment notices mask tester or commenter contact for a non-primary admin, omit raw Reply-To, and keep the full contact for an ordinary developer and the verified primary owner. The developer's own delivery address is unchanged. Mail to the tester remains unchanged.
- [x] Member directory and app participants clear and ignore late results when the viewer identity changes. Ranking waits for auth hydration before its callable fetch. Successful member removal drops the row and refreshes the directory.
- [x] Validation after the repair: `npm run lint` passed; `npm run build` passed; `cd functions && npm run lint` passed; `cd functions && npm run build` passed; `firebase emulators:exec --project demo-goote-rules --only firestore "node --test tests/firestore-rules.test.mjs"` with JDK 21 passed 11/11; `npx playwright test` passed 23 and skipped 1 (`participation-leave`, because `PW_LEAVE_APP_ID` and `PW_STORAGE_STATE` are unset). That skip is not a pass.
- [x] Sensitive rows stay bound to the viewer identity that published them, so a primary snapshot is hidden as soon as the viewer key changes. Management reloads return before changing generation when the captured viewer is stale, and unmount invalidates late callbacks.
- [x] Final production check uses an isolated port. `PLAYWRIGHT_USE_PRODUCTION=1 PLAYWRIGHT_PORT=4173 npx playwright test` starts `next start` with `reuseExistingServer` false. Port 3000 was not occupied. The suite passed 23 and skipped the same authenticated participation-leave spec. Production build id `zN1JxnCTf-TQzeNXvQXEJ`. Authenticated admin email screens were not driven in a signed-in browser; identity visibility is covered by the bound-row regression and the production route smoke covers public and logged-out pages.

Release order stays: deploy Functions first, then Hosting, then Firestore rules. Rollback restores rules first, then Hosting. The new callables are additive, so an older Hosting bundle keeps working until the rules deploy. After the rules deploy, a cached old bundle cannot list users or update participations and must be refreshed. Android onboarding in `goote_app` is still the pre-existing merge and was not edited.
- [x] After the second report and successful gates, commit only scoped files, push a focused branch, create/review/merge its PR, and deploy that exact merged source to goote-f48d8. No force push or deletion of existing functions. PR #2 merged as `8ba0df84d1e9f10095e3fd5ef2b78bfe51623476` from reviewed source `f47b16e93f7397af55b9a9b403be45bb69169f3a`.
- [x] Deploy affected Functions, Firestore rules and Hosting; preserve existing secret/environment configuration. Functions completed first, Hosting second (`sites/goote-f48d8/versions/bfc70c202208fbc9` at 2026-11-13T02:12:57Z), Firestore rules last (`rulesets/8df6f789-9d8a-49c4-935b-8c3025026036`, byte match with the merged source).
- [x] Record release SHA/PR/deployment evidence and any specific untested authenticated flow. Previous Hosting version `5835a238fc2d2292` and ruleset `f46d3857-6f4d-4bdf-92fc-0d77e84209c3` are outside Git at `C:/Users/windo/goote-backups/security-2026-11-13T02-01-42Z`. See `docs/releases/2026-11-13-security-and-admin-privacy.md`.
- [x] Configure the previously absent `PRIMARY_ADMIN_EMAIL` for the uniquely corroborated existing project owner and deploy only the five functions that read it. Owner-full and secondary-masked policy checks passed without printing the address or changing member data.

## Review focus and risks

- Concurrent profile creation and roleless legacy users.
- Existing malicious templates, recursive placeholder replacement, string replacement metacharacters and URL attribute breakout.
- Both like target kinds and canonical Android payload compatibility.
- UI masking versus actual raw document access; other screens and fallback/search leaks.
- Firebase Hosting generated SSR runtime is separate from the Node.js 22 shared Functions codebase; all existing exports and environment values must survive deployment.
