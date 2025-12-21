# CourtShare Beta Launch Checklist

## 🔴 CRITICAL (Must Fix Before Launch)

### 1. ✅ Booking Status Confirmation
- **Status:** FIXED
- **Issue:** Webhook was setting status to "pending" instead of "confirmed"
- **Fix:** Updated webhook to set status to "confirmed" after successful payment

### 2. ⚠️ Stripe Webhook Configuration
- **Status:** NEEDS VERIFICATION
- **Action Required:**
  1. Go to Stripe Dashboard → Developers → Webhooks
  2. Add endpoint: `https://your-vercel-domain.vercel.app/api/stripe-webhook`
  3. Select event: `checkout.session.completed`
  4. Copy the webhook signing secret to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
  5. Test the webhook using Stripe CLI or test mode

### 3. ⚠️ Time Slot Conflict Detection
- **Status:** NEEDS IMPROVEMENT
- **Current Issue:** Only checks exact time match, not duration overlap
- **Example Problem:** 
  - Booking 1: 2:00 PM for 2 hours (ends at 4:00 PM)
  - Booking 2: 3:00 PM for 1 hour (ends at 4:00 PM)
  - Currently: No conflict detected ❌
  - Should: Detect conflict ✅
- **Fix Needed:** Update conflict checking logic in `app/courts/[id]/page.tsx` to check time ranges

### 4. ⚠️ Email Notifications
- **Status:** NOT IMPLEMENTED
- **Needed:**
  - Booking confirmation email to player
  - Booking notification email to court owner
  - Booking reminder email (24 hours before)
- **Options:**
  - Firebase Functions + SendGrid/Resend
  - Or use a service like Postmark, Mailgun
  - Or use Firebase Extensions for email

## 🟡 IMPORTANT (Should Fix Soon)

### 5. Refund Handling
- **Status:** NOT IMPLEMENTED
- **Issue:** Cancellations don't process Stripe refunds
- **Fix Needed:** Add Stripe refund API call when booking is cancelled
- **Location:** `app/booking/[bookingId]/page.tsx` and `app/dashboard/player/page.tsx`

### 6. Input Validation
- **Status:** PARTIAL
- **Needed:**
  - Validate date is not in the past
  - Validate time slot is available
  - Validate price is positive number
  - Validate duration is reasonable (e.g., 1-6 hours)

### 7. Owner Booking Management
- **Status:** PARTIAL
- **Current:** Owners can view bookings
- **Needed:** 
  - Owners can confirm/reject bookings
  - Owners can cancel bookings (with refund)
  - Owners can mark bookings as completed

### 8. Error Handling
- **Status:** NEEDS IMPROVEMENT
- **Issue:** Using `alert()` for errors (not user-friendly)
- **Fix:** Replace with toast notifications or inline error messages

### 9. Environment Variables Documentation
- **Status:** NOT DOCUMENTED
- **Action:** Create `.env.example` file with all required variables

## 🟢 NICE TO HAVE

### 10. Booking Reminders
- Email/SMS reminders 24 hours before booking

### 11. Analytics Dashboard
- Track bookings, revenue, popular times
- Court performance metrics

### 12. Legal Pages
- Terms of Service
- Privacy Policy
- Refund Policy

## 📋 Pre-Launch Testing Checklist

### Payment Flow
- [ ] Test booking with Stripe test card: `4242 4242 4242 4242`
- [ ] Verify webhook creates booking in Firestore
- [ ] Verify booking status is "confirmed" after payment
- [ ] Test payment cancellation flow
- [ ] Test with different durations (1, 1.5, 2, 2.5, 3 hours)

### Booking Conflicts
- [ ] Test booking same time slot twice (should fail)
- [ ] Test booking overlapping time slots (should fail)
- [ ] Test booking non-overlapping slots (should succeed)

### User Flows
- [ ] Sign up new user
- [ ] Create court listing as owner
- [ ] Book court as player
- [ ] View booking in player dashboard
- [ ] View booking in owner dashboard
- [ ] Cancel booking
- [ ] Edit court listing

### Mobile Testing
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test responsive design at different screen sizes
- [ ] Test touch interactions

### Environment Setup
- [ ] All Firebase env vars set in Vercel
- [ ] All Stripe env vars set in Vercel
- [ ] Stripe webhook endpoint configured
- [ ] Google Maps API key configured (if using maps)

## 🚀 Launch Day Checklist

1. **Final Testing**
   - [ ] Run through complete booking flow end-to-end
   - [ ] Test with real Stripe account (use small test amount)
   - [ ] Verify all environment variables are set

2. **Monitoring Setup**
   - [ ] Set up error tracking (Sentry, LogRocket, etc.)
   - [ ] Monitor Stripe webhook logs
   - [ ] Monitor Firebase console for errors

3. **Backup Plan**
   - [ ] Have manual booking process ready (spreadsheet/email)
   - [ ] Know how to manually process refunds in Stripe
   - [ ] Have contact info for support

4. **Communication**
   - [ ] Prepare user instructions/onboarding
   - [ ] Set up support email/channel
   - [ ] Prepare FAQ for common issues

## 📝 Notes

- Start with a small group of beta testers
- Monitor closely for the first week
- Collect feedback and iterate quickly
- Consider adding a feedback form in the app

