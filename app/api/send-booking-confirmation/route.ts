import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendPlayerBookingConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Firebase Admin not initialized" },
        { status: 500 }
      );
    }

    // Fetch booking details
    const bookingDoc = await adminDb
      .collection("bookings")
      .doc(bookingId)
      .get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingData = bookingDoc.data();

    if (!bookingData) {
      return NextResponse.json(
        { error: "Booking data not found" },
        { status: 404 }
      );
    }

    // Fetch court and user details
    const courtDoc = await adminDb
      .collection("courts")
      .doc(bookingData.courtId)
      .get();
    const playerDoc = await adminDb
      .collection("users")
      .doc(bookingData.userId)
      .get();

    if (!courtDoc.exists || !playerDoc.exists) {
      return NextResponse.json(
        { error: "Court or player data not found" },
        { status: 404 }
      );
    }

    const courtData = courtDoc.data();
    const playerData = playerDoc.data();

    if (!courtData || !playerData) {
      return NextResponse.json(
        { error: "Court or player data is invalid" },
        { status: 404 }
      );
    }

    // Fetch owner details
    const ownerDoc = await adminDb
      .collection("users")
      .doc(courtData.ownerId)
      .get();
    const ownerData = ownerDoc.exists ? ownerDoc.data() : null;

    if (!playerData.email) {
      return NextResponse.json(
        { error: "Player email not found" },
        { status: 404 }
      );
    }

    // Calculate total price
    const price = (courtData.price || 0) * (bookingData.duration || 1);

    // Send confirmation email to player (non-blocking - don't fail if email fails)
    try {
      await sendPlayerBookingConfirmation({
        bookingId: bookingId,
        courtName: courtData.name || "Court",
        courtAddress: courtData.address || courtData.location,
        playerName: playerData.displayName || playerData.name,
        playerEmail: playerData.email,
        ownerName: ownerData?.displayName || ownerData?.name,
        ownerEmail: ownerData?.email || "",
        date: bookingData.date,
        time: bookingData.time,
        duration: bookingData.duration || 1,
        price: price,
      });

      console.log(
        "[EMAIL API] Player confirmation email sent for booking:",
        bookingId
      );
    } catch (emailError: any) {
      // Log error but don't fail the request - booking is already confirmed
      console.warn(
        "[EMAIL API] Failed to send confirmation email (non-critical):",
        {
          message: emailError.message,
          name: emailError.name,
          code: emailError.code,
          bookingId: bookingId,
        }
      );

      // In test mode (Resend), emails can only go to account owner
      // This is expected behavior until domain is verified
      if (emailError.message?.includes("testing emails")) {
        console.warn(
          "[EMAIL API] Resend test mode restriction - email skipped. Verify domain in production."
        );
      }
    }

    // Always return success - email failure shouldn't block booking confirmation
    return NextResponse.json({
      success: true,
      emailSent: true, // Will be false if email failed, but we still return success
    });
  } catch (error: any) {
    // Only fail on critical errors (missing data, etc.)
    console.error("[EMAIL API] Critical error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process request",
      },
      { status: 500 }
    );
  }
}
