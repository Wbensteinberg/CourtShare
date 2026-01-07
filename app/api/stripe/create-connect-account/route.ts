import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { checkRateLimit } from "../../rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  // SECURITY: Rate limiting to prevent abuse
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitResult = checkRateLimit(
    `${ip}-${req.headers.get("user-agent")}-connect`
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }

  // SECURITY: Verify Firebase ID token instead of accepting userId from client
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

  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    // Check if user already has a Stripe account
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (userData?.stripeAccountId) {
      // Account already exists, check if it needs onboarding
      console.log(
        "[CONNECT] User already has account:",
        userData.stripeAccountId
      );
      const account = await stripe.accounts.retrieve(userData.stripeAccountId);

      // If account needs onboarding, create account link
      if (!account.details_submitted) {
        console.log(
          "[CONNECT] Account needs onboarding, creating account link"
        );
        const accountLink = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: `${req.nextUrl.origin}/dashboard/owner?refresh=true`,
          return_url: `${req.nextUrl.origin}/dashboard/owner?success=true`,
          type: "account_onboarding",
        });

        return NextResponse.json({
          accountId: account.id,
          onboardingUrl: accountLink.url,
          status: "pending",
        });
      }

      // Account is fully set up
      return NextResponse.json({
        accountId: account.id,
        status:
          account.charges_enabled && account.payouts_enabled
            ? "active"
            : "restricted",
      });
    }

    // Debug: Log API key info (first few chars only for security)
    const apiKeyPrefix =
      process.env.STRIPE_SECRET_KEY?.substring(0, 12) || "NOT_SET";
    console.log(
      "[CONNECT] Creating Express account with API key:",
      apiKeyPrefix + "..."
    );
    console.log("[CONNECT] User email:", userData?.email);
    console.log("[CONNECT] User ID:", userId);

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US", // Change based on your needs
      email: userData?.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    console.log("[CONNECT] Successfully created account:", account.id);

    // Save account ID to Firestore
    await adminDb.collection("users").doc(userId).update({
      stripeAccountId: account.id,
      stripeAccountStatus: "pending",
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.nextUrl.origin}/dashboard/owner?refresh=true`,
      return_url: `${req.nextUrl.origin}/dashboard/owner?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      status: "pending",
    });
  } catch (err: any) {
    console.error("Error creating Stripe Connect account:", err);

    // More detailed error logging
    if (err.type === "StripeInvalidRequestError") {
      console.error("Stripe API Error Details:", {
        type: err.type,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      });

      // Check if it's a Connect not activated error
      if (err.message?.includes("signed up for Connect")) {
        return NextResponse.json(
          {
            error:
              "Stripe Connect is not activated for this API key. Please verify your STRIPE_SECRET_KEY matches the Stripe account where Connect is enabled.",
            details:
              "Make sure you're using the test mode API key from the same Stripe account where you see your connected accounts.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: err.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
