import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

type BookingConversationInput = {
  bookingId: string;
  courtId: string;
  courtName?: string;
  playerId: string;
  playerName?: string;
  ownerId: string;
  ownerName?: string;
  date: string;
  time: string;
  durationMinutes: number;
  courtNumber?: number;
};

const buildBookingRequestMessage = ({
  courtName,
  date,
  time,
  durationMinutes,
  courtNumber,
}: BookingConversationInput) => {
  const durationHours = durationMinutes / 60;
  const durationLabel = Number.isInteger(durationHours)
    ? String(durationHours)
    : durationHours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const courtLabel = courtName || "this court";
  const courtNumberText =
    courtNumber && courtNumber > 1 ? `, Court ${courtNumber}` : "";

  return `New booking request for ${courtLabel}${courtNumberText} on ${date} at ${time} for ${durationLabel} hour${
    durationHours === 1 ? "" : "s"
  }.`;
};

export async function createBookingRequestConversation(
  db: Firestore,
  input: BookingConversationInput
) {
  const conversationId = `booking_${input.bookingId}`;
  const conversationRef = db.collection("conversations").doc(conversationId);
  const messageRef = conversationRef
    .collection("messages")
    .doc("booking_request");
  const bookingRef = db.collection("bookings").doc(input.bookingId);
  const now = FieldValue.serverTimestamp();
  const lastMessageText = buildBookingRequestMessage(input);

  await db.runTransaction(async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);

    transaction.set(
      conversationRef,
      {
        participantIds: [input.playerId, input.ownerId],
        playerId: input.playerId,
        playerName: input.playerName || null,
        ownerId: input.ownerId,
        ownerName: input.ownerName || null,
        courtId: input.courtId,
        courtName: input.courtName || null,
        bookingId: input.bookingId,
        bookingDate: input.date,
        bookingTime: input.time,
        bookingDurationMinutes: input.durationMinutes,
        bookingCourtNumber: input.courtNumber || 1,
        status: "booking_pending",
        lastMessageText,
        lastMessageAt: now,
        lastMessageSenderId: input.playerId,
        unreadBy: [input.ownerId],
        updatedAt: now,
        createdAt: conversationSnapshot.exists
          ? conversationSnapshot.get("createdAt") || now
          : now,
      },
      { merge: true }
    );

    transaction.set(
      messageRef,
      {
        senderId: input.playerId,
        body: lastMessageText,
        createdAt: now,
        type: "booking_request",
        bookingId: input.bookingId,
        courtId: input.courtId,
      },
      { merge: false }
    );

    transaction.update(bookingRef, {
      conversationId,
      updatedAt: now,
    });
  });

  return conversationId;
}
