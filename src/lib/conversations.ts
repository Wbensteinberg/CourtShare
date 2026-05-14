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
  guestCount?: number;
  initialMessage?: string;
};

type BookingPaymentReleaseStatus =
  | "authorization_released"
  | "refunded"
  | "no_payment";

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

export const getConversationIdForBooking = (
  bookingId: string,
  conversationId?: string
) => {
  const normalizedConversationId =
    typeof conversationId === "string" ? conversationId.trim() : "";
  return normalizedConversationId || `booking_${bookingId}`;
};

const formatBookingConversationDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

export const getBookingPaymentStatusText = (
  status?: BookingPaymentReleaseStatus
) => {
  if (status === "refunded") {
    return "A refund has been issued to the original payment method.";
  }

  if (status === "authorization_released") {
    return "The card authorization has been released. The player was not charged.";
  }

  if (status === "no_payment") {
    return "No payment was collected for this booking.";
  }

  return "";
};

export const buildBookingStatusMessage = (
  input: Pick<
    BookingStatusConversationInput,
    | "courtName"
    | "date"
    | "time"
    | "status"
    | "cancelledBy"
    | "declineReason"
    | "paymentStatus"
  >
) => {
  const courtLabel = input.courtName || "this court";
  const bookingTime = `on ${formatBookingConversationDate(input.date)} at ${input.time}`;

  if (input.status === "accepted") {
    return `Booking confirmed for ${courtLabel} ${bookingTime}. Payment is complete.`;
  }

  const paymentText = getBookingPaymentStatusText(input.paymentStatus);
  const suffix = paymentText ? ` ${paymentText}` : "";

  if (input.status === "declined") {
    const reason = input.declineReason?.trim();
    const reasonText = reason ? ` Reason from the host: ${reason}` : "";
    return `Booking request declined for ${courtLabel} ${bookingTime}.${reasonText}${suffix}`;
  }

  const actorText =
    input.cancelledBy === "host"
      ? "by the host"
      : input.cancelledBy === "player"
        ? "by the player"
        : "";

  return `Booking cancelled${actorText ? ` ${actorText}` : ""} for ${courtLabel} ${bookingTime}.${suffix}`;
};

export const getBookingConversationStatus = (
  status: BookingStatusConversationInput["status"]
) => (status === "accepted" ? "confirmed" : "closed");

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

  return { conversationId, messageId: messageRef.id, body };
}
