import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  getBookingEndDateTime,
  isBookingReviewable,
  isPendingBookingExpired,
  parseBookingDateTime,
} from "@/lib/bookingDates";
import {
  sendConversationMessageEmail,
  sendPlayerBookingExpiredNotification,
  sendReviewReminderEmail,
} from "@/lib/email";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";
import Stripe from "stripe";

const HOUR_MS = 60 * 60 * 1000;
const CHECK_IN_REMINDER_WINDOW_START_MS = 23 * HOUR_MS;
const CHECK_IN_REMINDER_WINDOW_END_MS = 25 * HOUR_MS;
const REVIEW_REMINDER_THRESHOLDS_MS = [1 * HOUR_MS, 48 * HOUR_MS, 120 * HOUR_MS];
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

const getDisplayName = (profile: FirebaseFirestore.DocumentData | null | undefined) => {
  const displayName = String(profile?.displayName || profile?.name || "").trim();
  if (displayName) return displayName;

  const email = String(profile?.email || "").trim();
  if (email) return email.split("@")[0];

  return "CourtShare user";
};

const verifyCronRequest = (req: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
};

async function sendCheckInReminders(now: Date) {
  if (!adminDb) return 0;

  const snapshot = await adminDb
    .collection("bookings")
    .where("status", "==", "confirmed")
    .get();

  let sent = 0;

  await Promise.all(
    snapshot.docs.map(async (bookingDoc) => {
      const booking = bookingDoc.data();
      if (booking.checkInReminderSentAt) return;

      let start: Date;
      try {
        start = parseBookingDateTime(booking.date, booking.time);
      } catch {
        return;
      }

      const untilStart = start.getTime() - now.getTime();
      if (
        untilStart < CHECK_IN_REMINDER_WINDOW_START_MS ||
        untilStart > CHECK_IN_REMINDER_WINDOW_END_MS
      ) {
        return;
      }

      const [courtDoc, playerDoc] = await Promise.all([
        adminDb!.collection("courts").doc(booking.courtId).get(),
        adminDb!.collection("users").doc(booking.userId).get(),
      ]);
      const court = courtDoc.exists ? courtDoc.data() : null;
      const player = playerDoc.exists ? playerDoc.data() : null;
      if (!court || !player) return;

      const ownerId = booking.ownerId || court.ownerId;
      const ownerDoc = ownerId
        ? await adminDb!.collection("users").doc(ownerId).get()
        : null;
      const owner = ownerDoc?.exists ? ownerDoc.data() : null;
      const conversationId = booking.conversationId || `booking_${bookingDoc.id}`;
      const instructions =
        String(court.checkInInstructions || court.accessInstructions || "").trim() ||
        "The host has not added special check-in instructions yet. Message them here if you need details before arriving.";
      const courtName = court.name || "your court";
      const messageBody = [
        `Reminder: your booking at ${courtName} is tomorrow at ${booking.time}.`,
        "",
        "Check-in instructions:",
        instructions,
      ].join("\n");

      const conversationRef = adminDb!.collection("conversations").doc(conversationId);
      const conversationDoc = await conversationRef.get();
      if (!conversationDoc.exists) return;

      await conversationRef.collection("messages").add({
        senderId: ownerId,
        body: messageBody,
        createdAt: FieldValue.serverTimestamp(),
        type: "check_in_reminder",
        bookingId: bookingDoc.id,
        courtId: booking.courtId,
      });

      await conversationRef.update({
        lastMessageText: messageBody,
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessageSenderId: ownerId,
        unreadBy: [booking.userId],
        updatedAt: FieldValue.serverTimestamp(),
      });

      await bookingDoc.ref.update({
        checkInReminderSentAt: FieldValue.serverTimestamp(),
      });

      const playerEmail = String(player.email || "").trim();
      if (playerEmail) {
        await sendConversationMessageEmail({
          recipientEmail: playerEmail,
          recipientName: getDisplayName(player),
          senderName: getDisplayName(owner),
          courtName,
          messageBody,
          conversationId,
        });
      }

      sent += 1;
    })
  );

  return sent;
}

async function expirePendingBookings(now: Date) {
  if (!adminDb || !stripe) return 0;

  const snapshot = await adminDb
    .collection("bookings")
    .where("status", "==", "pending")
    .get();

  let expired = 0;

  await Promise.all(
    snapshot.docs.map(async (bookingDoc) => {
      const booking = bookingDoc.data();
      if (
        !isPendingBookingExpired(
          booking as Parameters<typeof isPendingBookingExpired>[0],
          now
        )
      ) {
        return;
      }

      const [courtDoc, playerDoc] = await Promise.all([
        adminDb!.collection("courts").doc(booking.courtId).get(),
        adminDb!.collection("users").doc(booking.userId).get(),
      ]);
      const court = courtDoc.exists ? courtDoc.data() : null;
      const player = playerDoc.exists ? playerDoc.data() : null;

      const releasedPayment = await releaseBookingPayment(
        stripe,
        booking.sessionId,
        bookingDoc.id,
        "owner_acceptance_window_expired"
      );

      await bookingDoc.ref.update({
        status: "expired",
        cancelReason: "host_acceptance_window_expired",
        expiredAt: FieldValue.serverTimestamp(),
        paymentStatus: releasedPayment.paymentStatus,
        ...(releasedPayment.refundId ? { refundId: releasedPayment.refundId } : {}),
      });

      const playerEmail = String(player?.email || "").trim();
      if (court && playerEmail) {
        const price =
          typeof booking.totalAmountCents === "number"
            ? booking.totalAmountCents / 100
            : (court.price || 0) * (booking.duration || 1);

        await sendPlayerBookingExpiredNotification({
          courtName: court.name || "Court",
          playerEmail,
          playerName: getDisplayName(player),
          date: booking.date,
          time: booking.time,
          duration: booking.duration || 1,
          price,
          paymentStatus: releasedPayment.paymentStatus,
        });
      }

      expired += 1;
    })
  );

  return expired;
}

async function sendReviewReminders(now: Date) {
  if (!adminDb) return 0;

  const snapshot = await adminDb
    .collection("bookings")
    .where("status", "in", ["confirmed", "completed"])
    .get();

  let sent = 0;

  await Promise.all(
    snapshot.docs.map(async (bookingDoc) => {
      const booking = bookingDoc.data();
      if (!isBookingReviewable(booking as Parameters<typeof isBookingReviewable>[0], now)) {
        return;
      }

      let elapsedAfterEndMs = 0;
      try {
        elapsedAfterEndMs = now.getTime() - getBookingEndDateTime(booking as any).getTime();
      } catch {
        return;
      }

      const dueCount = REVIEW_REMINDER_THRESHOLDS_MS.filter(
        (threshold) => elapsedAfterEndMs >= threshold
      ).length;
      if (dueCount <= 0) return;

      const [courtDoc, playerDoc, playerReviewDoc, ownerReviewDoc] =
        await Promise.all([
          adminDb!.collection("courts").doc(booking.courtId).get(),
          adminDb!.collection("users").doc(booking.userId).get(),
          adminDb!.collection("reviews").doc(`${bookingDoc.id}_player`).get(),
          adminDb!.collection("reviews").doc(`${bookingDoc.id}_owner`).get(),
        ]);

      const court = courtDoc.exists ? courtDoc.data() : null;
      const player = playerDoc.exists ? playerDoc.data() : null;
      if (!court || !player) return;
      const ownerId = booking.ownerId || court.ownerId;
      const ownerDoc = ownerId
        ? await adminDb!.collection("users").doc(ownerId).get()
        : null;
      const owner = ownerDoc?.exists ? ownerDoc.data() : null;
      if (!owner) return;

      const updates: Record<string, any> = {};
      const courtName = court.name || "your court";
      const currentPlayerReminderCount =
        typeof booking.playerReviewReminderCount === "number"
          ? booking.playerReviewReminderCount
          : 0;
      const currentOwnerReminderCount =
        typeof booking.ownerReviewReminderCount === "number"
          ? booking.ownerReviewReminderCount
          : 0;

      if (!playerReviewDoc.exists && currentPlayerReminderCount < dueCount) {
        const playerEmail = String(player.email || "").trim();
        if (playerEmail) {
          await sendReviewReminderEmail({
            recipientEmail: playerEmail,
            recipientName: getDisplayName(player),
            bookingId: bookingDoc.id,
            courtName,
            date: booking.date,
            time: booking.time,
            revieweeName: getDisplayName(owner),
          });
          updates.playerReviewReminderCount = dueCount;
          updates.playerReviewReminderLastSentAt = FieldValue.serverTimestamp();
          sent += 1;
        }
      }

      if (!ownerReviewDoc.exists && currentOwnerReminderCount < dueCount) {
        const ownerEmail = String(owner.email || "").trim();
        if (ownerEmail) {
          await sendReviewReminderEmail({
            recipientEmail: ownerEmail,
            recipientName: getDisplayName(owner),
            bookingId: bookingDoc.id,
            courtName,
            date: booking.date,
            time: booking.time,
            revieweeName: getDisplayName(player),
          });
          updates.ownerReviewReminderCount = dueCount;
          updates.ownerReviewReminderLastSentAt = FieldValue.serverTimestamp();
          sent += 1;
        }
      }

      if (Object.keys(updates).length > 0) {
        await bookingDoc.ref.update(updates);
      }
    })
  );

  return sent;
}

async function handleScheduledNotifications(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json(
      { error: "Database not initialized" },
      { status: 500 }
    );
  }

  const now = new Date();
  const [expiredBookings, checkInRemindersSent, reviewRemindersSent] = await Promise.all([
    expirePendingBookings(now),
    sendCheckInReminders(now),
    sendReviewReminders(now),
  ]);

  return NextResponse.json({
    success: true,
    expiredBookings,
    checkInRemindersSent,
    reviewRemindersSent,
  });
}

export async function GET(req: NextRequest) {
  return handleScheduledNotifications(req);
}

export async function POST(req: NextRequest) {
  return handleScheduledNotifications(req);
}
