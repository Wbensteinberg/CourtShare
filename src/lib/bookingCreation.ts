import type Stripe from "stripe";
import type { Firestore } from "firebase-admin/firestore";
import { isActionablePendingBooking } from "@/lib/bookingDates";
import { createBookingRequestConversation } from "@/lib/conversations";

type BookingStatusParts = Parameters<typeof isActionablePendingBooking>[0];

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

const convertTo24Hour = (time12: string): string => {
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const [timePart, period] = time12.split(" ");
  const [hours, minutes] = timePart.split(":").map(Number);
  let hours24 = hours;
  if (period === "PM" && hours !== 12) hours24 = hours + 12;
  else if (period === "AM" && hours === 12) hours24 = 0;
  return `${hours24.toString().padStart(2, "0")}:${(minutes || 0)
    .toString()
    .padStart(2, "0")}`;
};

const timeRangesOverlap = (
  start1: string,
  duration1Hours: number,
  start2: string,
  duration2Hours: number
): boolean => {
  const s1 = convertTo24Hour(start1);
  const s2 = convertTo24Hour(start2);
  const [h1] = s1.split(":").map(Number);
  const [h2] = s2.split(":").map(Number);
  const e1 = h1 + duration1Hours;
  const e2 = h2 + duration2Hours;
  return h1 < e2 && e1 > h2;
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

  const existingBookingBySession = await db
    .collection("bookings")
    .where("sessionId", "==", session.id)
    .get();

  if (!existingBookingBySession.empty) {
    const existingBookingDoc = existingBookingBySession.docs[0];
    const existingBooking = existingBookingDoc.data();
    return {
      status: "existing",
      bookingId: existingBookingDoc.id,
      conversationId: existingBooking.conversationId,
    };
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
  const playerName = getDisplayName(playerDoc.data());
  const ownerName = getDisplayName(ownerDoc.data());

  const durationMinutes = metadata.durationMinutes
    ? Number(metadata.durationMinutes)
    : (Number(metadata.duration) || 60) * 60;
  const durationHours = Math.ceil(durationMinutes / 60);
  const expectedAmountCents =
    Math.round((Number(courtData.price) * 100) / 60) * durationMinutes;
  const actualAmountCents = session.amount_total || 0;
  const newCourtNumber = Number(metadata.courtNumber) || 1;

  const existingBookingsSnapshot = await db
    .collection("bookings")
    .where("courtId", "==", metadata.courtId)
    .where("date", "==", metadata.date)
    .get();

  for (const bookingDoc of existingBookingsSnapshot.docs) {
    const existingBooking = bookingDoc.data() as BookingStatusParts & {
      courtNumber?: number;
      duration?: number;
      durationMinutes?: number;
    };
    if ((existingBooking.courtNumber || 1) !== newCourtNumber) continue;
    if (
      existingBooking.status !== "confirmed" &&
      !isActionablePendingBooking(existingBooking)
    ) {
      continue;
    }

    const existingDuration = Math.ceil(
      (existingBooking.durationMinutes || (existingBooking.duration || 1) * 60) / 60
    );
    if (
      timeRangesOverlap(
        metadata.time,
        durationHours,
        existingBooking.time,
        existingDuration
      )
    ) {
      throw new Error("Time slot was already booked");
    }
  }

  const bookingData = {
    courtId: metadata.courtId,
    userId: metadata.userId,
    date: metadata.date,
    time: metadata.time,
    courtNumber: newCourtNumber,
    duration: durationMinutes / 60,
    durationMinutes,
    status: "pending",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    sessionId: session.id,
    paymentIntentId: session.payment_intent || null,
    paymentStatus: "authorized",
    totalAmountCents: actualAmountCents,
    expectedAmountCents,
  };

  const bookingRef = await db.collection("bookings").add(bookingData);
  const conversationId = await createBookingRequestConversation(db, {
    bookingId: bookingRef.id,
    courtId: metadata.courtId,
    courtName: courtData.name,
    playerId: metadata.userId,
    playerName,
    ownerId: courtData.ownerId || metadata.ownerId,
    ownerName,
    date: metadata.date,
    time: metadata.time,
    durationMinutes,
    courtNumber: newCourtNumber,
  });

  return {
    status: "created",
    bookingId: bookingRef.id,
    conversationId,
  };
}
