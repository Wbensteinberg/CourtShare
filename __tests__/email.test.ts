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

    expect(html).toContain("Respond to Karen's request");
    expect(html).toContain(
      "https://courtshare.co/messages?conversationId=booking_booking-123"
    );
    expect(html).toContain("Hilltop Tennis");
    expect(html).toContain("Monday, May 18, 2026");
    expect(html).toContain("1 hour 30 minutes");
    expect(html).toContain("Court 2");
    expect(html).toContain("$75.00");
    expect(html).toContain("Their payment method is authorized");
    expect(html).toContain("The player has not been charged yet");
    expect(html).toContain(`background: ${theme.colors.brandGreen}; color: white; padding: 15px`);
    expect(html).toContain(`color: ${theme.colors.brandGreen}; font-size: 34px`);
    expect(html).not.toContain(`background: ${theme.colors.siteAccent}; color: white; padding: 15px`);
  });
});
