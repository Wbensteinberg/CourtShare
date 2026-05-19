import type Stripe from "stripe";
import type { Firestore } from "firebase-admin/firestore";
import { createBookingRequestConversation } from "@/lib/conversations";
import { calculateBookingPriceBreakdown } from "@/lib/pricing";
import { isBookingBlockingSlot } from "@/lib/bookingConflicts";
import { assertAndWriteBookingSlotLocks } from "@/lib/bookingSlotLocks";

type CreateBookingResult =
  | { status: "created"; bookingId: string; conversationId: string }
  | { status: "existing"; bookingId: string; conversationId?: string };

const getDisplayName = (profile: FirebaseFirestore.DocumentData | undefined) => {
  const displayName = String(profile?.displayName || profile?.name || "").trim();
  if (displayName) return displayName;

  const email = String(profile?.email || "").trim();
  if (email) return email.split("@")[0];

  return undefined;
};

export async function createBookingFromPaidCheckoutSession(
  db: Firestore,
  session: Stripe.Checkout.Session
): Promise<CreateBookingResult> {
  if (session.status !== "complete") {
    throw new Error("Checkout session is not complete yet");
  }

  const metadata = session.metadata || {};
  const requiredFields = ["courtId", "userId", "date", "time"];
  const missingField = requiredFields.find((field) => !metadata[field]);
  if (missingField) {
    throw new Error(`Checkout session is missing ${missingField}`);
  }

  const courtDoc = await db.collection("courts").doc(metadata.courtId).get();
  if (!courtDoc.exists) {
    throw new Error(`Court ${metadata.courtId} not found`);
  }

  const courtData = courtDoc.data();
  if (!courtData) {
    throw new Error("Court data not found");
  }

  const [playerDoc, ownerDoc] = await Promise.all([
    db.collection("users").doc(metadata.userId).get(),
    db.collection("users").doc(courtData.ownerId || metadata.ownerId).get(),
  ]);
  const ownerId = courtData.ownerId || metadata.ownerId;
  const playerName = getDisplayName(playerDoc.data());
  const ownerName = getDisplayName(ownerDoc.data());

  const durationMinutes = metadata.durationMinutes
    ? Number(metadata.durationMinutes)
    : (Number(metadata.duration) || 60) * 60;
  const priceBreakdown = calculateBookingPriceBreakdown(
    Number(courtData.price),
    durationMinutes
  );
  const expectedAmountCents = priceBreakdown.totalAmountCents;
  const actualAmountCents = session.amount_total || 0;
  const newCourtNumber = Number(metadata.courtNumber) || 1;
  const guestCount = metadata.guestCount ? Number(metadata.guestCount) : 1;
  const initialMessage = String(metadata.initialMessage || "").trim().slice(0, 1000);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const bookingData = {
    courtId: metadata.courtId,
    ownerId,
    userId: metadata.userId,
    date: metadata.date,
    time: metadata.time,
	    courtNumber: newCourtNumber,
	    guestCount,
	    initialMessage,
	    duration: durationMinutes / 60,
    durationMinutes,
    status: "pending",
    createdAt: new Date(),
    expiresAt,
    sessionId: session.id,
    paymentIntentId: session.payment_intent || null,
    paymentStatus: "authorized",
    totalAmountCents: actualAmountCents,
    expectedAmountCents,
    ownerAmountCents: priceBreakdown.ownerAmountCents,
    courtShareFeeCents: priceBreakdown.courtShareFeeCents,
    processingFeeCents: priceBreakdown.processingFeeCents,
    applicationFeeCents: priceBreakdown.applicationFeeCents,
    transferToOwner: metadata.transferToOwner === "true",
    hostPayoutMode: metadata.hostPayoutMode || "platform_hold",
    hostPayoutStatus:
      metadata.transferToOwner === "true"
        ? "destination_charge_pending_capture"
        : "pending_connect_account",
    stripeConnectAccountId: metadata.stripeConnectAccountId || null,
  };

  const bookingRef = await db.runTransaction(async (transaction) => {
    const existingBookingBySession = await transaction.get(
      db.collection("bookings").where("sessionId", "==", session.id)
    );

    if (!existingBookingBySession.empty) {
      return existingBookingBySession.docs[0].ref;
    }

    const existingBookingsSnapshot = await transaction.get(
      db
        .collection("bookings")
        .where("courtId", "==", metadata.courtId)
        .where("date", "==", metadata.date)
    );

    for (const bookingDoc of existingBookingsSnapshot.docs) {
      const existingBooking = bookingDoc.data() as {
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
        isBookingBlockingSlot(existingBooking, {
          date: metadata.date || "",
          time: metadata.time || "",
          durationMinutes,
          courtNumber: newCourtNumber,
        })
      ) {
        throw new Error("Time slot was already booked");
      }
    }

    const newBookingRef = db.collection("bookings").doc();
    const slotLockIds = await assertAndWriteBookingSlotLocks({
      db,
      transaction,
      bookingId: newBookingRef.id,
      sessionId: session.id,
      input: {
        courtId: metadata.courtId,
        date: metadata.date,
        time: metadata.time,
        durationMinutes,
        courtNumber: newCourtNumber,
      },
      expiresAt,
    });
    transaction.set(newBookingRef, {
      ...bookingData,
      slotLockIds,
    });
    return newBookingRef;
  });

  const bookingDoc = await bookingRef.get();
  const savedBooking = bookingDoc.data();
  if (savedBooking?.sessionId === session.id && savedBooking.conversationId) {
    return {
      status: "existing",
      bookingId: bookingRef.id,
      conversationId: savedBooking.conversationId,
    };
  }

  const conversationId = await createBookingRequestConversation(db, {
    bookingId: bookingRef.id,
    courtId: metadata.courtId,
    courtName: courtData.name,
    playerId: metadata.userId,
    playerName,
    ownerId,
    ownerName,
    date: metadata.date,
    time: metadata.time,
	    durationMinutes,
	    courtNumber: newCourtNumber,
	    guestCount,
	    initialMessage,
	  });

  return {
    status: "created",
    bookingId: bookingRef.id,
    conversationId,
  };
}
