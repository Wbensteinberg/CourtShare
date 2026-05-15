export type BookingPaymentReleaseStatus =
  | "authorization_released"
  | "refunded"
  | "no_payment";

export type PaymentStatusAudience = "neutral" | "player" | "host";

export type BuildBookingStatusMessageInput = {
  courtName?: string;
  date: string;
  time: string;
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

export const formatBookingConversationDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

export const getBookingPaymentStatusText = (
  status?: BookingPaymentReleaseStatus,
  audience: PaymentStatusAudience = "neutral"
) => {
  if (status === "refunded") {
    return audience === "player"
      ? "A refund has been issued to your original payment method."
      : "A refund has been issued to the original payment method.";
  }

  if (status === "authorization_released") {
    if (audience === "player") {
      return "Your card authorization has been released. You were not charged.";
    }

    if (audience === "host") {
      return "The card authorization has been released. The player was not charged.";
    }

    return "The card authorization has been released. No charge was made.";
  }

  if (status === "no_payment") {
    return "No payment was collected for this booking.";
  }

  return "";
};

export const buildBookingStatusMessage = (
  input: BuildBookingStatusMessageInput
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
    return `Booking request declined for ${courtLabel} ${bookingTime}.${reasonText}`;
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
  status: BuildBookingStatusMessageInput["status"]
) => (status === "accepted" ? "confirmed" : "closed");
