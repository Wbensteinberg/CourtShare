/**
 * Server-side mock API: when true, `/api/*` route handlers use the in-memory
 * mock store instead of Firebase Admin and Stripe.
 *
 * Use with `NEXT_PUBLIC_USE_MOCK_DATA=true` (see `npm run dev:mock`).
 * Never enable `MOCK_API` in production.
 */
export const isMockApiMode = (): boolean =>
  process.env.NODE_ENV !== "production" &&
  process.env.MOCK_API === "true" &&
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
