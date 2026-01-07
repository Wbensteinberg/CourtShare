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
      return NextResponse.json(
        { error: "Authentication service not initialized" },
        { status: 500 }
      );
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (err: any) {
    console.error("Error verifying ID token:", err);
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
      // SECURITY: Verify owner's account is active before allowing transfers
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        if (!account.charges_enabled || !account.details_submitted) {
          // Owner's account not ready - payment goes to platform
          console.warn(`Owner ${ownerId} Stripe account not fully activated`);
        } else {
          // Owner account is active - split payment
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
            },
          };
        }
      } catch (err) {
        console.error("Error verifying Stripe account:", err);
        // If we can't verify, don't transfer - safer to keep payment on platform
      }
    } else {
      // Owner hasn't set up Stripe Connect yet
      // For now, payment goes to platform account
      // TODO: Show warning to owner that they need to connect their account
      console.warn(
        `Owner ${ownerId} doesn't have Stripe Connect account set up`
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
