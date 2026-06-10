# CourtShare Security Reference

This is the authoritative security reference for CourtShare. Read this before touching any auth, payment, API route, Firestore rules, CSP, or secrets-related code.

---

## Architecture Overview

| Layer | Mechanism |
|---|---|
| Authentication | Google-only via Firebase Auth. ID tokens verified server-side with `checkRevoked: true`. |
| API authorization | `requireFirebaseUser` on every authenticated route. `validateMutationOrigin` on every browser-initiated mutation. |
| Rate limiting | `enforceRateLimit` on every public and mutation route. Upstash Redis in production; in-memory fallback in dev. |
| Client data access | Firestore Security Rules govern all direct client reads/writes. |
| CSP | Per-request nonce generated in `middleware.ts`. `script-src` uses `'nonce-{nonce}' 'strict-dynamic'` — no static `unsafe-inline` in modern browsers. |
| Payment integrity | Server-side price fetch, manual-capture PaymentIntents, Stripe signature verification on webhook. |
| Audit trail | `securityAuditLogs` collection written by server/Admin SDK only; client access denied by rules. |
| Ops alerts | `src/lib/opsAlerts.ts` fires to `WEBHOOK_ALERT_WEBHOOK_URL`/`SLACK_WEBHOOK_URL` on payment failures and suspicious activity. |

---

## API Security Helpers (`src/lib/apiSecurity.ts`)

- **`requireFirebaseUser(req, adminAuth)`** — verifies `Authorization: Bearer <Firebase ID token>` with Admin Auth (`checkRevoked: true`) and returns `{ uid }`. Use on every route that requires identity.
- **`validateMutationOrigin(req)`** — rejects POST/PUT/PATCH/DELETE requests whose `Origin` header does not match the request's own origin. Use before any mutation work on browser-initiated routes. Skip for `stripe-webhook` and `notifications/send-scheduled` (non-browser callers).
- **`enforceRateLimit(req, scope, identifier?)`** — applies the shared rate limiter keyed by `scope:identifier:user-agent`. Use on every public and mutation route.
- **`getClientIp(req)`** — reads `x-forwarded-for` / `x-real-ip` for use as the rate-limit identifier on unauthenticated or IP-keyed routes.

Never call `adminAuth.verifyIdToken` directly — always go through `requireFirebaseUser`.

### Rate-Limited Routes

All of the following call `enforceRateLimit`:

| Route | Method |
|---|---|
| `/api/create-checkout-session` | POST |
| `/api/finalize-checkout-session` | POST |
| `/api/accept-booking` | POST |
| `/api/reject-booking` | POST |
| `/api/cancel-booking` | POST |
| `/api/expire-pending-bookings` | POST |
| `/api/conversations/send-message` | POST |
| `/api/public-profiles/[userId]` | GET |
| `/api/reviews` | GET (public) and POST |
| `/api/send-booking-confirmation` | POST |
| `/api/stripe/create-connect-account` | POST |
| `/api/stripe/check-account-status` | POST |
| `/api/court-availability` | GET |
| `/api/stripe-webhook` | POST (IP-keyed, via `checkRateLimit` directly) |

Add the same pattern to any new public or mutation route.

---

## Content Security Policy

CSP is set per-request by `middleware.ts` — not statically in `next.config.ts`.

**Why per-request:** a nonce is generated for each request using `crypto.randomUUID()`. The nonce is placed in the `Content-Security-Policy` response header and in the `x-nonce` request header so Next.js can apply it to its own inline scripts.

**`script-src` strategy:**
```
'nonce-{nonce}' 'strict-dynamic' https://js.stripe.com https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://accounts.google.com 'unsafe-inline'
```
- Modern browsers (CSP Level 3): enforce nonce + strict-dynamic, **ignore** `'unsafe-inline'` and host allowlists.
- `'strict-dynamic'` trusts scripts dynamically loaded by nonce'd scripts — covers Next.js lazy chunks and Firebase Auth's dynamic `gapi.js` load.
- `'unsafe-inline'` is a silent fallback for pre-CSP3 browsers only.
- `'unsafe-eval'` is added in development only.

**`frame-src`** includes `https://*.firebaseapp.com` and `https://accounts.google.com` for the Firebase Auth popup iframe and Google OAuth flow, and `https://www.openstreetmap.org` for the approximate location map embedded on the court detail page (`/courts/[id]`).

**`img-src`** includes `https://*.tile.openstreetmap.org` for the map tile images loaded inside the OpenStreetMap iframe.

**`connect-src`** includes `https://*.firebaseapp.com` in addition to standard Firebase and googleapis.com entries.

When adding a new third-party script, frame, image, or API origin, update `middleware.ts` deliberately. Do not add `'unsafe-inline'` back to `script-src`.

Static security headers (Referrer-Policy, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) are set in `next.config.ts` since they do not need to be dynamic.

To read the nonce in a layout or route for passing to `<Script nonce={nonce}>`:
```tsx
import { headers } from 'next/headers'
const nonce = (await headers()).get('x-nonce') ?? undefined
```
Do NOT put the nonce in DOM `data-` attributes — that exposes it to injection.

---

## Authentication

- Google-only sign-in via `signInWithPopup(auth, googleProvider)` in `src/components/AuthPage.tsx`.
- Do not add email/password, magic link, or other auth providers.
- All server-side token verification uses `checkRevoked: true` — revoked tokens are rejected immediately.
- Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) is intentionally public. The Firestore rules and server-side token verification are what prevent abuse of that key.

---

## Firestore Rules (`firestore.rules`)

Deploy rules with `npm run deploy:rules`. Always run `firebase use <project-id>` first to confirm the correct project is active.

### `users/{uid}`
- Readable only by the signed-in owner (`request.auth.uid == userId`).
- Create is owner-only; field set is limited to safe profile/waiver fields; `isOwner` cannot be set to `true` by the client.
- Update is owner-only; limited to `displayName` (≤100 chars), `bio` (≤500 chars), `profileImageUrl`, `updatedAt`, and waiver fields.
- `uid` cannot change on update.
- Clients cannot mutate review aggregates, Stripe state, or role fields — those are server/Admin SDK only.

### `courts/{courtId}`
- Public read when `bookableStatus == "active"`; any authenticated user can read any court (needed for booking history display even when status changes).
- Client queries for public listings use `where("bookableStatus", "==", "active")` so only active courts appear in search and featured sections.
- Create requires `ownerId == request.auth.uid`, `bookableStatus` of `"draft"` or `"active"`, and `ownerStripeAccountStatus == "inactive"`.
- Update: owner only; cannot change `ownerId`, Stripe fields, rating aggregates, or arbitrary internal fields. Owner client writes are limited to listing content, images, availability, and `bookableStatus` (`"draft"` or `"active"`).
- Delete: owners may delete only their own `draft` listings. Published listings are unlisted by updating `bookableStatus` back to `"draft"` so booking history and conversation references are not hard-deleted.

### `bookings/{bookingId}`
- Readable by the booking player (`userId`) or the stored host (`ownerId`).
- `ownerId` is written server-side at booking creation and is trusted directly; the rule does not use `get()` to re-derive court ownership.
- Client create/update/delete is denied — all booking writes go through API routes.
- Host dashboard queries with `where("ownerId", "==", user.uid)` so the `ownerId` check is provable from the query constraint.

### `reviews/{reviewId}`
- Publicly readable.
- Client create/update/delete is denied.

### `conversations/{conversationId}` and `messages/{messageId}`
- Participant-only reads (via `isParticipant()` checking `participantIds`).
- Client create is denied for both conversations and messages.
- Client conversation update is limited to `unreadBy`, `updatedAt`, `playerName`, and `ownerName`.
- No client update/delete for messages.
- Conversation IDs (`booking_{bookingId}`) are predictable — access depends on authorization, not obscurity.

### `bookingSlotLocks/{lockId}`
- Client read/write denied.

### `securityAuditLogs/{logId}`
- Client read/write denied.

### Emulator Tests (`emulator-tests/firebaseRules.ts`)
Covers: single-document reads for all collections; list queries (active-court public list, authenticated court list, booking list by userId, booking list by ownerId, messages subcollection by participant); client write denials; storage owner-scoped uploads.

---

## Storage Rules (`storage.rules`)

- Authenticated owner writes only under their own `users/{uid}/...` or `courts/{uid}/...` prefix.
- Allowed content types: `image/jpeg`, `image/png`, `image/webp`.
- Max size: 8 MB.
- Upload paths use `getSafeImageStoragePath` — original filenames are not stored.
- Deploy with Firestore rules together: `npm run deploy:rules`.

---

## Payment Security

- Checkout accepts only: `courtId`, `date`, `time`, `durationMinutes`, `courtNumber`, `guestCount`, `initialMessage`.
- Price, owner ID, guest cap, blocked times, and Stripe account status are always fetched server-side. Never trust client-submitted values.
- Stripe Checkout uses PaymentIntents with `capture_method: "manual"`. Player authorizes at checkout; host acceptance captures.
- Rejection, cancellation, and expiration release uncaptured authorizations or refund captured payments via `src/lib/stripeBookingPayments.ts`.
- Payment release failures in reject/cancel/expire routes alert via `src/lib/opsAlerts.ts` before rethrowing.
- Host payout transfer failures in the accept route alert and record `hostPayoutStatus: "transfer_failed"` on the booking.
- Stripe webhooks verify `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.
- Checkout finalization and webhooks are idempotent by `sessionId`.
- Fee and payout math is centralized in `src/lib/pricing.ts` — keep UI estimates, checkout metadata, accept dialogs, booking records, and Stripe application fee logic aligned with it.
- Stored financial fields: `totalAmountCents`, `expectedAmountCents`, `ownerAmountCents`, `courtShareFeeCents`, `processingFeeCents`.

### Stripe And Listing Bookability
- Published courts use `bookableStatus: "active"` and are publicly visible even if the host has not completed Stripe Connect setup.
- Draft/unlisted courts use `bookableStatus: "draft"` and must not be bookable. `POST /api/create-checkout-session` explicitly rejects non-active courts because it uses Admin SDK and bypasses Firestore read rules.
- If a host has a fully active Stripe Connect account (`charges_enabled && payouts_enabled && details_submitted`), checkout uses a destination-charge path with `application_fee_amount` and `transfer_data.destination`.
- If the host has no active Connect account, checkout uses a platform-held manual-capture PaymentIntent (`hostPayoutMode: "platform_hold"`). On acceptance, payment is captured to CourtShare; the booking records `hostPayoutStatus: "pending_connect_account"` until the host completes setup.
- `POST /api/stripe/check-account-status` updates owned courts' Stripe status fields only; it does not demote published listings back to draft. When a host becomes active, it attempts pending platform-held transfers via `transferPlatformHeldBookingToHost`.
- Firestore rules let owners move their own listings between draft and active, while keeping `ownerStripeAccountStatus` and `ownerStripeMode` server-owned.

---

## Booking Conflict Protection

- Slot lock logic: `src/lib/bookingSlotLocks.ts`. Conflict checks: `src/lib/bookingConflicts.ts`.
- Booking creation writes deterministic lock docs covering the court, date, court number, and every 30-minute segment spanned.
- Pending locks expire with the request and are released on rejection, cancellation, and expiration.
- Accepted bookings mark locks confirmed.
- Slot selection blocks confirmed bookings, still-actionable pending requests, and same-court-number overlaps.
- Do not replace `GET /api/court-availability` with a broad client Firestore query.
- Keep checkout finalization and Stripe webhook on `createBookingFromPaidCheckoutSession`; do not reintroduce a separate booking write path.

---

## XSS And Content Safety

- No `dangerouslySetInnerHTML` usage anywhere in the app.
- User-authored content (bio, messages, descriptions, reviews, decline reasons, listing names, access instructions) must always use React text rendering — never render as HTML.
- Image uploads validated in `src/lib/imageUploadValidation.ts`: jpeg/png/webp only, max 8 MB. Wired into onboarding, profile, create-listing, and edit-listing pages.
- Bio field: max 500 characters enforced in both Firestore rules and `app/profile/page.tsx`.
- DisplayName field: max 100 characters enforced in Firestore rules; client-side `maxLength` on form fields.

---

## CSRF And CORS

- Protected APIs use Firebase Bearer tokens, not cookies — no CSRF surface from cookie theft.
- `validateMutationOrigin` rejects mutations where `Origin` does not match the request's own origin.
- No permissive `Access-Control-Allow-Origin` headers anywhere.
- Do not add wildcard CORS to authenticated, payment, booking, messaging, review, or profile routes.

---

## Ops Alerts And Audit Logging

### Ops Alerts (`src/lib/opsAlerts.ts`)

`sendOpsAlert(title, details)` fires to `WEBHOOK_ALERT_WEBHOOK_URL` or `SLACK_WEBHOOK_URL`. Called for:

- Stripe webhook misconfiguration, signature failure, double-booking release, processing error.
- Payment release failure on rejection, cancellation, or expiration.
- Host payout transfer failure on acceptance.
- Suspicious checkout volume: 6+ checkout sessions from the same user in one rate-limit window.

### Audit Logging (`src/lib/securityAudit.ts`)

`writeSecurityAuditLog(db, eventType, details)` writes to `securityAuditLogs`. Event types:

| Event | Route |
|---|---|
| `checkout_session_created` | create-checkout-session |
| `checkout_finalized` | finalize-checkout-session |
| `booking_accepted` | accept-booking |
| `booking_expired_on_accept` | accept-booking |
| `booking_rejected` | reject-booking |
| `booking_cancelled` | cancel-booking |
| `booking_expired_by_host_view` | expire-pending-bookings |
| `booking_expired_by_cron` | notifications/send-scheduled |
| `conversation_message_sent` | conversations/send-message |
| `review_submitted` | reviews POST |
| `stripe_checkout_processed` | stripe-webhook |
| `stripe_amount_mismatch` | stripe-webhook |
| `stripe_double_booking_released` | stripe-webhook |
| `stripe_webhook_processing_failed` | stripe-webhook |
| `stripe_account_status_checked` | stripe/check-account-status |
| `booking_confirmation_resent` | send-booking-confirmation |

Review `securityAuditLogs` during incident triage. Never expose this collection to clients.

---

## Mock Mode Safety

- Mock mode is development-only. Production disables it even if mock env vars are accidentally set (`src/lib/firebase.ts`, `src/lib/mockApiMode.ts`, `src/lib/courtShareMetadata.ts`).
- Do not set `MOCK_API` or `NEXT_PUBLIC_USE_MOCK_DATA` in production.
- Do not rely on mock mode to verify Stripe, Firebase Admin, Firestore rules, Storage rules, or production auth.

---

## Secrets And Production Config

Keep these out of git and client bundles:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Firebase Admin credentials (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- Resend/email credentials
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `WEBHOOK_ALERT_WEBHOOK_URL` / `SLACK_WEBHOOK_URL`

`NEXT_PUBLIC_*` vars are intentionally public — do not put secrets behind that prefix.

`CRON_SECRET` is required in production. Missing it is allowed only outside production.

Rotate any secret that was committed, logged, pasted, or shared.

---

## Dependency Security

- `npm audit fix` (non-force) has been run. The `ws` vulnerability is resolved.
- Two remaining moderate findings are **unresolvable** at the current time:
  - `@tootallnate/once` via `firebase-admin` transitive chain. `firebase-admin@13.10.0` is already the latest published release — there is no newer version to upgrade to. The vulnerable code is in an HTTP proxy utility used for internal server-to-server calls, not in user-facing request paths.
  - `postcss` via `next` transitive chain. `next@16.2.6` is already the latest published release. PostCSS runs at build time only — this vulnerability cannot be triggered by end users at runtime.
- npm's suggested fix (`--force`) proposes catastrophic downgrades to `firebase-admin@10.3.0` and `next@9.3.3`. Do not run it.
- **Action**: re-run `npm audit` after each new release of `firebase-admin` or `next`. When either ships a version that internally bumps the affected transitive dep, the finding will clear on its own. No manual intervention is possible until then.

---

## Production Rules Deployment

```bash
firebase projects:list          # confirm correct project
firebase use <project-id>       # set active project
npm run deploy:rules            # deploys firestore.rules and storage.rules together
```

Rules files: `firestore.rules`, `storage.rules`.

---

## Required Production Secrets

Set in your hosting provider (Vercel), not in git:

```bash
vercel env add CRON_SECRET production
vercel env add WEBHOOK_ALERT_WEBHOOK_URL production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add FIREBASE_CLIENT_EMAIL production
vercel env add FIREBASE_PRIVATE_KEY production
# also: RESEND_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

Stripe webhook: endpoint path `/api/stripe-webhook`, event `checkout.session.completed`. Signing secret must match the live Stripe webhook endpoint for the deployed production URL.

---

## Cron Protection

`/api/notifications/send-scheduled` requires `Authorization: Bearer $CRON_SECRET`. Vercel Cron must be configured with this secret. Unauthenticated requests return `401`.

---

## Backups And Retention

**PITR is enabled.** Point-in-Time Recovery is configured in Firebase Console → Firestore → Backups. This covers the vast majority of operational incidents — accidental deletes, bad migrations, data corruption — with a 7-day recovery window down to the minute.

**Scheduled GCS exports are not yet configured.** This is a recommended future addition — set up before reaching meaningful transaction volume or if compliance retention is required. Exports extend coverage beyond PITR's 7-day window and provide an off-platform copy independent of the GCP account.

If you add exports later:
1. Cloud Scheduler → daily job → Firestore export API → locked-down GCS bucket.
2. GCS bucket: Uniform Bucket-Level Access, no public reads, lifecycle rule deleting objects older than 30 days.
3. Collections to verify in restore drills: `users`, `courts`, `bookings`, `conversations`, `reviews`, `bookingSlotLocks`, `securityAuditLogs`.
4. Quarterly restore drill into a non-production Firebase project.

---

## Monitoring Signals

Alert on (`WEBHOOK_ALERT_WEBHOOK_URL` / `SLACK_WEBHOOK_URL`):
- Stripe webhook misconfiguration or signature failure.
- `stripe_double_booking_released`, `stripe_amount_mismatch`, `stripe_webhook_processing_failed`.
- Payment release failure on rejection, cancellation, or expiration.
- Host payout transfer failure.
- Suspicious checkout volume (6+ sessions from same user in rate-limit window).

Also watch: repeated booking rejection/cancellation spikes; repeated message sends near rate-limit thresholds.

---

## Incident Response

**Key rotation:**
- Rotate Stripe secrets in Stripe Dashboard and Vercel env.
- Rotate Firebase Admin credentials in Google Cloud IAM.
- Rotate email and Upstash credentials in their provider dashboards.
- Redeploy after rotation; verify login, checkout, webhook, and scheduled jobs.

**Disable bookings temporarily:**
- Set affected courts to `bookableStatus: "draft"` via Admin SDK or Firebase Console.
- Keep cancellation/refund routes available unless payment integrity requires a full freeze.

**Release payments manually:**
- Use existing app flows (host rejection, player/host cancellation, pending expiration) first.
- For manual remediation: inspect `sessionId` and `paymentIntentId` on the booking, then release/refund through Stripe Dashboard.
- Record manual remediation in `securityAuditLogs` or a private incident doc.

**User communication:**
- Identify affected `bookingId`, `courtId`, `userId`, and `ownerId`.
- Contact players and hosts separately with only their own booking details.
- Do not include raw Firebase UIDs, internal audit data, or unrelated participant details in user-facing emails.

---

## Release Checklist

```bash
npm test -- --runInBand
npm run test:rules
npx tsc --noEmit
npm run build
npm audit --audit-level=moderate
firebase use <project-id>
npm run deploy:rules
```

- Verify all production env vars are set in Vercel (including `WEBHOOK_ALERT_WEBHOOK_URL`).
- Verify Stripe live webhook secret and endpoint URL match.
- Confirm one production-like booking request can be created, accepted, cancelled, and messaged end-to-end.

---

## Manual Security Tests Before Launch

- User A cannot view User B's `/booking/[bookingId]`.
- User A cannot read or send messages in User B's conversation.
- Player cannot accept or reject a booking.
- Host cannot accept, reject, or cancel another host's booking.
- User cannot alter checkout price, duration, host payout, or owner ID from the browser.
- Checkout succeeds for active courts whose host Stripe setup is incomplete, but records a platform-held payment and pending host payout.
- Checkout fails for draft/unlisted courts, even if called directly against the API.
- Draft listings do not appear in search, featured courts, or public direct URLs for non-owners.
- Multiple tabs cannot create overlapping confirmed bookings for the same slot.
- User cannot review a booking they were not part of.
- User cannot review outside the review window.
- User cannot upload SVG, HTML, executable files, oversized images, or unsupported types.
- Production does not load mock data or mock API behavior.
- CSP blocks inline script execution (verify no console CSP violations on page load).

---

## Remaining Improvement Areas

- **Firebase backups** — point-in-time recovery and daily exports not yet configured (see Backups section above).
- **Dependency upgrades** — `firebase-admin` and `next` major-version upgrade pass needed to clear transitive audit findings.
