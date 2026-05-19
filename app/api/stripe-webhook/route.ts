import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { createBookingFromPaidCheckoutSession } from "@/lib/bookingCreation";
import { sendOwnerBookingNotification } from "@/lib/email";
import { calculateBookingPriceBreakdown } from "@/lib/pricing";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockStripeWebhookPOST } from "@/lib/mockApiServer";
import { writeSecurityAuditLog } from "@/lib/securityAudit";
import { sendOpsAlert } from "@/lib/opsAlerts";
import { checkRateLimit } from "../rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

const sendWebhookAlert = sendOpsAlert;

async function sendOwnerNotification(
  session: Stripe.Checkout.Session,
  bookingId: string,
  conversationId?: string
) {
  if (!adminDb) return;
  const bookingDoc = await adminDb.collection("bookings").doc(bookingId).get();
  const bookingData = bookingDoc.exists ? bookingDoc.data() : null;
  if (!bookingData) return;

  const [courtDoc, playerDoc] = await Promise.all([
    adminDb.collection("courts").doc(bookingData.courtId).get(),
    adminDb.collection("users").doc(bookingData.userId).get(),
  ]);
  const courtData = courtDoc.exists ? courtDoc.data() : null;
  const playerData = playerDoc.exists ? playerDoc.data() : null;
  const ownerId = bookingData.ownerId || courtData?.ownerId;
  const ownerDoc = ownerId
    ? await adminDb.collection("users").doc(ownerId).get()
    : null;
  const ownerData = ownerDoc?.exists ? ownerDoc.data() : null;

  if (!courtData || !ownerData?.email) return;

  const duration =
    typeof bookingData.duration === "number"
      ? bookingData.duration
      : typeof bookingData.durationMinutes === "number"
        ? bookingData.durationMinutes / 60
        : 1;
  const price =
    typeof bookingData.totalAmountCents === "number"
      ? bookingData.totalAmountCents / 100
      : (courtData.price || 0) * duration;

  await sendOwnerBookingNotification({
    bookingId,
    conversationId: conversationId || bookingData.conversationId,
    courtName: courtData.name || "Court",
    courtAddress: courtData.address || courtData.location,
    courtLocation: courtData.location,
    courtImageUrl:
      Array.isArray(courtData.imageUrls) && courtData.imageUrls[0]
        ? courtData.imageUrls[0]
        : courtData.imageUrl,
    playerName: playerData?.displayName || playerData?.name,
    playerEmail: playerData?.email || session.customer_email || bookingData.userId,
    ownerName: ownerData.displayName || ownerData.name,
    ownerEmail: ownerData.email,
    date: bookingData.date,
    time: bookingData.time,
    duration,
    durationMinutes:
      typeof bookingData.durationMinutes === "number"
        ? bookingData.durationMinutes
        : undefined,
    courtNumber:
      typeof bookingData.courtNumber === "number"
        ? bookingData.courtNumber
        : undefined,
    guestCount:
      typeof bookingData.guestCount === "number"
        ? bookingData.guestCount
        : undefined,
    price,
    playerProfileImageUrl: playerData?.profileImageUrl,
    ownerAmount:
      typeof bookingData.ownerAmountCents === "number"
        ? bookingData.ownerAmountCents / 100
        : undefined,
    initialMessage: bookingData.initialMessage || "",
  });
}

async function verifyCheckoutAmount(session: Stripe.Checkout.Session) {
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const metadata = session.metadata || {};
  const courtId = metadata.courtId;
  if (!courtId) throw new Error("Checkout session is missing courtId");

  const courtDoc = await adminDb.collection("courts").doc(courtId).get();
  if (!courtDoc.exists) throw new Error(`Court ${courtId} not found`);

  const courtData = courtDoc.data();
  const durationMinutes = metadata.durationMinutes
    ? Number(metadata.durationMinutes)
    : (Number(metadata.duration) || 60) * 60;
  const priceBreakdown = calculateBookingPriceBreakdown(
    Number(courtData?.price),
    durationMinutes
  );
  const expectedAmountCents = priceBreakdown.totalAmountCents;
  const actualAmountCents = session.amount_total || 0;

  if (Math.abs(actualAmountCents - expectedAmountCents) > 1) {
    await writeSecurityAuditLog(adminDb, "stripe_amount_mismatch", {
      sessionId: session.id,
      courtId,
      expectedAmountCents,
      actualAmountCents,
    });
    await sendWebhookAlert(
      "Stripe checkout amount mismatch",
      `Session ${session.id} expected ${expectedAmountCents} cents but received ${actualAmountCents} cents.`
    );
  }
}

export async function POST(req: NextRequest) {
  if (isMockApiMode()) {
    return mockStripeWebhookPOST();
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimit = await checkRateLimit(`stripe-webhook:${ip}`);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      await sendWebhookAlert(
        "Stripe webhook misconfigured",
        `Missing signature or STRIPE_WEBHOOK_SECRET. endpointSecret=${!!endpointSecret}`
      );
      return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    await sendWebhookAlert(
      "Stripe webhook signature verification failed",
      err.message || "Unknown signature verification error"
    );
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    if (!adminDb) throw new Error("Firebase Admin not initialized");
    await verifyCheckoutAmount(session);

    const result = await createBookingFromPaidCheckoutSession(adminDb, session);
    await writeSecurityAuditLog(adminDb, "stripe_checkout_processed", {
      sessionId: session.id,
      bookingId: result.bookingId,
      result: result.status,
    });

    if (result.status === "created") {
      try {
        await sendOwnerNotification(session, result.bookingId, result.conversationId);
      } catch (emailError: any) {
        console.error(
          "[WEBHOOK] Failed to send owner booking notification:",
          emailError?.message || emailError
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    const message = err?.message || "Unknown webhook processing error";
    console.error("[WEBHOOK] Failed processing checkout session:", message);

    if (message === "Time slot was already booked") {
      try {
        await releaseBookingPayment(
          stripe,
          session.id,
          session.id,
          "double_booking_prevention"
        );
        await writeSecurityAuditLog(adminDb, "stripe_double_booking_released", {
          sessionId: session.id,
        });
      } catch (releaseError) {
        console.error("[WEBHOOK] Failed to release double-booked payment:", releaseError);
        await sendWebhookAlert(
          "Webhook payment release failed after double-booking detection",
          `Session ${session.id} could not be auto-released.`
        );
      }
      return NextResponse.json(
        { error: "Time slot was already booked" },
        { status: 409 }
      );
    }

    await writeSecurityAuditLog(adminDb, "stripe_webhook_processing_failed", {
      sessionId: session.id,
      error: message.slice(0, 500),
    });
    await sendWebhookAlert(
      "Webhook failed processing checkout session",
      `Session ${session.id}: ${message}`
    );
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
