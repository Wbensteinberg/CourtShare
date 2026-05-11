import type Stripe from "stripe";
import type { DocumentReference } from "firebase-admin/firestore";
import { getStripeAccountIdForMode, getStripeMode } from "@/lib/stripeConnectAccounts";

export type HostPayoutTransferResult =
  | { status: "transferred"; transferId: string; accountId: string }
  | { status: "already_transferred"; transferId: string }
  | { status: "pending_connect_account" };

export async function getActiveStripeConnectAccountId(
  stripe: Stripe,
  ownerData: FirebaseFirestore.DocumentData | undefined | null
): Promise<string | null> {
  const { accountId } = getStripeAccountIdForMode(ownerData, getStripeMode());
  if (!accountId) return null;

  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted
    ) {
      return account.id;
    }
  } catch (err) {
    console.warn("[HOST PAYOUTS] Unable to verify Stripe Connect account:", err);
  }

  return null;
}

export async function transferPlatformHeldBookingToHost({
  stripe,
  bookingRef,
  bookingData,
  ownerData,
  paymentIntentId,
}: {
  stripe: Stripe;
  bookingRef: DocumentReference;
  bookingData: FirebaseFirestore.DocumentData;
  ownerData: FirebaseFirestore.DocumentData | undefined | null;
  paymentIntentId: string;
}): Promise<HostPayoutTransferResult> {
  if (bookingData.ownerTransferId) {
    return {
      status: "already_transferred",
      transferId: String(bookingData.ownerTransferId),
    };
  }

  const destination = await getActiveStripeConnectAccountId(stripe, ownerData);
  if (!destination) {
    await bookingRef.update({
      hostPayoutStatus: "pending_connect_account",
      hostPayoutMode: "platform_hold",
    });
    return { status: "pending_connect_account" };
  }

  const amount = Number(bookingData.ownerAmountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Booking is missing a valid host payout amount");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const latestCharge =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  const transferParams: Stripe.TransferCreateParams = {
    amount,
    currency: "usd",
    destination,
    metadata: {
      bookingId: bookingRef.id,
      courtId: String(bookingData.courtId || ""),
      ownerId: String(bookingData.ownerId || ""),
      paymentIntentId,
    },
  };

  if (latestCharge) {
    transferParams.source_transaction = latestCharge;
  }

  const transfer = await stripe.transfers.create(transferParams, {
    idempotencyKey: `booking-owner-transfer-${bookingRef.id}`,
  });

  await bookingRef.update({
    hostPayoutStatus: "owner_transfer_created",
    hostPayoutMode: "platform_transfer",
    ownerTransferId: transfer.id,
    ownerTransferredAt: new Date(),
    stripeConnectAccountId: destination,
  });

  return {
    status: "transferred",
    transferId: transfer.id,
    accountId: destination,
  };
}
