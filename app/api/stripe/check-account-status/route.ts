import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  getStripeAccountIdForMode,
  getStripeAccountWriteFields,
  getStripeMode,
} from "@/lib/stripeConnectAccounts";
import { transferPlatformHeldBookingToHost } from "@/lib/stripeHostPayouts";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockCheckAccountStatusPOST } from "@/lib/mockApiServer";
import { writeSecurityAuditLog } from "@/lib/securityAudit";
import {
  enforceRateLimit,
  isNextResponse,
  requireFirebaseUser,
  validateMutationOrigin,
} from "@/lib/apiSecurity";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

async function updateOwnedCourtBookableStatus(
  userId: string,
  status: "active" | "draft",
  stripeMode: string
) {
  if (!adminDb) return;
  const courtsSnap = await adminDb
    .collection("courts")
    .where("ownerId", "==", userId)
    .limit(100)
    .get();
  if (courtsSnap.empty) return;

  const batch = adminDb.batch();
  courtsSnap.docs.forEach((courtDoc) => {
    batch.update(courtDoc.ref, {
      bookableStatus: status,
      ownerStripeAccountStatus: status === "active" ? "active" : "inactive",
      ownerStripeMode: stripeMode,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

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
  if (isMockApiMode()) {
    return mockCheckAccountStatusPOST(req);
  }

  const originError = validateMutationOrigin(req);
  if (originError) return originError;

  const auth = await requireFirebaseUser(req, adminAuth);
  if (isNextResponse(auth)) return auth;
  const userId = auth.uid;

  const rateLimitError = await enforceRateLimit(req, "check-account-status", userId);
  if (rateLimitError) return rateLimitError;

  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const stripeMode = getStripeMode();

    // Get user's Stripe account ID for the current Stripe mode from Firestore.
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const selectedAccount = getStripeAccountIdForMode(userData, stripeMode);

    if (!selectedAccount.accountId) {
      await updateOwnedCourtBookableStatus(userId, "draft", stripeMode);
      return NextResponse.json({
        hasAccount: false,
        status: "none",
        mode: stripeMode,
      });
    }

    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(selectedAccount.accountId);
    } catch (retrieveErr: unknown) {
      if (isStripeConnectAccountMissing(retrieveErr)) {
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
        await updateOwnedCourtBookableStatus(userId, "draft", stripeMode);
        return NextResponse.json({
          hasAccount: false,
          status: "none",
          mode: stripeMode,
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
        ...getStripeAccountWriteFields(account.id, stripeMode),
        stripeAccountStatus: accountStatus,
        stripeAccountMode: stripeMode,
        payoutEnabled: account.payouts_enabled || false,
      });

    await updateOwnedCourtBookableStatus(
      userId,
      accountStatus === "active" ? "active" : "draft",
      stripeMode
    );
    await writeSecurityAuditLog(adminDb, "stripe_account_status_checked", {
      actorId: userId,
      accountId: account.id,
      accountStatus,
      mode: stripeMode,
    });

    let processedPendingTransfers = 0;
    if (accountStatus === "active") {
      try {
        const pendingTransfers = await adminDb
          .collection("bookings")
          .where("ownerId", "==", userId)
          .where("paymentStatus", "==", "captured")
          .where("hostPayoutStatus", "in", [
            "pending_connect_account",
            "transfer_failed",
          ])
          .limit(25)
          .get();

        for (const bookingDoc of pendingTransfers.docs) {
          const paymentIntentId = String(bookingDoc.data().paymentIntentId || "");
          if (!paymentIntentId) continue;
          const result = await transferPlatformHeldBookingToHost({
            stripe,
            bookingRef: bookingDoc.ref,
            bookingData: bookingDoc.data(),
            ownerData: userData,
            paymentIntentId,
          });
          if (result.status === "transferred") {
            processedPendingTransfers += 1;
          }
        }
      } catch (transferErr) {
        console.warn(
          "[CHECK ACCOUNT STATUS] Unable to process pending host transfers:",
          transferErr
        );
      }
    }

    return NextResponse.json({
      hasAccount: true,
      accountId: account.id,
      mode: stripeMode,
      status: accountStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsPastDue: account.requirements?.past_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || [],
      disabledReason: account.requirements?.disabled_reason || null,
      processedPendingTransfers,
    });
  } catch (err: any) {
    console.error("Error checking Stripe account status:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check account status" },
      { status: 500 }
    );
  }
}
