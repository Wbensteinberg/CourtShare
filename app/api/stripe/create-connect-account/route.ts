import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  getStripeAccountIdForMode,
  getStripeAccountWriteFields,
  getStripeMode,
} from "@/lib/stripeConnectAccounts";
import { checkRateLimit } from "../../rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

function isStripeConnectAccountMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const stripeErr = err as {
    code?: string;
    type?: string;
    statusCode?: number;
    message?: string;
  };

  if (stripeErr.code === "resource_missing") return true;
  if (
    stripeErr.type === "StripeInvalidRequestError" &&
    stripeErr.statusCode === 404
  ) {
    return true;
  }

  return (
    typeof stripeErr.message === "string" &&
    /(no such account|does not have access to account|application access may have been revoked)/i.test(
      stripeErr.message
    )
  );
}

export async function POST(req: NextRequest) {
  // SECURITY: Rate limiting to prevent abuse
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitResult = await checkRateLimit(
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
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    userId = decodedToken.uid;
  } catch (err: any) {
    console.error("Error verifying ID token:", err);
    return NextResponse.json(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  // Parse request body to check for update flag
  let requestBody: { update?: boolean } = {};
  try {
    const bodyText = await req.text();
    if (bodyText) {
      requestBody = JSON.parse(bodyText);
    }
  } catch {
    // Body might be empty or invalid JSON, that's okay
  }

  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const stripeMode = getStripeMode();

    // Check if user already has a Stripe account for the current Stripe mode.
    const userDoc = await adminDb.collection("users").doc(userId).get();
    let userData = userDoc.data();
    let selectedAccount = getStripeAccountIdForMode(userData, stripeMode);

    let existingAccount: Stripe.Account | null = null;
    if (selectedAccount.accountId) {
      try {
        existingAccount = await stripe.accounts.retrieve(selectedAccount.accountId);
      } catch (retrieveErr: unknown) {
        if (isStripeConnectAccountMissing(retrieveErr)) {
          console.warn(
            `[CONNECT] Stripe account ${selectedAccount.accountId} is not accessible with ${stripeMode} keys`
          );
          if (!selectedAccount.isLegacy && selectedAccount.source) {
            await adminDb
              .collection("users")
              .doc(userId)
              .update({
                [selectedAccount.source]: FieldValue.delete(),
                stripeAccountStatus: FieldValue.delete(),
                payoutEnabled: FieldValue.delete(),
              });
          }
        } else {
          throw retrieveErr;
        }
      }
    }

    if (existingAccount) {
      const account = existingAccount;
      // Check if this is an update request (from request body)
      const isUpdate = requestBody.update === true;
      const accountReady =
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled;

      // If account needs onboarding or has outstanding requirements, send the host back to Stripe onboarding.
      if (!accountReady) {
        console.log(
          "[CONNECT] Account needs onboarding or requirements, creating account link"
        );
        const accountLink = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: `${req.nextUrl.origin}/host?refresh=true`,
          return_url: `${req.nextUrl.origin}/host?success=true`,
          type: "account_onboarding",
        });

        return NextResponse.json({
          accountId: account.id,
          onboardingUrl: accountLink.url,
          status: account.details_submitted ? "restricted" : "pending",
          requirementsCurrentlyDue: account.requirements?.currently_due || [],
          requirementsPastDue: account.requirements?.past_due || [],
          requirementsEventuallyDue: account.requirements?.eventually_due || [],
          disabledReason: account.requirements?.disabled_reason || null,
        });
      }

      // If this is an update request, create Express Dashboard login link
      if (isUpdate) {
        console.log(
          "[CONNECT] Creating Express Dashboard login link for updates"
        );
        const loginLink = await stripe.accounts.createLoginLink(account.id);

        return NextResponse.json({
          accountId: account.id,
          updateUrl: loginLink.url,
          status:
            account.charges_enabled && account.payouts_enabled
              ? "active"
              : "restricted",
          requirementsCurrentlyDue: account.requirements?.currently_due || [],
          requirementsPastDue: account.requirements?.past_due || [],
          requirementsEventuallyDue: account.requirements?.eventually_due || [],
          disabledReason: account.requirements?.disabled_reason || null,
        });
      }

      // Account is fully set up, return status
      return NextResponse.json({
        accountId: account.id,
        status:
          account.charges_enabled && account.payouts_enabled
            ? "active"
            : "restricted",
        requirementsCurrentlyDue: account.requirements?.currently_due || [],
        requirementsPastDue: account.requirements?.past_due || [],
        requirementsEventuallyDue: account.requirements?.eventually_due || [],
        disabledReason: account.requirements?.disabled_reason || null,
      });
    }

    // Refresh user after possible stale-ID clear
    const refreshedDoc = await adminDb.collection("users").doc(userId).get();
    userData = refreshedDoc.data() ?? userData;

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
      business_type: "individual",
      business_profile: {
        mcc: "7999",
        url: "https://courtshare.co",
        product_description:
          "Court hosts rent tennis court time to players through CourtShare.",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    console.log("[CONNECT] Successfully created account:", account.id);

    // Save mode-specific account ID to Firestore so local test mode and production live mode do not overwrite each other.
    await adminDb.collection("users").doc(userId).update({
      ...getStripeAccountWriteFields(account.id, stripeMode),
      stripeAccountStatus: "pending",
      stripeAccountMode: stripeMode,
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.nextUrl.origin}/host?refresh=true`,
      return_url: `${req.nextUrl.origin}/host?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      status: "pending",
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsPastDue: account.requirements?.past_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || [],
      disabledReason: account.requirements?.disabled_reason || null,
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
