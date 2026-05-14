import {
  bookingTimeRangesOverlap,
  isBookingBlockingSlot,
} from "@/lib/bookingConflicts";

describe("booking conflict helpers", () => {
  const now = new Date("2026-05-14T12:00:00");
  const requested = {
    date: "2026-05-20",
    time: "10:30 AM",
    durationMinutes: 60,
    courtNumber: 1,
  };

  it("detects minute-level overlaps", () => {
    expect(bookingTimeRangesOverlap("10:30 AM", 60, "11:00 AM", 60)).toBe(true);
    expect(bookingTimeRangesOverlap("10:30 AM", 30, "11:00 AM", 60)).toBe(false);
  });

  it("blocks overlapping actionable pending bookings", () => {
    expect(
      isBookingBlockingSlot(
        {
          date: requested.date,
          time: "10:00 AM",
          durationMinutes: 60,
          status: "pending",
          courtNumber: 1,
          createdAt: now,
        },
        requested,
        now
      )
    ).toBe(true);
  });

  it("blocks overlapping confirmed bookings", () => {
    expect(
      isBookingBlockingSlot(
        {
          date: requested.date,
          time: "11:00 AM",
          durationMinutes: 60,
          status: "confirmed",
          courtNumber: 1,
        },
        requested,
        now
      )
    ).toBe(true);
  });

  it("ignores expired or inactive requests", () => {
    const expiredAt = new Date(now.getTime() - 60_000);
    const baseBooking = {
      date: requested.date,
      time: "10:00 AM",
      durationMinutes: 60,
      courtNumber: 1,
    };

    expect(
      isBookingBlockingSlot(
        { ...baseBooking, status: "pending", expiresAt: expiredAt },
        requested,
        now
      )
    ).toBe(false);
    expect(
      isBookingBlockingSlot(
        { ...baseBooking, status: "rejected" },
        requested,
        now
      )
    ).toBe(false);
    expect(
      isBookingBlockingSlot(
        { ...baseBooking, status: "cancelled" },
        requested,
        now
      )
    ).toBe(false);
  });

  it("only blocks the selected court number", () => {
    expect(
      isBookingBlockingSlot(
        {
          date: requested.date,
          time: "10:00 AM",
          durationMinutes: 60,
          status: "confirmed",
          courtNumber: 2,
        },
        requested,
        now
      )
    ).toBe(false);
  });
});
