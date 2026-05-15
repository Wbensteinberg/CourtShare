import {
  buildBookingStatusMessage,
  getBookingConversationStatus,
  getBookingPaymentStatusText,
} from "@/lib/bookingConversationCopy";

describe("booking conversation status messages", () => {
  const baseInput = {
    courtName: "Hilltop Tennis",
    date: "2026-06-15",
    time: "9:00 AM",
  };

  it("builds accepted copy with completed-payment language", () => {
    expect(
      buildBookingStatusMessage({
        ...baseInput,
        status: "accepted",
      })
    ).toBe(
      "Booking confirmed for Hilltop Tennis on Monday, June 15, 2026 at 9:00 AM. Payment is complete."
    );
  });

  it("builds declined copy without payment language in the main message", () => {
    expect(
      buildBookingStatusMessage({
        ...baseInput,
        status: "declined",
        paymentStatus: "authorization_released",
        declineReason: "I am unable to host this booking request.",
      })
    ).toBe(
      "Booking request declined for Hilltop Tennis on Monday, June 15, 2026 at 9:00 AM. Reason from the host: I am unable to host this booking request."
    );
  });

  it("builds cancelled copy with refund language", () => {
    expect(
      buildBookingStatusMessage({
        ...baseInput,
        status: "cancelled",
        cancelledBy: "host",
        paymentStatus: "refunded",
      })
    ).toBe(
      "Booking cancelled by the host for Hilltop Tennis on Monday, June 15, 2026 at 9:00 AM. A refund has been issued to the original payment method."
    );
  });

  it("maps payment and conversation statuses", () => {
    expect(getBookingPaymentStatusText("no_payment")).toBe(
      "No payment was collected for this booking."
    );
    expect(getBookingPaymentStatusText("authorization_released", "player")).toBe(
      "Your card authorization has been released. You were not charged."
    );
    expect(getBookingConversationStatus("accepted")).toBe("confirmed");
    expect(getBookingConversationStatus("declined")).toBe("closed");
    expect(getBookingConversationStatus("cancelled")).toBe("closed");
  });
});
