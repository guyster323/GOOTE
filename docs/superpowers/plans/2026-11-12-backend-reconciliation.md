# Shared Backend Reconciliation Implementation Plan

**Goal:** Preserve deployed web/Android behavior, reconcile local changes, and commit, merge and deploy the verified sources.

**Architecture:** `goote/functions` owns the shared Firebase backend. `goote_app` consumes its callable API; the repositories remain separate.

**Spec:** User-approved reconciliation sequence in this chat.

- [ ] Back up both working trees and compare all four deployed source archives.
- [ ] Restore deployed function contracts and integrate meaningful local changes without discarding them.
- [ ] Align Functions runtime/dependencies, document ownership, and verify all web/mobile callable names.
- [ ] Run Functions build, root lint/build and Playwright regressions; inspect auth and rule changes.
- [ ] Commit source only, push a focused branch, merge the reviewed PR, deploy and wait for completion.
- [ ] Verify deployed functions and public routes; record rollback references and remaining limits.

Rollback: preserve pre-deploy function build/revision IDs and source archives; revert the release commit and redeploy the previous source if needed. Do not remove existing deployed functions.
