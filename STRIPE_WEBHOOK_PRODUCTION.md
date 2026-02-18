# Stripe Webhook – Production Checklist (courtshare.co)

Use this when bookings work locally with Stripe CLI but not in production.

## 1. Stripe Dashboard – Production webhook endpoint

- Go to **Stripe Dashboard** → **Developers** → **Webhooks**.
- Ensure you’re in the correct mode (e.g. **Test** if you use test keys on production).
- Find the endpoint: `https://courtshare.co/api/stripe-webhook`.
- Click it and check:
  - **Events to send**: include `checkout.session.completed`.
  - **Signing secret**: click “Reveal” and copy the value (starts with `whsec_`). You’ll use this in step 3.
- Open **Recent deliveries** and make a test booking on production:
  - If you see attempts with **4xx/5xx** or “Signature verification failed”, the secret or env is wrong (see step 3).
  - If there are no attempts, Stripe isn’t calling your URL (see step 2).

## 2. URL and app

- Endpoint URL must be exactly: `https://courtshare.co/api/stripe-webhook` (no trailing slash, correct domain).
- Redeploy after changing env vars so the new `STRIPE_WEBHOOK_SECRET` is used.

## 3. Vercel environment variable (most common fix)

- Name must be exactly: **`STRIPE_WEBHOOK_SECRET`** (all caps).  
  If you used `stripe_webhook_secret` or anything else, the code won’t see it.
- Value = the **Signing secret** from the **production** webhook (step 1), not the CLI secret.
- No extra spaces, newlines, or quotes in the value.
- Set it for **Production** (and optionally Preview if you test there).
- After saving: **Redeploy** the project (or trigger a new deployment) so the new value is loaded.

## 4. Other production env vars

Confirm these are set in Vercel for Production:

- `STRIPE_SECRET_KEY` (e.g. `sk_test_...` or `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` (from step 1)
- Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

If Firebase Admin isn’t initialized in production, the webhook may verify the signature then fail when writing the booking.

## 5. Emails not sending in production

If bookings show up but no one gets emails (owner “New Booking Request” or player “Booking Confirmed” after accept):

- **`RESEND_API_KEY`** must be set in Vercel (same value as in `.env.local`). If it’s missing, the code logs `[EMAIL] RESEND_API_KEY not configured, skipping email` and never sends.
- **`RESEND_FROM_EMAIL`** (optional but recommended for production): e.g. `CourtShare <notifications@courtshare.co>`. Add and verify the domain in [Resend → Domains](https://resend.com/domains), then set this in Vercel. Without it, sending uses `onboarding@resend.dev`, which can only send to your Resend account email on the free tier.
- After adding or changing these in Vercel, redeploy so the webhook/API routes use the new env.

Check Vercel function logs for `/api/stripe-webhook` (and `/api/send-booking-confirmation` when owner accepts) for `[EMAIL]` lines to see whether the send was skipped or failed.

## 6. Check logs

- **Stripe**: Developers → Webhooks → [your endpoint] → **Recent deliveries** → click a request to see response code and body.
- **Vercel**: Project → **Logs** or **Deployments** → select deployment → **Functions** → open logs for `/api/stripe-webhook` to see “Missing Stripe signature or webhook secret” or “Webhook signature verification failed” if something is wrong.

## Quick fix to try first

1. In Stripe, open the endpoint `https://courtshare.co/api/stripe-webhook` and copy the **Signing secret**.
2. In Vercel, set **`STRIPE_WEBHOOK_SECRET`** (all caps) to that value, no extra spaces.
3. Redeploy the project.
4. Make a test booking on https://courtshare.co and check Stripe “Recent deliveries” and Vercel logs.
