import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isActionablePendingBooking } from "@/lib/bookingDates";
import { sendPlayerBookingConfirmation } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const db = adminDb;

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    const ownerId = decodedToken.uid;

    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingData = bookingDoc.data();
    if (!bookingData || bookingData.status !== "pending") {
      return NextResponse.json(
        { error: "Booking is no longer pending" },
        { status: 400 }
      );
    }

    const courtDoc = await db.collection("courts").doc(bookingData.courtId).get();
    const courtData = courtDoc.exists ? courtDoc.data() : null;
    if (!courtData || courtData.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "Only the court owner can accept this booking" },
        { status: 403 }
      );
    }

    if (!isActionablePendingBooking(bookingData as Parameters<typeof isActionablePendingBooking>[0])) {
      await bookingRef.update({
        status: "expired",
        expiredAt: new Date(),
      });
      return NextResponse.json(
        { error: "This booking request has expired" },
        { status: 409 }
      );
    }

    let paymentIntentId = bookingData.paymentIntentId as string | undefined;
    if (!paymentIntentId && bookingData.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(bookingData.sessionId);
      paymentIntentId = session.payment_intent as string | undefined;
    }

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "No payment authorization found for this booking" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === "requires_capture") {
      await stripe.paymentIntents.capture(paymentIntentId);
    } else if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Payment cannot be captured while ${paymentIntent.status}` },
        { status: 409 }
      );
    }

    await bookingRef.update({
      status: "confirmed",
      paymentStatus: "captured",
      paymentIntentId,
      capturedAt: new Date(),
      confirmedAt: new Date(),
    });

    try {
      const playerDoc = await db.collection("users").doc(bookingData.userId).get();
      const ownerDoc = await db.collection("users").doc(ownerId).get();
      const playerData = playerDoc.exists ? playerDoc.data() : null;
      const ownerData = ownerDoc.exists ? ownerDoc.data() : null;
      const price =
        typeof bookingData.totalAmountCents === "number"
          ? bookingData.totalAmountCents / 100
          : (courtData.price || 0) * (bookingData.duration || 1);

      if (playerData?.email) {
        await sendPlayerBookingConfirmation({
          bookingId,
          courtName: courtData.name || "Court",
          courtAddress: courtData.address || courtData.location,
          playerName: playerData.displayName || playerData.name,
          playerEmail: playerData.email,
          ownerName: ownerData?.displayName || ownerData?.name,
          ownerEmail: ownerData?.email || "",
          date: bookingData.date,
          time: bookingData.time,
          duration: bookingData.duration || 1,
          price,
        });
      }
    } catch (emailError) {
      console.warn("[ACCEPT-BOOKING] Failed to send confirmation email:", emailError);
    }

    return NextResponse.json({ success: true, paymentStatus: "captured" });
  } catch (err: any) {
    console.error("[ACCEPT-BOOKING] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to accept booking" },
      { status: 500 }
    );
  }
}
