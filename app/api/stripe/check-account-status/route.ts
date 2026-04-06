import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

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

  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    // Get user's Stripe account ID from Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.stripeAccountId) {
      return NextResponse.json({
        hasAccount: false,
        status: "none",
      });
    }

    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(userData.stripeAccountId);
    } catch (retrieveErr: unknown) {
      if (isStripeConnectAccountMissing(retrieveErr)) {
        await adminDb
          .collection("users")
          .doc(userId)
          .update({
            stripeAccountId: FieldValue.delete(),
            stripeAccountStatus: FieldValue.delete(),
            payoutEnabled: FieldValue.delete(),
          });
        return NextResponse.json({
          hasAccount: false,
          status: "none",
        });
      }
      throw retrieveErr;
    }

    // Update Firestore with current status
    const accountStatus = account.details_submitted
      ? account.charges_enabled && account.payouts_enabled
        ? "active"
        : "restricted"
      : "pending";

    await adminDb
      .collection("users")
      .doc(userId)
      .update({
        stripeAccountStatus: accountStatus,
        payoutEnabled: account.payouts_enabled || false,
      });

    return NextResponse.json({
      hasAccount: true,
      accountId: account.id,
      status: accountStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err: any) {
    console.error("Error checking Stripe account status:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check account status" },
      { status: 500 }
    );
  }
}
