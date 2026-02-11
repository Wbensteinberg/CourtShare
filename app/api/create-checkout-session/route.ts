import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { checkRateLimit } from "../rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Platform commission rate (0% for now, can be changed later)
const PLATFORM_COMMISSION_RATE = 0; // 0 = 0%, 0.05 = 5%, etc.

export async function POST(req: NextRequest) {
  console.log("[CHECKOUT] Request received");

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
  const rateLimitResult = checkRateLimit(
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
    const decodedToken = await adminAuth.verifyIdToken(idToken);
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
  const { courtId, date, time, durationMinutes } = await req.json();

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
    const allBlocked = [
      ...blockedTimesForDate,
      ...alwaysBlocked,
      ...alwaysBlockedForDay,
    ];

    if (allBlocked.includes(time24)) {
      return NextResponse.json(
        { error: "This time slot is blocked and unavailable" },
        { status: 409 } // 409 Conflict
      );
    }

    // Check for existing bookings that would conflict
    // Calculate the end time of the requested booking
    const [startHour, startMinute] = time24.split(":").map(Number);
    const durationHours = Math.ceil(durationMinutesNum / 60); // Round up to full hours
    const endHour = startHour + durationHours;

    // Query existing bookings for this court and date
    const bookingsSnapshot = await adminDb
      .collection("bookings")
      .where("courtId", "==", courtId)
      .where("date", "==", date)
      .get();

    const timeRangesOverlap = (
      start1: string,
      duration1Hours: number,
      start2: string,
      duration2Hours: number
    ): boolean => {
      const convertTo24 = (t: string): string => {
        if (/^\d{2}:\d{2}$/.test(t)) return t;
        const [timePart, period] = t.split(" ");
        const [h, m] = timePart.split(":").map(Number);
        let h24 = h;
        if (period === "PM" && h !== 12) h24 = h + 12;
        else if (period === "AM" && h === 12) h24 = 0;
        return `${h24.toString().padStart(2, "0")}:${(m || 0).toString().padStart(2, "0")}`;
      };

      const s1 = convertTo24(start1);
      const s2 = convertTo24(start2);
      const [h1] = s1.split(":").map(Number);
      const [h2] = s2.split(":").map(Number);
      const e1 = h1 + duration1Hours;
      const e2 = h2 + duration2Hours;

      // Check if ranges overlap
      return (h1 < e2 && e1 > h2);
    };

    // Check each existing booking for conflicts
    for (const bookingDoc of bookingsSnapshot.docs) {
      const booking = bookingDoc.data();
      
      // Only check confirmed and pending bookings (rejected bookings don't block)
      if (booking.status === "confirmed" || booking.status === "pending") {
        const existingTime = booking.time;
        const existingDuration = Math.ceil((booking.durationMinutes || booking.duration * 60) / 60);
        
        if (timeRangesOverlap(time, durationHours, existingTime, existingDuration)) {
          return NextResponse.json(
            { error: "This time slot is already booked" },
            { status: 409 } // 409 Conflict
          );
        }
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
        { error: "Court owner not found" },
        { status: 404 }
      );
    }

    // Get owner's Stripe account ID
    const ownerDoc = await adminDb.collection("users").doc(ownerId).get();
    const ownerData = ownerDoc.data();
    const stripeAccountId = ownerData?.stripeAccountId;

    // SECURITY FIX 3: Compute totalAmountCents as integer on server
    // Convert price per hour to price per minute, then multiply by duration
    const pricePerMinuteCents = Math.round((pricePerHour * 100) / 60); // Convert $/hr to cents/min
    const totalAmountCents = pricePerMinuteCents * durationMinutesNum; // Total in integer cents

    // Validate total amount is reasonable
    if (totalAmountCents < 100 || totalAmountCents > 100000) {
      // Min $1, Max $1,000 per booking
      return NextResponse.json(
        { error: "Invalid booking amount" },
        { status: 400 }
      );
    }

    // SECURITY FIX 3: Ensure commission is integer cents
    const commissionAmount = Math.round(
      totalAmountCents * PLATFORM_COMMISSION_RATE
    );

    // Build checkout session with fraud prevention
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      // SECURITY: Enable Stripe Radar for fraud detection
      // This automatically blocks suspicious transactions
      payment_intent_data: {
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
        userId, // Now verified from Firebase token
        date,
        time,
        durationMinutes: durationMinutesNum.toString(), // Store as minutes
        ownerId,
        pricePerHour: pricePerHour.toString(), // Store for reference
        totalAmountCents: totalAmountCents.toString(), // Store for reference
      },
      success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/courts/${courtId}`,
    };

    // If owner has Stripe Connect account, use it to split payments
    if (stripeAccountId) {
      console.log(
        `[CHECKOUT] Owner has Stripe Connect account: ${stripeAccountId}`
      );
      // SECURITY: Verify owner's account is active before allowing transfers
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (!account.charges_enabled || !account.details_submitted) {
          // Owner's account not ready - payment goes to platform
          console.warn(
            `[CHECKOUT] Owner ${ownerId} Stripe account not fully activated (charges_enabled: ${account.charges_enabled}, details_submitted: ${account.details_submitted})`
          );
          console.log(
            `[CHECKOUT] Payment will go to PLATFORM account (not transferred to owner)`
          );
        } else {
          // Owner account is active - split payment
          console.log(
            `[CHECKOUT] ✅ STRIPE CONNECT ACTIVE - Payment will be TRANSFERRED to owner account ${stripeAccountId}`
          );
          console.log(
            `[CHECKOUT] Transfer details: ${totalAmountCents} cents total, ${commissionAmount} cents platform fee, ${
              totalAmountCents - commissionAmount
            } cents to owner`
          );
          sessionParams.payment_intent_data = {
            ...sessionParams.payment_intent_data,
            application_fee_amount: commissionAmount, // Platform commission (0% for now)
            transfer_data: {
              destination: stripeAccountId, // Send remaining amount to owner's account
              // Stripe automatically calculates: owner receives = totalAmount - commissionAmount
            },
            metadata: {
              ...sessionParams.payment_intent_data?.metadata,
              ownerId,
              transferToOwner: "true",
              stripeConnectAccountId: stripeAccountId,
            },
          };
        }
      } catch (err) {
        console.error("[CHECKOUT] Error verifying Stripe account:", err);
        // If we can't verify, don't transfer - safer to keep payment on platform
        console.log(
          `[CHECKOUT] Payment will go to PLATFORM account (error verifying owner account)`
        );
      }
    } else {
      // Owner hasn't set up Stripe Connect yet
      // For now, payment goes to platform account
      console.warn(
        `[CHECKOUT] Owner ${ownerId} doesn't have Stripe Connect account set up`
      );
      console.log(
        `[CHECKOUT] Payment will go to PLATFORM account (owner has no Connect account)`
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
