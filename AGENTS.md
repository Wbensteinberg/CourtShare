# CourtShare Agent Guide

## Project Purpose

CourtShare is an Airbnb-style marketplace for tennis courts, starting with Los Angeles. Players search for nearby courts, pick a date and time, authorize a card through Stripe, and manage booking requests from the upcoming bookings page. Court hosts list private or semi-private courts, define availability and blocked times, approve or reject booking requests, manage Stripe Connect onboarding, and track revenue from a host dashboard. Payment capture is tied to host acceptance, not checkout completion. Authentication is Google-only; do not add or restore email/password signup, login, or password reset flows.

## Product Shape

The landing/search experience lives at `/courts` and is the primary public entry point. Authenticated players use `/upcoming`, court hosts use `/host`, messages live at `/messages`, the signed-in profile editor lives at `/profile`, public member profiles live at `/profile/[userId]`, listing creation is at `/create-listing`, listing edits are at `/edit-listing/[courtId]`, court details and booking checkout start at `/courts/[id]`, and individual booking details live at `/booking/[bookingId]`. Upcoming booking rows should show the court name plus the host name as `Hosted by ...`; host dashboard booking rows should show the court name plus the player name. Both booking surfaces should include booking-scoped `Message` buttons that route to `/messages?conversationId=booking_{bookingId}` using the stored `conversationId` when available. The app supports a mock mode through `NEXT_PUBLIC_USE_MOCK_DATA` or missing Firebase config, which makes local development possible without Firebase or Stripe. For a **full mock HTTP API** as well (all `/api/*` routes served from an in-memory store, no Admin SDK or Stripe), run `npm run dev:mock`, which sets `MOCK_API=true` together with `NEXT_PUBLIC_USE_MOCK_DATA=true`. Use `Authorization: Bearer mock-id-token` on those routes (same value as mock client `getIdToken()`). Regular `npm run dev` with a complete `.env.local` still uses real Firebase and Stripe. **Never set `MOCK_API` in production.** The browser `localStorage` mock DB (`src/lib/mockData.ts`) and the server mock API store are independent unless you later route more mock-mode UI reads through `/api/*`.

## Frontend — Pages and Navigation

Product-facing routes map roughly as: **Home / Search** → `/courts`; **Court Details** → `/courts/[id]`; **Profile** → `/profile`; **Messages** → `/messages`; **Upcoming Bookings** → `/upcoming`; **Host Dashboard** → `/host`; **Add New Listing** → `/create-listing`; **Edit Listing** → `/edit-listing/[courtId]`; **Booking Details** → `/booking/[bookingId]`; **Sign In / Sign Up** → shared Google-only auth pages (see Auth UI rules below).

### Header (`AppHeader.tsx`)

- **Unauthenticated:** Sign In and Sign Up (both Google-only; no email/password).
- **Authenticated:** Profile icon → `/profile`; expandable menu with Upcoming Bookings, Messages, Host Dashboard, Profile, and log out.
- **Become a Host:** If the user is not a host (no listing), the menu entry for Host Dashboard should behave as **Become a Host**: navigate to Host Dashboard **Your Courts** and surface the flow that ends at the **Add Listing** action (e.g. dialog with a button to `/create-listing`). *(Align implementation with this spec.)*

### Home (`/courts`)

- Hero section; search section → refreshes / stays on search experience on the same page.
- Featured courts gallery → Court Details.
- If unauthenticated: “How it works” (or equivalent) with a path toward Sign Up / Google entry.

### Search (`/courts`)

- Search controls refresh the search experience on this page.
- Results list on the left → Court Details on row/card click.
- **TODO:** Map on the right showing courts; marker/court click should also navigate to Court Details.

### Profile (`/profile`)

- **About Me:** Editable player profile card (same card owners see on the other party). **TODO:** If the user is a host, also show a host-facing profile card (what players see).
- **Past Bookings:** Past player bookings → Booking Details.
- **My Reviews:** Player reviews from hosts → Booking Details.
- If not a host: **Become a Host** → Host Dashboard Your Courts → Add Listing popup / `/create-listing`.

### Messages (`/messages`)

- All conversations for the signed-in user.
- Each thread: dated message history; link or control to view the other participant’s public profile; link to **Booking Details** for the booking when applicable.
- User-authored messages should go through `POST /api/conversations/send-message`, not direct client Firestore writes, so each message is saved, unread state is updated, and every other participant receives an email containing the message body.

### Upcoming Bookings (`/upcoming`)

- **Upcoming Bookings:** Confirmed and pending → Booking Details per row.
- **Cancelled Requests:** Cancelled, rejected, expired → Booking Details.
- **Completed bookings** control → Profile **Past Bookings** subtab.

### Host Dashboard (`/host`)

- **Upcoming Reservations:** Confirmed and pending → Booking Details.
- **Your Courts:** Listings with edit weekly availability, **Edit Listing** → `/edit-listing/[courtId]`, **Add listing** → dialog then `/create-listing`.
- **Earnings:** Earnings over time (chart) and Stripe setup / manage payout controls.
- **Reviews:** Host and per-court review lists → Booking Details.
- **Completed Reservations** and **Cancelled Requests:** Same navigation pattern as player upcoming page where applicable.

### Add New Listing (`/create-listing`)

- Full listing fields; on submit, legal / waiver acknowledgement, then navigate to Host Dashboard **Your Courts**.

### Edit Listing (`/edit-listing/[courtId]`)

- Full edit fields; on submit → Host Dashboard **Your Courts**.

### Booking Details (`/booking/[bookingId]`)

- **Status** and payment-related copy per actual booking state.
- **Reviews (completed bookings):** Show submitted reviews; if the window is still open, allow the player to review host+court or the host to review the player; if the window closed with no review, show **No Review**. Server-side review eligibility uses `isBookingReviewable` in `src/lib/bookingDates.ts` (**seven days after the booking’s end time**, not merely “completed at” midnight semantics—keep UI aligned with the API).
- **Cancellation:** Players can cancel pending requests, and confirmed player cancellations are only allowed at least 24 hours before the parsed court start time. Hosts can cancel bookings for their own courts. Booking detail UI must call `/api/cancel-booking` so authorization release/refund behavior happens server-side.
- Court info, gallery, rating (rating opens reviews modal).
- **Player view:** Host profile + rating (modal). **Host view:** Player profile + rating (modal).
- Message history scoped to this booking (booking conversation).

### Court Details (`/courts/[id]`)

- Court info, gallery, rating (modal); host profile + rating (modal).
- Request booking: waiver then Stripe Checkout.
- **TODO:** Map for court location.
- **TODO:** Optional “send a message with request” style flow.

### Sign In / Sign Up

- Single card, **Continue with Google** only; copy differs for sign-in vs sign-up.
- **TODO:** After sign-up, dedicated onboarding to fill name and bio (and auto description) before full app use, beyond the existing “blank displayName → `/profile`” guard.

## Repo Structure

`app/` contains the Next.js App Router pages and API routes. The main pages are `app/courts/page.tsx` for the landing/search page, `app/courts/[id]/page.tsx` for court details and booking selection, `app/create-listing/page.tsx` for host listing creation, `app/upcoming/page.tsx` and `app/host/page.tsx` for the current player and host route aliases, `app/messages/page.tsx` for the Airbnb-style player/host inbox, `app/profile/page.tsx` for signed-in user profile editing/logout behavior, `app/profile/[userId]/page.tsx` for public player/host profiles and reviews, and `app/booking/[bookingId]/page.tsx` for booking detail/cancel flows. `app/api/` contains server-side Stripe, booking acceptance, expiration, cancellation, rejection, webhook, email, checkout finalization, review, public profile, and rate-limit routes. Firestore rules are checked into `firestore.rules`; keep them aligned with any client reads/writes added to pages.

`src/components/` contains shared UI and product components. `AppHeader.tsx` is the current shared header and includes the Messages navigation link for signed-in users, `HeroSection.tsx` and `SearchSection.tsx` power the landing search experience, `CourtCard.tsx` renders court results, `AddressAutocomplete.tsx` handles address/location inputs, `InlineWeeklyCalendar.tsx`, `CourtCalendar.tsx`, and `DayDetailModal.tsx` support availability selection, and `WaiverAcknowledgmentDialog.tsx` handles legal acknowledgement flows. `src/components/ui/` contains shadcn-style primitives such as `Button`, `Card`, `Input`, `Dialog`, `Badge`, and related controls.

`src/lib/` contains shared logic and integrations. `firebase.ts` initializes client Firebase and mock-mode detection, `firebase-admin.ts` initializes Admin SDK for API routes, `AuthContext.tsx` provides auth/profile state, `mockData.ts` stores seeded local mock users/courts/bookings/messages, `bookingDates.ts` centralizes booking date parsing/filtering/sorting and pending-request expiry helpers, `bookingCreation.ts` finalizes checkout sessions into booking records, `conversations.ts` creates booking request conversations, `stripeBookingPayments.ts` releases uncaptured authorizations or refunds captured payments, `geolocation.ts` contains location helpers, `waivers.ts` contains waiver versions/content, `email.ts` sends transactional email, `theme.ts` mirrors key theme colors for TypeScript, and `utils.ts` contains generic utility helpers.

## Theme, Colors, Fonts, And Style

Global styling starts in `app/globals.css`, which imports `app/theme.css`. The theme system should be the source of truth for brand colors: `--brand-logo` and `--brand-green` are `#00b884`, `--site-accent` is `#008665`, `--site-accent-hover` is `#00785b`, soft/muted variants are computed with `color-mix`, and Tailwind inline tokens map green/emerald/teal utilities back to the accent color. The TypeScript mirror in `src/lib/theme.ts` should stay aligned when color values change.

Fonts come from `app/layout.tsx` using `Geist` and `Geist_Mono`, with global fallbacks in `app/globals.css` to system UI, Segoe UI, Roboto, Inter, and related sans-serif fonts. The visual style is clean marketplace SaaS: white surfaces, subtle gray borders, restrained shadows, green accent CTAs, large rounded cards currently standardized around `rounded-[32px]` for major rectangular sections, smaller `rounded-xl` controls where appropriate, and a tennis-focused green brand identity. Prefer theme variables or Tailwind theme tokens over hardcoded green values. The shared header should show the signed-in user's profile image in the top-right slot when `users/{uid}.profileImageUrl` or Firebase `user.photoURL` exists, falling back to an initial/avatar state rather than a text-only desktop Profile button.

## Database Schemas

Firestore `users/{uid}` stores profile and account state: `uid`, `email`, `displayName`, `bio`, `profileImageUrl`, legacy host flag `isOwner`, aggregate review fields `playerRating`, `playerReviewCount`, `ownerRating`, and `ownerReviewCount`, optional Stripe fields such as `stripeAccountId` for legacy/live compatibility, `stripeLiveAccountId`, `stripeTestAccountId`, `stripeAccountMode`, `stripeAccountStatus`, `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`, Stripe requirements/disabled-reason data returned by account-status routes, and waiver fields such as `ownerListingWaiverVersionAccepted`, `ownerListingWaiverAcceptedAt`, `playerBookingWaiverVersionAccepted`, and `playerBookingWaiverAcceptedAt`. User-facing copy should say host, but existing Firestore field names still use owner terminology for compatibility. `displayName` is required for trustworthy marketplace identity: Google sign-in should populate it when available, and users with a blank name should be sent to `/profile` to complete it. Profile saves must reject blank names and propagate name changes into existing conversation participant fields. `profileImageUrl` is the preferred app-level avatar source for the header and profile UI.

Firestore `courts/{courtId}` stores court listings: `name`, `location`, `address`, `accessInstructions`, `price` as dollars per hour, `description`, `imageUrl`, `imageUrls`, `ownerId`, optional `latitude` and `longitude`, `numberOfCourts`, `maxAdvanceBookingDays`, `blockedDates`, date-specific `blockedTimes`, global `alwaysBlockedTimes`, `alwaysBlockedTimesByDay`, multi-court `courtSpecificAlwaysBlockedTimes`, `courtSpecificAlwaysBlockedTimesByDay`, `surface`, `indoor`, `amenities`, `rating`, `reviewCount`, and `createdAt`. Images are uploaded to Firebase Storage under `courts/...` when not in mock mode.

Firestore `bookings/{bookingId}` stores booking requests created after Stripe Checkout completes and the card authorization exists: `courtId`, `userId`, `date`, `time`, `courtNumber`, `duration` in hours for backward compatibility, `durationMinutes`, `status` as one of `pending`, `confirmed`, `completed`, `cancelled`, `rejected`, or `expired`, optional `cancelReason`, `createdAt`, `expiresAt`, `expiredAt`, `confirmedAt`, `capturedAt`, `sessionId`, `paymentIntentId`, `paymentStatus`, `refundId`, `totalAmountCents`, `expectedAmountCents`, optional `conversationId`, and notification bookkeeping such as `checkInReminderSentAt`, `playerReviewReminderCount`, `playerReviewReminderLastSentAt`, `ownerReviewReminderCount`, and `ownerReviewReminderLastSentAt`. Pending booking requests are actionable for 24 hours; after that they should be treated as expired, hidden from pending counts/lists, and not allowed to block future checkout attempts. Upcoming and host dashboards should expire stale pending bookings on load; the scheduled notification route also expires stale pending bookings, releases/refunds payment, and emails the player. If a booking points at a deleted or unreadable court, never display the raw `courtId`; use a neutral label such as `Court unavailable`. Mock mode stores equivalent `MockUserProfile`, `MockCourt`, `MockBooking`, `MockConversation`, and `MockMessage` shapes in browser storage through `src/lib/mockData.ts`.

Firestore `conversations/{conversationId}` stores lightweight booking-related messaging state: `participantIds`, `playerId`, `playerName`, `ownerId`, `ownerName`, `courtId`, `courtName`, `bookingId`, booking summary fields such as `bookingDate`, `bookingTime`, `bookingDurationMinutes`, and `bookingCourtNumber`, `status`, last-message metadata, unread recipients, and timestamps. Booking request conversations use deterministic IDs like `booking_{bookingId}` and contain a `messages` subcollection. Keep conversation creation idempotent because Stripe webhooks and checkout finalization can be retried. Do not display raw Firebase UIDs in messaging or dashboard UI; fetch/use profile display names, then email prefixes, then generic labels such as `Player` or `Court host`. The messages page should load the selected booking and let hosts accept or decline pending requests directly from the conversation header while still calling the protected booking API routes for payment capture or authorization release.

Firestore `reviews/{bookingId}_{reviewerRole}` stores one review per booking participant role: `bookingId`, `courtId`, `playerId`, `ownerId`, `reviewerId`, `reviewerRole` (`player` or legacy `owner` for host reviews), `revieweeId`, `targetType` (`court_owner` or `player`), whole-star `rating` from 1 to 5, `comment`, `createdAt`, and `updatedAt`. Players review the host and court together, which updates both `courts/{courtId}.rating/reviewCount` and the host's `ownerRating/ownerReviewCount`; hosts review players, which updates the player's `playerRating/playerReviewCount`. Reviews are available for one week after the booking end instant per `isBookingReviewable` in `src/lib/bookingDates.ts`. Public profile and court review queries only show a review after the paired review for that booking exists, so one party cannot read the other party's review before submitting their own; authenticated dashboard review-state checks still return the caller's own submitted reviews immediately.

## Backend — Architecture and API Reference

### Layer overview

| Layer | Responsibility |
| --- | --- |
| **Firebase Authentication** | Google-only sign-in; issues **ID tokens** for the client and for `Authorization: Bearer` on server routes. |
| **Firestore + Storage (client)** | Primary read/write for profiles, courts/listings, booking lists, conversations/messages, and many dashboard/search flows—governed by **`firestore.rules`**. |
| **Next.js `app/api/*/route.ts`** | Server-only work needing **Firebase Admin**, **Stripe**, **email**, or **must not trust the client** (pricing, capture, refunds, public profile aggregation). |
| **`POST /api/stripe-webhook`** | Stripe-signed events (e.g. `checkout.session.completed`) to create **pending** bookings and conversations **idempotently**. |

### Authentication (not primarily `/api`)

- **Sign in / Sign up:** Google via Firebase Auth. After sign-in, ensure **`users/{uid}`** exists (client-side pattern in `AuthContext` / profile flows).
- **Protected APIs:** `Authorization: Bearer <Firebase ID token>` from `user.getIdToken()`; routes use Admin **`verifyIdToken`** for `uid`.

### User and profile data

| Concern | Mechanism |
| --- | --- |
| **Create / update profile** (name, bio, image, waivers, Stripe fields, etc.) | **Firestore** `users/{uid}` from the client under rules—not a generic `/api/users` REST layer. |
| **Read another member’s public profile** | **`GET /api/public-profiles/[userId]`** — safe fields (display name, bio, image, `isOwner` host flag, review aggregates, **`memberSince`**) plus **`confirmedBookingsCount`** (player, `status === "confirmed"`) and **`listingsCount`** (courts where `ownerId === userId`), computed server-side. |

### Reviews

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| **`/api/reviews`** | `GET` | **None** for public queries; **Bearer** for private | **Public:** `?targetUserId=` or `?courtId=` (court reviews use `targetType === "court_owner"`). **Authenticated:** `?bookingIds=id1,id2` — caller’s submitted reviews for dashboard UI state. |
| **`/api/reviews`** | `POST` | **Bearer** required | Submit **one review per role per booking** (`bookingId`, whole-star `rating`, optional `comment`). Server verifies participant role, booking completed/confirmed and **`isBookingReviewable`** window in `src/lib/bookingDates.ts`, and updates court + user aggregates in a transaction. |

### Messaging and scheduled notifications

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| **`/api/conversations/send-message`** | `POST` | **Bearer** | Save a participant-authored conversation message, update last-message/unread metadata, and email every other participant with the message body. Body: **`conversationId`**, **`body`**. |
| **`/api/notifications/send-scheduled`** | `GET` / `POST` | **Vercel Cron** (`Authorization: Bearer $CRON_SECRET` when configured) | Hourly job from `vercel.json`: expire stale pending bookings and email players, send review reminder emails roughly 1 hour / 2 days / 5 days after eligible bookings when either side has not reviewed, and post a 24-hour check-in reminder message with listing check-in instructions into the booking conversation, which also emails the player. |

### Booking checkout and payment lifecycle (Stripe)

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| **`/api/create-checkout-session`** | `POST` | **Bearer** | Validates slot, conflicts, advance rules, **server-side price** from `courts/{courtId}`; rate-limited; Stripe Checkout with **manual capture** metadata. Body: **`courtId`**, **`date`**, **`time`**, **`durationMinutes`**, optional **`courtNumber`**. |
| **`/api/finalize-checkout-session`** | `POST` | **Bearer** | Client success path: **`sessionId`** verified for caller; **`createBookingFromPaidCheckoutSession`** (idempotent by session; shared with webhook logic); when this path creates the booking first, send the host booking-request email immediately so local/dev flows do not depend on Stripe webhook delivery. |
| **`/api/stripe-webhook`** | `POST` | **Stripe signature** (`stripe-signature` + `STRIPE_WEBHOOK_SECRET`) | e.g. **`checkout.session.completed`**: pending booking, payment metadata, **`expiresAt`**, conversation, host email, conflict handling. |
| **`/api/accept-booking`** | `POST` | **Bearer** (court **host**) | Pending + window; **capture** PaymentIntent; **`confirmed`**; payout / transfer per metadata. |
| **`/api/reject-booking`** | `POST` | **Bearer** (host) | Release uncaptured auth (or refund); **`rejected`**; player email. |
| **`/api/cancel-booking`** | `POST` | **Bearer** (booking **player** or court **host**) | Cancel; confirmed player cancellations require at least 24 hours before court time; host cancellations are allowed for courts they own; release uncaptured authorization or refund captured payment through the shared Stripe helper; write `cancelReason` as `player_cancellation` or `host_cancellation`; send cancellation emails where implemented. |
| **`/api/expire-pending-bookings`** | `POST` | **Bearer** | Body **`bookingIds: string[]`**. For each **pending** booking whose court **`ownerId`** matches token `uid` and whose pending window is expired: mark **`expired`**, update payment fields, **release** authorization. Non-matching ids no-op per booking. |
| **`/api/send-booking-confirmation`** | `POST` | **No auth in route** | Body **`bookingId`** — loads booking/court/users and sends **player confirmation** email; treat as internal/ops-style unless you add verification. |

### Stripe Connect (hosts)

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| **`/api/stripe/create-connect-account`** | `POST` | **Bearer** | Rate-limited; creates/refreshes Connect Express onboarding link; persists mode-specific account ids. Optional body `{ "update": true }`. |
| **`/api/stripe/check-account-status`** | `POST` | **Bearer** | Reads Stripe capabilities/requirements; updates Firestore user Stripe fields; may complete platform-held transfers when Connect becomes ready. |

### Rate limiting

**`app/api/rate-limit.ts`** backs **checkout** and **Connect account creation** imports (`../rate-limit` or `../../rate-limit` from nested route folders). Designed to **fail open** if Upstash (or equivalent) is unavailable so checkout is not hard-blocked.

### Not implemented as REST (Firestore + rules instead)

Use **Firestore queries** (and rules) for: player bookings by `userId`, host reservations via `bookings` joined with `courts` where `ownerId == uid`, conversation reads (`conversations` + `messages` subcollections), **create/edit listings** and Storage uploads. User-authored conversation writes that need paired email should use `POST /api/conversations/send-message`. If you need a strict BFF with no client booking reads, add routes such as **`/api/bookings`**—they are not in the repo today.

### Quick reference — all `app/api/**/route.ts` handlers

1. `POST /api/create-checkout-session`
2. `POST /api/finalize-checkout-session`
3. `POST /api/stripe-webhook`
4. `POST /api/accept-booking`
5. `POST /api/reject-booking`
6. `POST /api/cancel-booking`
7. `POST /api/expire-pending-bookings`
8. `GET /api/public-profiles/[userId]`
9. `GET` + `POST /api/reviews`
10. `POST /api/stripe/create-connect-account`
11. `POST /api/stripe/check-account-status`
12. `POST /api/send-booking-confirmation`
13. `POST /api/conversations/send-message`
14. `GET` + `POST /api/notifications/send-scheduled`

## Security Protections And Considerations

Server API routes verify Firebase ID tokens with Admin Auth before sensitive operations. Checkout intentionally accepts only booking inputs such as `courtId`, `date`, `time`, `durationMinutes`, and `courtNumber`; it fetches court price and owner data server-side, validates duration/date/amount, checks max advance booking rules, blocks past dates, checks blocked slots and existing confirmed or still-actionable pending bookings, rate-limits checkout creation, and creates Stripe Checkout sessions with metadata rather than trusting client-calculated price. The rate limiter should fail open to the local fallback if Upstash is unavailable so transient Upstash failures do not take checkout down.

Auth UI should use Google sign-in as the only account entry point. Login and signup pages can share the same Google popup behavior, should preserve `redirect` query handling, should create missing `users/{uid}` docs, and should avoid overwriting a user's existing `displayName` with Google profile data after they have edited it in CourtShare.

Stripe Checkout uses PaymentIntents with `capture_method: "manual"`. The player authorizes the card during Checkout, but CourtShare does not capture funds until the host accepts the pending request through `/api/accept-booking`. CourtShare charges an 8% service fee on the host rental amount, and hosts currently absorb both that service fee and the estimated Stripe card processing cost; players pay the court rental price only, plus any future taxes. Keep fee math centralized in `src/lib/pricing.ts` so checkout UI, stored booking amounts, owner net amounts, and server-side `application_fee_amount` agree exactly. Prefer destination charges when the host has a ready Stripe Connect account with `charges_enabled`, `payouts_enabled`, and `details_submitted`; if the host has not finished payout setup, checkout should still proceed as a platform-held payment and booking records must store `hostPayoutStatus: "pending_connect_account"` until the host connects. Stripe Connect IDs are mode-specific: local/test-mode flows should use `stripeTestAccountId`, live production flows should use `stripeLiveAccountId` and maintain legacy `stripeAccountId` for live compatibility, and test-mode lookups must not delete a live account ID from a shared Firestore user doc. The accept route verifies host identity, confirms the request is still actionable, captures the PaymentIntent, marks the booking `confirmed`, and either captures the destination charge or transfers the stored `ownerAmountCents` from platform-held funds to the host once a Connect account is active. Rejection, cancellation, expiration, and double-booking race handling should release uncaptured authorizations; if a payment has already been captured, use the shared Stripe helper to refund it. Player cancellations of confirmed bookings must be enforced server-side with the same parsed booking start instant used by the UI (`parseBookingDateTime` / `isBookingCancellable`) so timezone parsing cannot incorrectly block bookings more than 24 hours away. Avoid direct client-side Firestore status flips for acceptance or cancellation because payment capture, release, transfer, and refund behavior must happen server-side. Host dashboard actions and message-thread accept/decline controls must both call `/api/accept-booking` or `/api/reject-booking`; conversation status/last-message metadata can be updated only after the API succeeds.

Payment/refund QA should first use the Stripe sandbox/test-key account that matches the app's configured `sk_test`/`pk_test` keys. Confirm checkout authorization, host acceptance capture, Connect transfer/application fee metadata, and cancellation refunds in the matching Stripe Dashboard's **Transactions → Payments** view; dashboard account context matters, and searching from the wrong sandbox or platform account will show false "not found" results. A tiny live-mode smoke test is useful before launch to validate live keys, webhooks, and Connect account wiring, but successful sandbox capture/refund records are the right day-to-day proof that local payment/refund flows are working.

Stripe webhooks and checkout finalization are responsible for creating pending booking records and booking request conversations. Both paths must be idempotent by `sessionId`, re-check double-booking conflicts before writing, store `paymentStatus: "authorized"`, and attach `expiresAt` 24 hours after creation. Stripe Connect onboarding checks account state before host transfers, and Firebase Admin logs are kept more concise in production to reduce credential leakage risk. The host dashboard should include a payout settings card that opens Stripe Express onboarding or the Express Dashboard, shows whether setup is active/incomplete/restricted, and surfaces requirements/disabled reasons from Stripe when available. Keep secrets in environment variables only, never expose private Stripe or Firebase Admin keys to client code, and keep all privileged writes in API routes or protected Firestore rules.

Client messaging reads and writes depend on Firestore rules allowing only conversation participants to read `conversations/{conversationId}` and its `messages` subcollection, and allowing only participants to create messages with their own `senderId`. If `/messages` shows `Missing or insufficient permissions`, update and publish `firestore.rules` in Firebase Console or through the Firebase CLI before debugging the React page.

Public profile reads should go through `/api/public-profiles/[userId]`, which returns only safe marketplace fields such as display name, bio, profile image, host/player review aggregates, and host status. Use this API from messages, dashboards, court details, and public profile pages instead of relying on broad client-side Firestore reads of `users/{uid}`. Public review display should use `/api/reviews?targetUserId=...` for member profiles and `/api/reviews?courtId=...` for court detail pages; authenticated dashboard review-state checks still use `/api/reviews?bookingIds=...` with the Firebase ID token.

Security gaps to keep in mind: enforce Firestore and Storage rules to match these app-level assumptions, move booking conflict checks into Firestore transactions or a stronger slot-locking model, validate all API payloads with a shared schema library, sanitize uploaded filenames and restrict upload types/sizes, limit profile/listing edits by host identity at the rules layer, and review webhook authorization-release/refund/error paths for operational alerting.

## Transactional Email

Transactional emails are generated in `src/lib/email.ts` and should match CourtShare's restrained green marketplace theme. Avoid decorative emoji/checkmark headings, fake excitement, or casual icon-heavy copy. Use a CourtShare-branded green header with the tennis-ball logo from `${NEXT_PUBLIC_APP_URL}/icon.png` (falling back to `https://courtshare.co/icon.png`), clear booking detail tables, one primary CTA, and precise payment language: new booking request emails should say the player's card is authorized and will only be captured if accepted within 24 hours; confirmation emails should say payment has been captured; declined/cancelled/expired messaging should say the authorization was released or the payment was refunded depending on the actual Stripe outcome. Every in-app user-authored message and system check-in reminder message should have a paired email containing the message body, with reply links back to `/messages?conversationId=...`.

## Improvement Areas

Efficiency improvements should focus on consolidating date/time conversion logic across API routes and UI, reducing repeated Firestore reads for court/user lookups, adding indexes for common queries such as bookings by `courtId/date` and bookings by `userId`, paginating dashboards as data grows, caching static court data where safe, and moving repeated Stripe/Firebase validation into shared server helpers. Security improvements should prioritize transaction-backed booking creation and acceptance, schema validation, stricter Firestore/Storage rules, centralized authorization helpers, better audit logs, and production monitoring for webhook failures, authorization release failures, refund failures, and suspicious checkout attempts.

Product features worth adding next include richer review filtering/sorting, review response flows for hosts, host calendar sync, saved/favorite courts, richer location search, court amenities filters, host payout dashboards, cancellation policy controls, dispute support, in-app notifications, and a stronger host verification flow before accepting paid bookings. See **Frontend — Pages and Navigation** for explicit **TODO** items (search map, profile host card, court map, message-with-request, post-sign-up profile onboarding).
