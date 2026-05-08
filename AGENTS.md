# CourtShare Agent Guide

## Project Purpose

CourtShare is an Airbnb-style marketplace for tennis courts, starting with Los Angeles. Players search for nearby courts, pick a date and time, pay through Stripe, and manage bookings from a player dashboard. Court owners list private or semi-private courts, define availability and blocked times, approve or reject booking requests, manage Stripe Connect onboarding, and track revenue from an owner dashboard.

## Product Shape

The landing/search experience lives at `/courts` and is the primary public entry point. Authenticated players use `/dashboard/player`, court owners use `/dashboard/owner`, profiles live at `/profile`, listing creation is at `/create-listing`, listing edits are at `/edit-listing/[courtId]`, court details and booking checkout start at `/courts/[id]`, and individual booking details live at `/booking/[bookingId]`. The app supports a mock mode through `NEXT_PUBLIC_USE_MOCK_DATA` or missing Firebase config, which makes local development possible without Firebase or Stripe.

## Repo Structure

`app/` contains the Next.js App Router pages and API routes. The main pages are `app/courts/page.tsx` for the landing/search page, `app/courts/[id]/page.tsx` for court details and booking selection, `app/create-listing/page.tsx` for owner listing creation, `app/dashboard/player/page.tsx` and `app/dashboard/owner/page.tsx` for dashboards, `app/profile/page.tsx` for user profile and logout behavior, and `app/booking/[bookingId]/page.tsx` for booking detail/cancel flows. `app/api/` contains server-side Stripe, booking, cancellation, rejection, webhook, email, and rate-limit routes.

`src/components/` contains shared UI and product components. `AppHeader.tsx` is the current shared header, `HeroSection.tsx` and `SearchSection.tsx` power the landing search experience, `CourtCard.tsx` renders court results, `AddressAutocomplete.tsx` handles address/location inputs, `InlineWeeklyCalendar.tsx`, `CourtCalendar.tsx`, and `DayDetailModal.tsx` support availability selection, and `WaiverAcknowledgmentDialog.tsx` handles legal acknowledgement flows. `src/components/ui/` contains shadcn-style primitives such as `Button`, `Card`, `Input`, `Dialog`, `Badge`, and related controls.

`src/lib/` contains shared logic and integrations. `firebase.ts` initializes client Firebase and mock-mode detection, `firebase-admin.ts` initializes Admin SDK for API routes, `AuthContext.tsx` provides auth/profile state, `mockData.ts` stores seeded local mock users/courts/bookings, `bookingDates.ts` centralizes booking date parsing/filtering/sorting, `geolocation.ts` contains location helpers, `waivers.ts` contains waiver versions/content, `email.ts` sends transactional email, `theme.ts` mirrors key theme colors for TypeScript, and `utils.ts` contains generic utility helpers.

## Theme, Colors, Fonts, And Style

Global styling starts in `app/globals.css`, which imports `app/theme.css`. The theme system should be the source of truth for brand colors: `--brand-logo` and `--brand-green` are `#00b884`, `--site-accent` is `#008665`, `--site-accent-hover` is `#00785b`, soft/muted variants are computed with `color-mix`, and Tailwind inline tokens map green/emerald/teal utilities back to the accent color. The TypeScript mirror in `src/lib/theme.ts` should stay aligned when color values change.

Fonts come from `app/layout.tsx` using `Geist` and `Geist_Mono`, with global fallbacks in `app/globals.css` to system UI, Segoe UI, Roboto, Inter, and related sans-serif fonts. The visual style is clean marketplace SaaS: white surfaces, subtle gray borders, restrained shadows, green accent CTAs, large rounded cards currently standardized around `rounded-[32px]` for major rectangular sections, smaller `rounded-xl` controls where appropriate, and a tennis-focused green brand identity. Prefer theme variables or Tailwind theme tokens over hardcoded green values.

## Database Schemas

Firestore `users/{uid}` stores profile and account state: `uid`, `email`, `displayName`, `bio`, `profileImageUrl`, `isOwner`, optional Stripe fields such as `stripeAccountId`, `stripeAccountStatus`, `stripeChargesEnabled`, `stripePayoutsEnabled`, `stripeDetailsSubmitted`, and waiver fields such as `ownerListingWaiverVersionAccepted`, `ownerListingWaiverAcceptedAt`, `playerBookingWaiverVersionAccepted`, and `playerBookingWaiverAcceptedAt`.

Firestore `courts/{courtId}` stores court listings: `name`, `location`, `address`, `accessInstructions`, `price` as dollars per hour, `description`, `imageUrl`, `imageUrls`, `ownerId`, optional `latitude` and `longitude`, `numberOfCourts`, `maxAdvanceBookingDays`, `blockedDates`, date-specific `blockedTimes`, global `alwaysBlockedTimes`, `alwaysBlockedTimesByDay`, multi-court `courtSpecificAlwaysBlockedTimes`, `courtSpecificAlwaysBlockedTimesByDay`, `surface`, `indoor`, `amenities`, `rating`, `reviewCount`, and `createdAt`. Images are uploaded to Firebase Storage under `courts/...` when not in mock mode.

Firestore `bookings/{bookingId}` stores booking requests created after Stripe payment confirmation: `courtId`, `userId`, `date`, `time`, `courtNumber`, `duration` in hours for backward compatibility, `durationMinutes`, `status` such as `pending`, `confirmed`, `rejected`, or `cancelled`, `createdAt`, `sessionId`, `paymentStatus`, `totalAmountCents`, and `expectedAmountCents`. Mock mode stores equivalent `MockUserProfile`, `MockCourt`, and `MockBooking` shapes in browser storage through `src/lib/mockData.ts`.

## Security Protections And Considerations

Server API routes verify Firebase ID tokens with Admin Auth before sensitive operations. Checkout intentionally accepts only booking inputs such as `courtId`, `date`, `time`, `durationMinutes`, and `courtNumber`; it fetches court price and owner data server-side, validates duration/date/amount, checks max advance booking rules, blocks past dates, checks blocked slots and existing pending/confirmed bookings, rate-limits checkout creation, and creates Stripe Checkout sessions with metadata rather than trusting client-calculated price. Stripe webhooks are the authority for creating paid bookings, include idempotency checks by `sessionId`, re-check double booking conflicts before writing, and attempt refunds if a race is detected.

Cancellation and rejection routes verify authentication and ownership/authorization before updating bookings or issuing refunds. Stripe Connect onboarding checks account state before owner transfers, and Firebase Admin logs are kept more concise in production to reduce credential leakage risk. Keep secrets in environment variables only, never expose private Stripe or Firebase Admin keys to client code, and keep all privileged writes in API routes or protected Firestore rules.

Security gaps to keep in mind: enforce Firestore and Storage rules to match these app-level assumptions, move booking conflict checks into Firestore transactions or a stronger slot-locking model, validate all API payloads with a shared schema library, sanitize uploaded filenames and restrict upload types/sizes, limit profile/listing edits by owner identity at the rules layer, and review webhook refund/error paths for operational alerting.

## Improvement Areas

Efficiency improvements should focus on consolidating date/time conversion logic across API routes and UI, reducing repeated Firestore reads for court/user lookups, adding indexes for common queries such as bookings by `courtId/date` and bookings by `userId`, paginating dashboards as data grows, caching static court data where safe, and moving repeated Stripe/Firebase validation into shared server helpers. Security improvements should prioritize transaction-backed booking creation, schema validation, stricter Firestore/Storage rules, centralized authorization helpers, better audit logs, and production monitoring for webhook failures, refund failures, and suspicious checkout attempts.

Product features worth adding next include player and owner reviews, ratings with written feedback, messaging between players and owners before and after booking, owner calendar sync, saved/favorite courts, richer location search, court amenities filters, owner payout dashboards, cancellation policy controls, dispute support, in-app notifications, and a stronger owner verification flow before accepting paid bookings.
