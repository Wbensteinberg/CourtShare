import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  buildBookingStatusMessage,
  formatBookingConversationDate,
  getBookingConversationStatus,
  getConversationIdForBooking,
} from "@/lib/bookingConversationCopy";
import type { BookingPaymentReleaseStatus } from "@/lib/bookingConversationCopy";

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
  guestCount?: number;
  initialMessage?: string;
};

type BookingStatusConversationInput = {
  bookingId: string;
  conversationId?: string;
  courtId: string;
  courtName?: string;
  playerId: string;
  playerName?: string;
  ownerId: string;
  ownerName?: string;
  actorId: string;
  date: string;
  time: string;
  durationMinutes?: number;
  courtNumber?: number;
  status: "accepted" | "declined" | "cancelled";
  cancelledBy?: "player" | "host";
  declineReason?: string;
  paymentStatus?: BookingPaymentReleaseStatus;
};

const buildBookingRequestMessage = ({
  courtName,
  date,
  time,
  durationMinutes,
  courtNumber,
  guestCount,
}: BookingConversationInput) => {
  const formattedDate = formatBookingConversationDate(date);
  const durationHours = durationMinutes / 60;
  const durationLabel = Number.isInteger(durationHours)
    ? String(durationHours)
    : durationHours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const courtLabel = courtName || "this court";
  const courtNumberText =
    courtNumber && courtNumber > 1 ? `, Court ${courtNumber}` : "";

  const guestText = guestCount && guestCount > 1 ? ` for ${guestCount} guests` : "";

  return `New booking request for ${courtLabel}${courtNumberText} on ${formattedDate} at ${time} for ${durationLabel} hour${
    durationHours === 1 ? "" : "s"
  }${guestText}.`;
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
  const initialMessage = input.initialMessage?.trim().slice(0, 1000) || "";

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
	        lastMessageText: initialMessage || lastMessageText,
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

	    if (initialMessage) {
	      transaction.set(
	        conversationRef.collection("messages").doc("initial_message"),
	        {
	          senderId: input.playerId,
	          body: initialMessage,
	          createdAt: now,
	          type: "text",
	          bookingId: input.bookingId,
	          courtId: input.courtId,
	        },
	        { merge: false }
	      );
	    }

    transaction.update(bookingRef, {
      conversationId,
      updatedAt: now,
    });
  });

  return conversationId;
}

export async function postBookingStatusConversationMessage(
  db: Firestore,
  input: BookingStatusConversationInput
) {
  const conversationId = getConversationIdForBooking(
    input.bookingId,
    input.conversationId
  );
  const conversationRef = db.collection("conversations").doc(conversationId);
  const bookingRef = db.collection("bookings").doc(input.bookingId);
  const messageRef = conversationRef
    .collection("messages")
    .doc(`booking_${input.status}`);
  const now = FieldValue.serverTimestamp();
  const body = buildBookingStatusMessage(input);
  const participantIds = [input.playerId, input.ownerId].filter(
    (id): id is string => Boolean(id)
  );
  const unreadBy = participantIds.filter((id) => id !== input.actorId);

  await db.runTransaction(async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);

    transaction.set(
      conversationRef,
      {
        participantIds,
        playerId: input.playerId,
        playerName: input.playerName || null,
        ownerId: input.ownerId,
        ownerName: input.ownerName || null,
        courtId: input.courtId,
        courtName: input.courtName || null,
        bookingId: input.bookingId,
        bookingDate: input.date,
        bookingTime: input.time,
        ...(typeof input.durationMinutes === "number"
          ? { bookingDurationMinutes: input.durationMinutes }
          : {}),
        ...(typeof input.courtNumber === "number"
          ? { bookingCourtNumber: input.courtNumber }
          : {}),
        status: getBookingConversationStatus(input.status),
        lastMessageText: body,
        lastMessageAt: now,
        lastMessageSenderId: input.actorId,
        unreadBy,
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
        senderId: input.actorId,
        body,
        createdAt: now,
        type: "booking_status",
        bookingId: input.bookingId,
        courtId: input.courtId,
        status: input.status,
        ...(input.cancelledBy ? { cancelledBy: input.cancelledBy } : {}),
        ...(input.declineReason ? { declineReason: input.declineReason } : {}),
        ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
      },
      { merge: false }
    );

    transaction.update(bookingRef, {
      conversationId,
      updatedAt: now,
    });
  });

  return {
    conversationId,
    messageId: messageRef.id,
    body,
    status: input.status,
    ...(input.declineReason ? { declineReason: input.declineReason } : {}),
    ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
  };
}
