import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendPlayerRejectionNotification } from "@/lib/email";

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

    const idToken = authHeader.split("Bearer ")[1];
    let userId: string;
    try {
      if (!adminAuth) {
        return NextResponse.json(
          { error: "Authentication service not initialized" },
          { status: 500 }
        );
      }
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      userId = decodedToken.uid;
    } catch (err: any) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const bookingDoc = await adminDb.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const bookingData = bookingDoc.data()!;
    const courtDoc = await adminDb
      .collection("courts")
      .doc(bookingData.courtId)
      .get();
    const courtData = courtDoc.exists ? courtDoc.data() : null;

    if (!courtData || courtData.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the court owner can reject bookings" },
        { status: 403 }
      );
    }

    if (bookingData.status === "rejected") {
      return NextResponse.json(
        { error: "Booking is already rejected" },
        { status: 400 }
      );
    }

    const sessionId = bookingData.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Booking has no payment session - cannot refund" },
        { status: 400 }
      );
    }

    // Retrieve Stripe session to get payment_intent
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = session.payment_intent as string;
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "No payment found for this booking" },
        { status: 400 }
      );
    }

    // Create refund
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        bookingId,
        reason: "owner_rejection",
      },
    });

    // Update booking status
    await adminDb.collection("bookings").doc(bookingId).update({
      status: "rejected",
      rejectedAt: new Date(),
    });

    // Send email to player (non-blocking)
    try {
      const playerDoc = await adminDb
        .collection("users")
        .doc(bookingData.userId)
        .get();
      const playerData = playerDoc.exists ? playerDoc.data() : null;
      const price =
        (courtData?.price || 0) * (bookingData.duration || 1);

      if (playerData?.email) {
        await sendPlayerRejectionNotification({
          courtName: courtData?.name || "Court",
          playerEmail: playerData.email,
          playerName: playerData.displayName || playerData.name,
          date: bookingData.date,
          time: bookingData.time,
          duration: bookingData.duration || 1,
          price,
        });
      }
    } catch (emailErr: any) {
      console.warn("[REJECT-BOOKING] Failed to send player email:", emailErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[REJECT-BOOKING] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to reject booking" },
      { status: 500 }
    );
  }
}
