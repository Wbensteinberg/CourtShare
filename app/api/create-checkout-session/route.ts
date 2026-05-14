import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { calculateBookingPriceBreakdown } from "@/lib/pricing";
import { isBookingBlockingSlot } from "@/lib/bookingConflicts";
import {
  getStripeAccountIdForMode,
  getStripeMode,
} from "@/lib/stripeConnectAccounts";
import { checkRateLimit } from "../rate-limit";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockCreateCheckoutSessionPOST } from "@/lib/mockApiServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  console.log("[CHECKOUT] Request received");

  if (isMockApiMode()) {
    return mockCreateCheckoutSessionPOST(req);
  }

  // Check for required environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[CHECKOUT] STRIPE_SECRET_KEY not set");
    return NextResponse.json(
      { error: "Server configuration error: Stripe key missing" },
      { status: 500 }
    );
  }

  // SECURITY: Rate limiting to prevent card testing attacks
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitResult = await checkRateLimit(
    `${ip}-${req.headers.get("user-agent")}`
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000
          ).toString(),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      }
    );
  }

  // SECURITY FIX 2: Verify Firebase ID token instead of accepting userId from client
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const idToken = authHeader.split("Bearer ")[1];
  let userId: string;

  try {
    if (!adminAuth) {
      // Log detailed diagnostics
      const envCheck = {
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        VERCEL: !!process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      };
      console.error(
        "[CHECKOUT] Firebase Admin Auth not initialized. Diagnostics:",
        JSON.stringify(envCheck, null, 2)
      );
      console.error(
        "[CHECKOUT] adminDb is:",
        adminDb ? "initialized" : "undefined"
      );
      console.error(
        "[CHECKOUT] adminAuth is:",
        adminAuth ? "initialized" : "undefined"
      );

      return NextResponse.json(
        {
          error:
            "Server configuration error: Authentication service not initialized",
          details:
            "Firebase Admin SDK requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables. Check Vercel function logs for detailed diagnostics.",
          diagnostics: envCheck,
        },
        { status: 500 }
      );
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    userId = decodedToken.uid;
    console.log("[CHECKOUT] User authenticated:", userId);
  } catch (err: any) {
    console.error("[CHECKOUT] Error verifying ID token:", err.message);
    return NextResponse.json(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  // SECURITY FIX 1: Only accept courtId, date, time, and durationMinutes from client
  // DO NOT accept price - fetch from court document
  const {
    courtId,
    date,
    time,
    durationMinutes,
    courtNumber,
    guestCount,
    initialMessage,
  } = await req.json();

  try {
    // SECURITY: Validate all inputs
    if (!courtId || !date || !time || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if adminDb is initialized
    if (!adminDb) {
      console.error(
        "[CHECKOUT] Firebase Admin DB not initialized. Check environment variables."
      );
      return NextResponse.json(
        {
          error: "Server configuration error: Database not initialized",
          details:
            "Firebase Admin SDK requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables",
        },
        { status: 500 }
      );
    }

    // SECURITY: Validate durationMinutes is a positive integer
    const durationMinutesNum = Number(durationMinutes);
    if (
      !Number.isInteger(durationMinutesNum) ||
      durationMinutesNum <= 0 ||
      durationMinutesNum > 180 // Max 3 hours (180 minutes) per booking
    ) {
      return NextResponse.json(
        { error: "Invalid duration. Must be between 1 and 180 minutes." },
        { status: 400 }
      );
    }

    // SECURITY: Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // SECURITY: Prevent bookings in the past
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return NextResponse.json(
        { error: "Cannot book courts in the past" },
        { status: 400 }
      );
    }

    // SECURITY: Check database is initialized
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    // SECURITY FIX 1: Fetch price from court document (not from client)
    const courtDoc = await adminDb.collection("courts").doc(courtId).get();
    if (!courtDoc.exists) {
      return NextResponse.json({ error: "Court not found" }, { status: 404 });
    }

    const courtData = courtDoc.data();
    if (!courtData) {
      return NextResponse.json(
        { error: "Court data not found" },
        { status: 404 }
      );
    }

    const guestCountNum = guestCount == null || guestCount === "" ? 1 : Number(guestCount);
    if (!Number.isInteger(guestCountNum) || guestCountNum < 1) {
      return NextResponse.json(
        { error: "Guest count must be at least 1" },
        { status: 400 }
      );
    }
    if (
      typeof courtData.maxGuests === "number" &&
      courtData.maxGuests > 0 &&
      guestCountNum > courtData.maxGuests
    ) {
      return NextResponse.json(
        { error: `This court allows up to ${courtData.maxGuests} guests` },
        { status: 400 }
      );
    }
    const normalizedInitialMessage =
      typeof initialMessage === "string" ? initialMessage.trim().slice(0, 500) : "";

    // Check max advance booking days
    const maxAdvanceDays = courtData.maxAdvanceBookingDays;
    if (maxAdvanceDays != null && typeof maxAdvanceDays === "number") {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
      if (bookingDate > maxDate) {
        return NextResponse.json(
          {
            error: `Bookings are only available up to ${maxAdvanceDays} days in advance`,
          },
          { status: 400 }
        );
      }
    }

    // SECURITY: Prevent double bookings - check for existing bookings and blocked times
    // Convert time to 24-hour format for comparison
    const convertTo24Hour = (time12: string): string => {
      if (/^\d{2}:\d{2}$/.test(time12)) {
        return time12; // Already in 24-hour format
      }
      const [timePart, period] = time12.split(" ");
      const [hours, minutes] = timePart.split(":").map(Number);
      let hours24 = hours;
      if (period === "PM" && hours !== 12) {
        hours24 = hours + 12;
      } else if (period === "AM" && hours === 12) {
        hours24 = 0;
      }
      return `${hours24.toString().padStart(2, "0")}:${(minutes || 0).toString().padStart(2, "0")}`;
    };

    // Check for blocked times (date-specific, always blocked, and day-of-week blocked)
    const blockedTimes = courtData.blockedTimes || {};
    const dateKey = date; // Date is already in YYYY-MM-DD format
    const blockedTimesForDate = blockedTimes[dateKey] || [];
    const alwaysBlocked = courtData.alwaysBlockedTimes || [];
    const dayOfWeek = new Date(date).getDay();
    const alwaysBlockedForDay = courtData.alwaysBlockedTimesByDay?.[dayOfWeek] || [];
    const time24 = convertTo24Hour(time);
    const allBlockedSet = new Set([
      ...blockedTimesForDate,
      ...alwaysBlocked,
      ...alwaysBlockedForDay,
    ]);
    // Add court-specific blocked times for multi-court listings
    const courtNumberNum = courtNumber ? Number(courtNumber) : 1;
    if (courtData.numberOfCourts > 1 && courtNumberNum) {
      const courtKey = String(courtNumberNum);
      const courtSpecificAlways = (courtData.courtSpecificAlwaysBlockedTimes || {})[courtKey] || [];
      const courtSpecificForDay = ((courtData.courtSpecificAlwaysBlockedTimesByDay || {})[courtKey] || {})[String(dayOfWeek)] || [];
      courtSpecificAlways.forEach((t: string) => allBlockedSet.add(t));
      courtSpecificForDay.forEach((t: string) => allBlockedSet.add(t));
    }

    // Check that no hour in the booking range overlaps with blocked times
    // (e.g. 1pm + 3h spans 1pm-4pm; if 3pm is blocked, reject)
    const [startHour] = time24.split(":").map(Number);
    const durationHours = Math.ceil(durationMinutesNum / 60);
    for (let i = 0; i < durationHours; i++) {
      const hour = startHour + i;
      const hourStr = hour.toString().padStart(2, "0") + ":00";
      if (allBlockedSet.has(hourStr)) {
        return NextResponse.json(
          { error: "This booking would overlap with blocked time slots" },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // Check for existing bookings that would conflict
    // Query existing bookings for this court and date
    const bookingsSnapshot = await adminDb
      .collection("bookings")
      .where("courtId", "==", courtId)
      .where("date", "==", date)
      .get();

    // Check each existing booking for conflicts
    for (const bookingDoc of bookingsSnapshot.docs) {
      const booking = bookingDoc.data() as {
        date: string;
        time: string;
        status: string;
        createdAt?: unknown;
        expiresAt?: unknown;
        courtNumber?: number;
        duration?: number;
        durationMinutes?: number;
      };

      if (
        isBookingBlockingSlot(booking, {
          date,
          time,
          durationMinutes: durationMinutesNum,
          courtNumber: courtNumberNum,
        })
      ) {
        return NextResponse.json(
          { error: "This time slot is already booked" },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // SECURITY FIX 1: Get price from court document (stored as dollars per hour)
    const pricePerHour = Number(courtData.price);
    if (isNaN(pricePerHour) || pricePerHour <= 0) {
      return NextResponse.json(
        { error: "Invalid court pricing" },
        { status: 400 }
      );
    }

    const ownerId = courtData.ownerId;

    if (!ownerId) {
      return NextResponse.json(
        { error: "Court host not found" },
        { status: 404 }
      );
    }

    if (ownerId === userId) {
      return NextResponse.json(
        { error: "Hosts cannot book their own courts" },
        { status: 403 }
      );
    }

    // Get owner's Stripe account ID
    const ownerDoc = await adminDb.collection("users").doc(ownerId).get();
    const ownerData = ownerDoc.data();
    const stripeMode = getStripeMode();
    const { accountId: stripeAccountId } = getStripeAccountIdForMode(
      ownerData,
      stripeMode
    );

    const priceBreakdown = calculateBookingPriceBreakdown(
      pricePerHour,
      durationMinutesNum
    );
    const {
      ownerAmountCents,
      courtShareFeeCents,
      processingFeeCents,
      applicationFeeCents,
      totalAmountCents,
    } = priceBreakdown;

    // Validate total amount is reasonable
    if (totalAmountCents < 100 || totalAmountCents > 100000) {
      // Min $1, Max $1,000 per booking
      return NextResponse.json(
        { error: "Invalid booking amount" },
        { status: 400 }
      );
    }

    if (applicationFeeCents >= totalAmountCents) {
      return NextResponse.json(
        {
          error:
            "This booking amount is too low to cover card processing. Try a longer booking or contact support.",
        },
        { status: 400 }
      );
    }

    // Build checkout session with fraud prevention
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      // SECURITY: Enable Stripe Radar for fraud detection
      // This automatically blocks suspicious transactions
      payment_intent_data: {
        capture_method: "manual",
        // Radar will be enabled by default if you've enabled it in Stripe Dashboard
        // Add additional metadata for fraud detection
        metadata: {
          userId,
          courtId,
          bookingType: "court_rental",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Court Booking: ${date} at ${time}`,
            },
            unit_amount: totalAmountCents, // SECURITY FIX 3: Integer cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        courtId,
        userId,
        date,
        time,
        durationMinutes: durationMinutesNum.toString(),
        guestCount: guestCountNum.toString(),
        initialMessage: normalizedInitialMessage,
        ownerId,
        courtNumber: String(courtNumberNum),
        pricePerHour: pricePerHour.toString(),
        totalAmountCents: totalAmountCents.toString(),
        ownerAmountCents: ownerAmountCents.toString(),
        courtShareFeeCents: courtShareFeeCents.toString(),
        processingFeeCents: processingFeeCents.toString(),
        applicationFeeCents: applicationFeeCents.toString(),
      },
      success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/courts/${courtId}`,
    };

    let transferToOwner = false;
    let hostPayoutMode = "platform_hold";
    if (stripeAccountId) {
      console.log(
        `[CHECKOUT] Owner has ${stripeMode} Stripe Connect account: ${stripeAccountId}`
      );
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (
          account.charges_enabled &&
          account.payouts_enabled &&
          account.details_submitted
        ) {
          transferToOwner = true;
          hostPayoutMode = "destination_charge";
        } else {
          console.warn(
            `[CHECKOUT] Owner ${ownerId} Stripe account not fully activated (charges_enabled: ${account.charges_enabled}, payouts_enabled: ${account.payouts_enabled}, details_submitted: ${account.details_submitted}); checkout will use platform-held funds`
          );
        }
      } catch (err) {
        console.error(
          "[CHECKOUT] Unable to verify Stripe account; checkout will use platform-held funds:",
          err
        );
      }
    } else {
      console.warn(
        `[CHECKOUT] Owner ${ownerId} has no ${stripeMode} Stripe Connect account; checkout will use platform-held funds`
      );
    }

    sessionParams.metadata = {
      ...sessionParams.metadata,
      transferToOwner: transferToOwner ? "true" : "false",
      hostPayoutMode,
      stripeConnectAccountId: transferToOwner ? stripeAccountId || "" : "",
    };

    sessionParams.payment_intent_data = {
      ...sessionParams.payment_intent_data,
      metadata: {
        ...sessionParams.payment_intent_data?.metadata,
        ownerId,
        guestCount: guestCountNum.toString(),
        transferToOwner: transferToOwner ? "true" : "false",
        hostPayoutMode,
        stripeConnectAccountId: transferToOwner ? stripeAccountId || "" : "",
      },
    };

    if (transferToOwner && stripeAccountId) {
      sessionParams.payment_intent_data = {
        ...sessionParams.payment_intent_data,
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          ...sessionParams.payment_intent_data?.metadata,
          transferToOwner: "true",
          stripeConnectAccountId: stripeAccountId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
