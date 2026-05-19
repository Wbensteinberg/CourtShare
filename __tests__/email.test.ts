import { buildOwnerBookingNotificationEmail } from "@/lib/email";
import { theme } from "@/lib/theme";

describe("owner booking request email", () => {
  it("links hosts to the booking conversation with request and payment details", () => {
    const html = buildOwnerBookingNotificationEmail({
      bookingId: "booking-123",
      conversationId: "booking_booking-123",
      courtName: "Hilltop Tennis",
      courtAddress: "123 Court Lane",
      courtImageUrl: "https://example.com/court.jpg",
      playerName: "Karen",
      playerEmail: "karen@example.com",
      ownerName: "Host",
      ownerEmail: "host@example.com",
      date: "2026-05-18",
      time: "11:00 AM",
      duration: 1.5,
      durationMinutes: 90,
      courtNumber: 2,
      guestCount: 3,
      price: 75,
      initialMessage: "Excited to play.",
    });

    expect(html).toContain("Accept or Decline Request");
    expect(html).toContain(
      "https://courtshare.co/messages?conversationId=booking_booking-123"
    );
    expect(html).toContain("Hilltop Tennis");
    expect(html).toContain("Monday, May 18, 2026");
    expect(html).toContain("1 hour 30 minutes");
    expect(html).toContain("Court 2");
    expect(html).toContain("$75.00");
    expect(html).toContain("Card authorized");
    expect(html).toContain("charged only if you accept");
    expect(html).toContain("background-color: #00b884");
    expect(html).toContain("color: #00b884; font-size: 26px");
    expect(html).toContain(
      "linear-gradient(135deg, #0c3028 0%, #145c44 55%, #0d7a58 100%)"
    );
    expect(html).not.toContain("background: #07140f");
    expect(html).not.toContain(`background: ${theme.colors.siteAccent}; color: white; padding: 15px`);
  });
});
