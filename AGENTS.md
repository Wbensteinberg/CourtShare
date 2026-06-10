# CourtShare Agent Guide

## Project Purpose

- CourtShare is an Airbnb-style marketplace for renting private tennis courts by the hour, starting with Los Angeles.
- Players search nearby courts, choose date/time, authorize a card through Stripe Checkout, and manage booking requests from `/upcoming`.
- Hosts list private or semi-private courts, define availability, max guests, blocked times, Stripe Connect onboarding, approvals, rejections, cancellations, and revenue from `/host`.
- Payment is authorized at checkout and captured only when the host accepts.
- Authentication is via Google auth only. 

## Product Shape

- Public/search entry: `/search` via the root home experience.
- Player routes:
  - `/upcoming`: upcoming, completed, cancelled/rejected/expired booking requests.
  - `/booking/[bookingId]`: individual booking details, cancellation, messaging, reviews.
  - `/profile`: signed-in user profile editor, past bookings, received player reviews.
  - `/profile/[userId]`: public member profile.
- Host routes:
  - `/host`: host dashboard.
  - `/create-listing`: listing creation.
  - `/edit-listing/[courtId]`: listing edits.
- Shared routes:
  - `/messages`: booking-scoped conversations.
  - `/courts/[id]`: court details and booking checkout.
  - `/sign-in` and `/sign-up`: Google-only auth cards.
  - `/onboarding`: required name/profile setup for brand-new Google users.
- Booking row copy:
  - Player upcoming rows show court name and `Hosted by ...`.
  - Host dashboard booking rows show court name and player name.
  - Booking-scoped message buttons route to `/messages?conversationId=booking_{bookingId}` and use stored `conversationId` when available.
- Mock mode:
  - Client mock mode uses `NEXT_PUBLIC_USE_MOCK_DATA=true` or missing Firebase config in non-production only.
  - Full mock HTTP API uses `npm run dev:mock`, which sets `MOCK_API=true` and `NEXT_PUBLIC_USE_MOCK_DATA=true`.
  - Mock API routes use `Authorization: Bearer mock-id-token`.
  - Production must not use mock API or mock client data. `src/lib/firebase.ts`, `src/lib/mockApiMode.ts`, and `src/lib/courtShareMetadata.ts` explicitly disable mock behavior in production.
  - Browser `localStorage` mock data in `src/lib/mockData.ts` and server mock API data are independent stores.

## Frontend Pages And Navigation

### Header (`src/components/AppHeader.tsx`)

- Unauthenticated:
  - Show Sign In and Sign Up.
  - Both buttons are Google-only entry points.
  - On mobile, show Sign In and Sign Up directly in the header.
  - Hide the hamburger menu for unauthenticated users.
- Authenticated:
  - Show Messages link to `/messages`.
  - Show unread badge count from conversations where `uid` appears in `unreadBy`.
  - Hosts/listing owners also get a Host Dashboard shortcut to `/host`.
  - Profile/avatar menu includes Upcoming Bookings, Messages, Host Dashboard, Profile, and log out.
  - Mobile hamburger dropdown is only for logged-in users.
- Badge styling:
  - Unread Messages badge should use the same dark pill style on transparent and normal headers.
- Become a Host:
  - If the user is not a host/no listing, Host Dashboard entry behaves as Become a Host.
  - Route to Host Dashboard, Your Courts tab, then surface Add Listing flow.

### Home And Search (`/courts`, `/search`)

- `/courts` is the primary public entry and search landing experience.
- Home includes:
  - hero section.
  - search section.
  - featured courts gallery linking to Court Details.
  - unauthenticated "How it works" or equivalent path toward Google signup.
- `/search` includes:
  - search controls.
  - results list on the left.
  - map on the right.
  - result/card click navigates to `/courts/[id]`.
- TODO:
  - Ensure map marker/court click navigates to Court Details everywhere.

### Profile (`/profile`)

- About Me:
  - Editable player profile card.
  - This is the same card owners see for the other party.
- Host profile TODO:
  - If the signed-in user is a host, also show the host-facing profile card players see.
- Past Bookings:
  - sorted most-recent-first.
  - include `completed` bookings.
  - include `confirmed` bookings whose parsed start datetime is in the past.
  - never filter only on `status === "completed"` because the completion cron can lag.
- My Reviews:
  - player reviews from hosts.
  - link to Booking Details.
- Non-host CTA:
  - Become a Host routes toward Host Dashboard Your Courts and `/create-listing`.

### Messages (`/messages`)

- Auth guard:
  - unauthenticated users redirect immediately to `/`.
  - render must gate on `!user`, not only `authLoading`, to avoid stale prior-session data.
- Layout:
  - centered and constrained on wide screens.
  - internal scroll regions for inbox/history.
  - message composer must not sprawl across the page.
- Threads:
  - show dated message history.
  - link/control to other participant public profile.
  - link/control to Booking Details when applicable.
- User-authored messages:
  - must go through `POST /api/conversations/send-message`.
  - must not write directly to Firestore from client code.
- Booking status messages:
  - accepted, declined, and cancelled actions post server-side `booking_status` messages.
  - use stored `conversationId` or fallback `booking_{bookingId}`.
- Host action dialogs:
  - accepting from a message thread shows price breakdown.
  - declining requires a host-written reason.
  - decline reason is sent in thread and rejection email.
- Declined bookings:
  - primary `booking_status` message should avoid embedding payment/authorization wording inside decline-reason lines.
  - if UI exposes `paymentStatus`, surface payment language separately.
  - player rejection emails still include payment block.

### Upcoming Bookings (`/upcoming`)

- Tabs:
  - Upcoming Bookings: confirmed + pending, ascending.
  - Completed: confirmed-past + completed status, descending.
  - Cancelled Requests: cancelled/rejected/expired, descending.
- Completed cards:
  - court image.
  - court name.
  - green Completed badge regardless of raw Firestore status.
  - price.
  - `Hosted by ...`.
  - date/time/duration.
  - Details button.
  - green Review button when `canReviewBooking` is true.
- Completed tab icon:
  - show small emerald badge with pending-review count.
  - hide when count is 0.
- Mobile layout:
  - sidebar hidden with `hidden lg:block`.
  - expandable dropdown replaces sidebar.
  - hide section heading/subtitle on mobile with `hidden lg:block`.

### Host Dashboard (`/host`)

- Tabs and surfaces:
  - Upcoming Reservations: confirmed and pending bookings.
  - Your Courts: owned listings, weekly availability edits, edit listing, add listing.
  - Earnings: earnings chart and Stripe setup/manage payout controls.
  - Reviews: host and per-court review lists.
  - Completed Reservations.
  - Cancelled Requests.
- Upcoming Reservations:
  - show small red pending-count badge when pending requests need attention.
- Completed Reservations cards:
  - use Past visit for `confirmed` rows in completed tab.
  - use Completed for `completed` status.
  - Upcoming rows still use Confirmed for `confirmed`.
  - show Court N pill only when `numberOfCourts > 1`.
  - Court N pill goes on its own row below name/status.
  - do not show separate Reviewed badge after host review.
  - show Review player only while host can still submit.
  - payout amount is `ownerAmountCents`.
  - derive fallback payout through `getBookingFinancials(booking, court)` and `calculateBookingPriceBreakdown`.
  - show small player avatar or initial next to player name.
- Booking action buttons:
  - Accept is solid emerald (`bg-emerald-600 text-white`).
  - Decline is solid red (`bg-red-600 text-white`).
  - Details remains outline.
- Your Courts:
  - Preview Listing label, not View Listing.
  - Preview opens a new tab with `window.open(..., "_blank")`.
- Mobile layout:
  - same dropdown pattern as Upcoming Bookings.
  - hide heading/subtitle on mobile for all six tabs.
- Payout incomplete banner:
  - show only after Stripe account check resolves with confirmed non-active status.
  - do not show during initial null state.
  - do not show when `status === "check_failed"`.
  - check timeout is 15 seconds.

### Add And Edit Listing

- `/create-listing`:
  - full listing fields.
  - Max Guests included.
  - missing/blank max guests defaults to 10.
  - submit requires owner listing waiver acknowledgement.
  - owners can save incomplete listings as drafts without publishing.
  - publishing sets `bookableStatus: "active"` even if Stripe payout setup is incomplete.
  - Stripe setup is still required before host payouts can be transferred.
  - after save/publish, navigate to Host Dashboard Your Courts.
- `/edit-listing/[courtId]`:
  - full edit fields.
  - Max Guests included.
  - legacy/missing/blank max guests defaults to 10.
  - draft listings show Edit Draft / Publish Listing and keep Save Draft available.
  - draft listings can be deleted after confirmation.
  - published listings show Update Listing and can be unlisted back to draft instead of hard-deleted.
  - submit navigates to Host Dashboard Your Courts.

### Booking Details (`/booking/[bookingId]`)

- Status/payment copy follows actual booking state.
- Pending host actions:
  - use app dialogs, never native browser confirms.
  - accept dialog shows player pays, CourtShare fee, card processing, host payout.
  - decline requires host-written reason.
  - pending status visually groups with time-left timer.
- Reviews:
  - show submitted reviews on completed/past bookings.
  - review window is seven days after booking end time through `isBookingReviewable`.
  - allow player to review host/court.
  - allow host to review player.
  - show No Review when window closed without review.
- Review dialog:
  - components: `CourtBookingBookingMode` and `ReviewDialog`.
  - may auto-open when reviewable and viewer has not submitted.
  - load state from `GET /api/reviews?bookingIds=...&withPairedStatus=true` with Bearer token.
  - treat unknown, no review, and already reviewed distinctly.
  - close dialog after successful submit.
  - star controls avoid heavy focus rings.
- Paired review visibility:
  - viewer reviewed + other reviewed: show card.
  - viewer reviewed + other not reviewed: show waiting state.
  - other reviewed + viewer not reviewed: show teaser with CTA.
  - neither reviewed + window open: show Leave a review.
  - window passed: show Review window has passed.
  - never show the other party's review until viewer has also reviewed.
- Cancellation:
  - players can cancel pending requests.
  - confirmed player cancellations require at least 24 hours before parsed start time.
  - hosts can cancel bookings for their own courts.
  - UI must call `/api/cancel-booking`.
  - cancellation emails are fire-and-forget with independent error handling.
- Profiles:
  - player view shows host profile + rating.
  - host view shows player profile + rating.
- Tenure:
  - "X months on CourtShare" clamps to minimum 1 everywhere.
- Message history:
  - scoped to this booking conversation.

### Court Details (`/courts/[id]`)

- Show court info, gallery, rating modal, host profile, and host rating modal.
- Request booking:
  - if player already has a pending request for this court, confirm intentional duplicate request.
  - require waiver before Stripe Checkout.
- Slot selection:
  - block confirmed bookings.
  - block still-actionable pending requests.
  - use `src/lib/bookingConflicts.ts`.
  - cap guest count at `maxGuests`, default 10.
- Availability:
  - fetch from `GET /api/court-availability`.
  - do not revert to direct cross-user client Firestore booking queries.
- TODO:
  - map for court location.
  - optional "send a message with request" flow.

### Sign In, Sign Up, And Onboarding

- Sign In/Sign Up:
  - single card.
  - Continue with Google only.
  - copy differs for sign-in vs sign-up.
  - keep spacing tight between intro copy and Google CTA.
- Deep-link redirect:
  - protected pages redirect unauthenticated users to `/sign-in?redirect=<current-path>`.
  - `AuthPage` reads redirect and sends user there after sign-in.
  - already-authenticated visitors are sent to redirect, not hardcoded `/profile`.
  - onboarding forwards redirect.
- Onboarding:
  - reached automatically for brand-new Google users with no `users/{uid}` doc.
  - pre-fills display name from Google.
  - does not pre-fill Google profile photo.
  - `profileImageUrl` remains `""` unless the user uploads.
  - name is required.
  - profile photo is optional.
  - uploads photo to `users/{uid}/avatar_*`.
  - submits `displayName` and `profileImageUrl` into `users/{uid}`.

## Repo Structure

- `app/`:
  - Next.js App Router pages and API routes.
  - Important pages:
    - `app/page.tsx`
    - `app/courts/[id]/page.tsx`
    - `app/create-listing/page.tsx`
    - `app/edit-listing/[courtId]/page.tsx`
    - `app/onboarding/page.tsx`
    - `app/upcoming/page.tsx`
    - `app/host/page.tsx`
    - `app/messages/page.tsx`
    - `app/profile/page.tsx`
    - `app/profile/[userId]/page.tsx`
    - `app/booking/[bookingId]/page.tsx`
  - `app/api/` contains Stripe, booking, webhook, cancellation, rejection, review, public profile, messaging, notification, and rate-limit routes.
- `src/components/`:
  - shared UI and product components.
  - key components:
    - `AppHeader.tsx`
    - `CourtBookingBookingMode.tsx`
    - `ReviewDialog.tsx`
    - `HeroSection.tsx`
    - `SearchSection.tsx`
    - `CourtCard.tsx`
    - `AddressAutocomplete.tsx`
    - `InlineWeeklyCalendar.tsx`
    - `DayDetailModal.tsx`
    - `WaiverAcknowledgmentDialog.tsx`
  - `src/components/ui/` contains shadcn-style primitives.
- `src/lib/`:
  - shared logic and integrations.
  - key files:
    - `firebase.ts`: client Firebase and mock-mode detection.
    - `firebase-admin.ts`: Admin SDK for API routes.
    - `AuthContext.tsx`: auth/profile state.
    - `mockData.ts`: browser mock data.
    - `mockApiServer.ts`: mock API behavior.
    - `apiSecurity.ts`: auth/origin/rate-limit helpers.
    - `imageUploadValidation.ts`: client upload constraints.
    - `bookingDates.ts`: date parsing, sorting, expiry, reviewability.
    - `bookingConflicts.ts`: overlap checks.
    - `bookingCreation.ts`: checkout session to booking.
    - `bookingConversationCopy.ts`: pure client-safe conversation copy.
    - `conversations.ts`: server-only conversation helpers.
    - `stripeBookingPayments.ts`: auth release/refund helpers.
    - `stripeConnectAccounts.ts`: Stripe mode/account helpers.
    - `pricing.ts`: pricing and payout calculations.
    - `email.ts`: transactional email.
    - `reviewVisibility.ts`: public/paired review visibility.
    - `theme.ts`: TypeScript theme mirror.
- `firestore.rules`:
  - keep aligned with any client reads/writes.
- `next.config.ts`:
  - image remote patterns and security headers.

## Theme, Colors, Fonts, And Style

- Styling entry points:
  - `app/globals.css`
  - `app/theme.css`
- Brand color source of truth:
  - `--brand-logo`: `#00b884`
  - `--brand-green`: `#00b884`
  - `--site-accent`: `#008665`
  - `--site-accent-hover`: `#00785b`
  - soft variants use `color-mix`.
- Tailwind green/emerald/teal inline tokens map back to the accent color.
- Keep `src/lib/theme.ts` aligned with CSS theme values.
- Fonts:
  - `app/layout.tsx` loads `Geist` and `Geist_Mono`.
  - global fallbacks include system UI, Segoe UI, Roboto, Inter, and related sans-serif fonts.
- Visual style:
  - clean marketplace SaaS.
  - white surfaces.
  - subtle gray borders.
  - restrained shadows.
  - green accent CTAs.
  - major rectangular sections often use `rounded-[32px]`.
  - smaller controls use `rounded-xl` where appropriate.
- Header avatar:
  - prefer `users/{uid}.profileImageUrl`.
  - fallback to Firebase `user.photoURL`.
  - fallback to initial/avatar state.
  - do not use text-only desktop Profile button when an avatar state is available.

## Database Schemas

### `users/{uid}`

- Identity/profile fields:
  - `uid`
  - `email`
  - `displayName`
  - `bio`
  - `profileImageUrl`
  - legacy `isOwner`
- Review aggregates:
  - `playerRating`
  - `playerReviewCount`
  - `ownerRating`
  - `ownerReviewCount`
- Stripe fields:
  - `stripeAccountId`
  - `stripeLiveAccountId`
  - `stripeTestAccountId`
  - `stripeAccountMode`
  - `stripeAccountStatus`
  - `stripeChargesEnabled`
  - `stripePayoutsEnabled`
  - `stripeDetailsSubmitted`
  - requirements/disabled-reason data from account-status routes.
- Waiver fields:
  - `ownerListingWaiverVersionAccepted`
  - `ownerListingWaiverAcceptedAt`
  - `playerBookingWaiverVersionAccepted`
  - `playerBookingWaiverAcceptedAt`
- Rules:
  - user-facing copy should say host.
  - legacy Firestore field names may still use owner terminology.
  - display name is required for trustworthy marketplace identity.
  - blank names should route users to `/profile`.
  - profile saves must reject blank names.
  - profile name changes must propagate into existing conversation participant fields.

### `courts/{courtId}`

- Listing fields:
  - `name`
  - `location`
  - `address`
  - `accessInstructions`
  - `price` as dollars per hour
  - `description`
  - `imageUrl`
  - `imageUrls`
  - `ownerId`
  - optional `latitude`
  - optional `longitude`
  - `numberOfCourts`
  - `maxGuests`, default 10
  - `maxAdvanceBookingDays`
  - `surface`
  - `indoor`
  - `amenities`
  - `rating`
  - `reviewCount`
  - `createdAt`
- Availability fields:
  - `blockedDates`
  - date-specific `blockedTimes`
  - global `alwaysBlockedTimes`
  - `alwaysBlockedTimesByDay`
  - `courtSpecificAlwaysBlockedTimes`
  - `courtSpecificAlwaysBlockedTimesByDay`
- Bookability fields:
  - `bookableStatus`
  - `ownerStripeAccountStatus`
  - `ownerStripeMode`
- Images:
  - upload to Firebase Storage under `courts/{uid}/...` when not in mock mode.

### `bookings/{bookingId}`

- Core fields:
  - `courtId`
  - `userId`
  - `date`
  - `time`
  - `courtNumber`
  - `duration`
  - `durationMinutes`
  - `guestCount`
  - `status`: `pending`, `confirmed`, `completed`, `cancelled`, `rejected`, or `expired`.
- Status/payment fields:
  - `cancelReason`
  - `declineReason`
  - `createdAt`
  - `expiresAt`
  - `expiredAt`
  - `confirmedAt`
  - `capturedAt`
  - `sessionId`
  - `paymentIntentId`
  - `paymentStatus`
  - `refundId`
  - `totalAmountCents`
  - `expectedAmountCents`
  - `ownerAmountCents`
  - `courtShareFeeCents`
  - `processingFeeCents`
  - `conversationId`
- Notification bookkeeping:
  - `checkInReminderSentAt`
  - `playerReviewReminderCount`
  - `playerReviewReminderLastSentAt`
  - `ownerReviewReminderCount`
  - `ownerReviewReminderLastSentAt`
- Pending requests:
  - actionable for 24 hours.
  - expired pending requests should be hidden from pending counts/lists.
  - expired pending requests should not block future checkout attempts.
- Display:
  - if court is deleted or unreadable, show `Court unavailable`, never raw `courtId`.
- Cancellation reasons:
  - stored as internal codes such as `host_cancellation`.
  - display through `formatBookingCancelReason`.

### `conversations/{conversationId}`

- Fields:
  - `participantIds`
  - `playerId`
  - `playerName`
  - `ownerId`
  - `ownerName`
  - `courtId`
  - `courtName`
  - `bookingId`
  - `bookingDate`
  - `bookingTime`
  - `bookingDurationMinutes`
  - `bookingCourtNumber`
  - `status`
  - last-message metadata
  - `unreadBy`
  - timestamps.
- Booking request conversations use deterministic IDs like `booking_{bookingId}`.
- Messages live in `conversations/{conversationId}/messages/{messageId}`.
- Conversation creation must be idempotent because webhooks and checkout finalization can retry.
- Keep `unreadBy` accurate for the header badge.
- Do not display raw Firebase UIDs in messaging or dashboard UI.
- Use profile display names, then email prefixes, then generic labels such as `Player` or `Court host`.

### `reviews/{bookingId}_{reviewerRole}`

- One review per booking participant role.
- Fields:
  - `bookingId`
  - `courtId`
  - `playerId`
  - `ownerId`
  - `reviewerId`
  - `reviewerRole`: `player` or legacy `owner`
  - `revieweeId`
  - `targetType`: `court_owner` or `player`
  - whole-star `rating` from 1 to 5
  - `comment`
  - `createdAt`
  - `updatedAt`
- Player reviews update:
  - `courts/{courtId}.rating`
  - `courts/{courtId}.reviewCount`
  - host `ownerRating`
  - host `ownerReviewCount`
- Host reviews update:
  - player `playerRating`
  - player `playerReviewCount`
- Reviews are available for one week after booking end instant.
- Public profile and court review visibility is centralized in `src/lib/reviewVisibility.ts`.

## Backend API Reference

### Layers

| Layer | Responsibility |
| --- | --- |
| Firebase Authentication | Google-only sign-in and ID tokens. |
| Firestore + Storage | Client reads/writes governed by rules. |
| Next.js `app/api/*` | Server-only Firebase Admin, Stripe, email, pricing, payment state, public aggregation. |
| `POST /api/stripe-webhook` | Stripe-signed booking creation, idempotency, conversation creation. |

### API Routes

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/create-checkout-session` | POST | Bearer | Validate slot, guest cap, active listing status, server-side price, and create a manual-capture Stripe Checkout session. Uses destination charges when host Connect is active, otherwise platform-held payment until payout setup completes. |
| `/api/finalize-checkout-session` | POST | Bearer | Verify session belongs to caller, idempotently create pending booking, send host request email when this path creates first. |
| `/api/stripe-webhook` | POST | Stripe signature | Idempotent Stripe event processing, pending bookings, conversations, emails. |
| `/api/accept-booking` | POST | Bearer host | Verify host, pending/actionable state, capture PaymentIntent, confirm booking, post status message, send confirmation. |
| `/api/reject-booking` | POST | Bearer host | Verify host, require decline reason, release/refund payment, reject booking, post status message, send rejection. |
| `/api/cancel-booking` | POST | Bearer participant | Verify player or host, enforce 24-hour confirmed player cancellation cutoff, release/refund payment, post status message, send emails. |
| `/api/expire-pending-bookings` | POST | Bearer host | Expire only caller-owned stale pending booking IDs, release authorization, send expiration emails. |
| `/api/public-profiles/[userId]` | GET | Public, rate-limited | Return safe public profile fields and server-computed counts. |
| `/api/reviews` | GET | Public or Bearer | Public target/court reviews; authenticated booking review state with paired status. |
| `/api/reviews` | POST | Bearer | Submit one review per role per booking; transactionally update aggregates. |
| `/api/conversations/send-message` | POST | Bearer participant | Save message, update unread/last-message state, email other participants. |
| `/api/court-availability` | GET | Bearer | Return minimal booking slot projection for conflict checks. |
| `/api/stripe/create-connect-account` | POST | Bearer | Rate-limited Connect account/link creation or dashboard link. |
| `/api/stripe/check-account-status` | POST | Bearer | Fetch Stripe account status, update user and owned court Stripe status fields, and attempt pending platform-held host transfers when payout setup becomes active. |
| `/api/send-booking-confirmation` | POST | Bearer participant | Send player confirmation email for a participant's booking. |
| `/api/notifications/send-scheduled` | GET/POST | Cron secret | Expire stale pending bookings, send check-in reminders, send review reminders. |

### Firestore-Backed Flows

- Use Firestore plus rules for:
  - player booking lists by `userId`.
  - host reservations joined from owned courts.
  - conversation reads.
  - create/edit listing writes.
  - Storage uploads.
- Use API routes for:
  - pricing.
  - payment capture/release/refund.
  - public profile aggregation.
  - review creation.
  - email-sending message writes.
  - cross-user booking availability reads.

## Transactional Email

- Email generation lives in `src/lib/email.ts`.
- Tone/style:
  - restrained green marketplace theme.
  - no decorative emoji/checkmark headings.
  - no fake excitement or casual icon-heavy copy.
  - clear booking detail tables.
  - one primary CTA.
- Branding:
  - use CourtShare green.
  - use tennis-ball logo from `${NEXT_PUBLIC_APP_URL}/icon.png`, fallback `https://courtshare.co/icon.png`.
- Payment language:
  - request emails: card is authorized and charged only if accepted within 24 hours.
  - confirmation emails: payment captured/complete.
  - declined/cancelled/expired emails: authorization released or payment refunded based on actual Stripe result.
- Host request emails:
  - include player/request/court/payment sections.
  - deep-link to `/messages?conversationId=...`.
  - host can accept, decline, or reply in context.
- Message emails:
  - every user-authored in-app message should have a paired email with message body.
  - check-in reminder messages should also email the player.
- Avoid duplicate emails:
  - accept/reject/cancel routes own transactional booking emails.
  - automated `booking_status` conversation messages should not trigger duplicate message emails unless intentionally adding that path.

## Verification Commands

- TypeScript:
  - `npx tsc --noEmit`
- Production build:
  - `npm run build`
- Tests:
  - `npm test -- --runInBand`
- Dependency audit:
  - `npm audit --audit-level=moderate`
  - use `npm audit fix` for non-breaking updates.
  - avoid `npm audit fix --force` unless intentionally doing breaking dependency upgrades.

## Known Verification Notes

- `npm run build` passes after the current security implementation.
- `npx tsc --noEmit` passes after clearing stale `.next` generated types.
- `npm test -- --runInBand` currently has pre-existing failures unrelated to the security implementation:
  - test mocks for `next/navigation` omit `usePathname`, which `AppHeader` now uses.
  - an email copy test expects old wording.
- `npm audit fix` reduced dependency findings but remaining issues need intentional Firebase/Firebase Admin/Next upgrades.

## Improvement Areas

- Security:
  - add Cloud Scheduler daily exports to a locked-down GCS bucket for retention beyond the 7-day PITR window — recommended before reaching meaningful transaction volume or if compliance retention is required (see `docs/SECURITY.md` Backups And Retention section for setup steps).
  - two moderate `npm audit` findings remain in `firebase-admin` and `next` transitive deps — both packages are already at their latest published versions so there is nothing to upgrade; re-run `npm audit` after each new release from Google/Vercel.
- Performance:
  - consolidate date/time conversion logic.
  - reduce repeated Firestore reads for user/court joins.
  - add indexes for common booking queries.
  - paginate dashboards as data grows.
  - cache static court data where safe.
- Product:
  - richer review filtering/sorting.
  - review responses for hosts.
  - host calendar sync.
  - saved/favorite courts.
  - richer location search.
  - court amenity filters.
  - host payout dashboards.
  - cancellation policy controls.
  - dispute support.
  - in-app notifications.
  - stronger host verification before accepting paid bookings.

## Security

Full security policies are in [`docs/SECURITY.md`](docs/SECURITY.md). Read that file before touching any auth, payment, API route, Firestore rules, CSP, or secrets-related code.

### Non-Negotiable Rules

- **Auth**: use `requireFirebaseUser` from `src/lib/apiSecurity.ts` on every authenticated route — never call `adminAuth.verifyIdToken` directly.
- **Mutations**: call `validateMutationOrigin` before any mutation work on every browser-initiated route.
- **Rate limiting**: call `enforceRateLimit` on every public and mutation route. See `docs/SECURITY.md` for the full list of covered routes.
- **Payments**: never trust client-submitted price, fee, payout, owner ID, or payment state — always fetch server-side.
- **Firestore rules**: `firestore.rules` is a security boundary — keep it in sync with any new client queries. Deploy with `npm run deploy:rules` after confirming the active project with `firebase use`.
- **CSP**: nonce-based per-request via `middleware.ts`. Do not add `'unsafe-inline'` back to `script-src`. Do not expose the nonce in DOM attributes.
- **User content**: never render user-authored content (bio, messages, reviews, descriptions) as HTML.
- **Secrets**: never put secrets in `NEXT_PUBLIC_*` vars, git, or client bundles. Rotate anything that was committed or shared.
- **Client components**: must not import `src/lib/conversations.ts` — it pulls Firebase Admin into client bundles.
