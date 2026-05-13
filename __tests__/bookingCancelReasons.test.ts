import { formatBookingCancelReason } from "@/lib/bookingCancelReasons";

describe("formatBookingCancelReason", () => {
  it.each([
    ["host_cancellation", "The host cancelled this booking."],
    ["player_cancellation", "The player cancelled this booking."],
    ["host_rejection", "The host declined this booking request."],
    [
      "host_acceptance_window_expired",
      "The host did not respond within the 24-hour acceptance window.",
    ],
  ])("formats known cancel reason %s", (reason, expected) => {
    expect(formatBookingCancelReason(reason)).toBe(expected);
  });

  it("keeps unknown human-entered reasons intact", () => {
    expect(formatBookingCancelReason("Weather issue")).toBe("Weather issue");
  });

  it("makes unknown code-like reasons readable", () => {
    expect(formatBookingCancelReason("payment_release_failed")).toBe(
      "Payment release failed"
    );
  });
});
