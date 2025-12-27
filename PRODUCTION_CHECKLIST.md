# Production Launch Checklist

## Before Moving to Production

### 1. Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Make sure these are set for **Production** environment:

#### Firebase (Client)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

#### Firebase Admin (Server-side)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

#### Stripe
- `STRIPE_SECRET_KEY` (use production key, not test key)
- `STRIPE_WEBHOOK_SECRET` (production webhook secret)

#### Resend
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (your verified domain email, e.g., `CourtShare <notifications@yourdomain.com>`)
- `NEXT_PUBLIC_APP_URL` (your production URL, e.g., `https://courtshare.app`)

### 2. Resend Domain Verification

**Critical for emails to work!**

1. Go to https://resend.com/domains
2. Add and verify your domain
3. Update `RESEND_FROM_EMAIL` in Vercel to use your verified domain

### 3. Stripe Production Setup

1. Switch to **Production** mode in Stripe Dashboard
2. Get your **production** API keys (not test keys)
3. Set up webhook endpoint:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-production-url.vercel.app/api/stripe-webhook`
   - Select event: `checkout.session.completed`
   - Copy the webhook signing secret
   - Add to Vercel as `STRIPE_WEBHOOK_SECRET`

### 4. Firebase Security Rules

Make sure your Firestore security rules are production-ready:
- Users can only read/write their own data
- Bookings are properly secured
- Court listings have appropriate permissions

### 5. Test Everything

Before going live, test:
- [ ] User signup/login
- [ ] Creating a court listing
- [ ] Making a booking (with real Stripe test card)
- [ ] Webhook processing
- [ ] Email notifications (owner and player)
- [ ] Owner accepting/rejecting bookings
- [ ] Player dashboard showing bookings

### 6. Domain & SSL

- Make sure your custom domain is connected in Vercel
- SSL certificate should be automatic
- Test that your domain loads correctly

### 7. Monitoring

Set up:
- Vercel Analytics (optional)
- Error tracking (Sentry, etc. - optional)
- Monitor Stripe webhook events
- Monitor Resend email delivery

## Moving to Production

### Option 1: Merge Preview Branch to Main

1. Make sure all environment variables are set in Vercel for **Production**
2. Merge your preview branch to `main`
3. Vercel will automatically deploy to production
4. Test the production deployment

### Option 2: Deploy Preview Branch to Production

1. In Vercel Dashboard, go to your preview deployment
2. Click "Promote to Production"
3. This will deploy the preview branch to production

## After Launch

1. Monitor the first few bookings closely
2. Check Vercel logs for any errors
3. Check Stripe dashboard for successful payments
4. Check Resend dashboard for email delivery
5. Test the full flow as a real user

## Rollback Plan

If something goes wrong:
1. In Vercel, you can revert to a previous deployment
2. Or quickly fix and redeploy

---

**Recommendation:** Test thoroughly on preview first, then move to production when you're confident everything works!

