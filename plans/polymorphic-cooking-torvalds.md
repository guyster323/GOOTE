# GOOTE Platform Improvement Plan - Phase 2

This plan implements enhanced email notifications, daily participation tracking, comments system, and improved statistics for the GOOTE platform.

## 1. Enhanced Participation Request Email
- **Context**: Developers need easy ways to manage testers from their inbox.
- **Implementation**:
  - Update `functions/src/index.ts`: `requestParticipation` function.
  - Modify HTML template to include:
    - **Copy Email Button**: A button with a `mailto:` link and a visual indicator for manual copying. (Note: True clipboard copy in email is limited by clients, so we'll provide a clear text block and a button to "Open Console").
    - **Add to Console Button**: A direct link to `https://play.google.com/console/u/0/developers/[developerId]/app/[appId]/internal-testing`.
  - **Auto-Registration**: When the developer clicks the "Add to Console" button (which will actually be a redirect link through our API), we will automatically register the tester in the GOOTE `participations` collection if not already present.

## 2. Comments System
- **Context**: Users need to provide feedback and developers need to see improvements.
- **Implementation**:
  - **Firestore Schema**: `comments` collection: `{ appId, userId, userName, content, createdAt }`.
  - **UI**:
    - `src/app/apps/[id]/page.tsx`: Add a comments section with a simple input and list.
    - `src/app/(dashboard)/dashboard/page.tsx`: Add a "Recent Comments" feed for apps the user owns or participates in.

## 3. Daily Participation Tracking & Scheduler
- **Context**: Motivating daily test usage and tracking consistency.
- **Implementation**:
  - **Cloud Function (Morning 09:30 KST)**: `sendDailyTaskMail`.
    - Fetches all active participants.
    - Sends email with "Run App" button (Store link).
    - Link includes a unique tracking token: `https://goote.app/api/track?tid=[token]`.
  - **Cloud Function (Evening 17:30 KST)**: `sendNudgeMail`.
    - Fetches participants who haven't clicked the button today.
    - Sends a reminder email.
  - **API Endpoint**: `api/track`.
    - Updates Firestore `participations` for the current day.
    - Returns a success page or redirects to the Store.

## 4. Statistics Display
- **Context**: Transparency on app testing progress.
- **Implementation**:
  - Update `src/app/apps/[id]/page.tsx` and dashboard.
  - Display `dailyParticipants` (count of users who checked in today) and `totalParticipants`.

## Critical Files
- `functions/src/index.ts` (Schedulers, Tracking API)
- `src/app/apps/[id]/page.tsx` (Comments UI, Statistics)
- `src/app/(dashboard)/dashboard/page.tsx` (Comments feed)
- `src/lib/api.ts` (New for frontend tracking calls)

## Verification Plan
1. **Email Buttons**: Verify participation emails contain the correct Console links and tester info.
2. **Comments**: Post a comment and verify it appears on the app page and the developer's dashboard.
3. **Schedulers**: Use Firebase Shell or manual trigger to test 09:30 and 17:30 logic.
4. **Tracking**: Click the "Run App" button in a test email and verify the `dailyCheck` updates in Firestore.
5. **Stats**: Verify numbers on the UI match the Firestore data.
