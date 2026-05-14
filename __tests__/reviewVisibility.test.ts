import { shouldShowPublicReview } from "@/lib/reviewVisibility";

describe("public review visibility", () => {
  it("shows player reviews even before the paired player-authored review exists", () => {
    expect(
      shouldShowPublicReview(
        { bookingId: "booking-1", reviewerRole: "owner", targetType: "player" },
        false
      )
    ).toBe(true);
  });

  it("keeps host and court reviews gated on paired reviews", () => {
    expect(
      shouldShowPublicReview(
        { bookingId: "booking-1", reviewerRole: "player", targetType: "court_owner" },
        false
      )
    ).toBe(false);
    expect(
      shouldShowPublicReview(
        { bookingId: "booking-1", reviewerRole: "player", targetType: "court_owner" },
        true
      )
    ).toBe(true);
  });
});
