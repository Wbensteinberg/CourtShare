import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { postBookingStatusConversationMessage } from "@/lib/conversations";
import { sendPlayerRejectionNotification } from "@/lib/email";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockRejectBookingPOST } from "@/lib/mockApiServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return mockRejectBookingPOST(req);
    }

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
      const decodedToken = await adminAuth.verifyIdToken(idToken, true);
      userId = decodedToken.uid;
    } catch (err: any) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }

    const { bookingId, declineReason } = await req.json();
    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const cleanDeclineReason =
      typeof declineReason === "string" ? declineReason.trim().slice(0, 1000) : "";
    if (!cleanDeclineReason) {
      return NextResponse.json(
        { error: "A decline reason is required" },
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
        { error: "Only the court host can reject bookings" },
        { status: 403 }
      );
    }

    if (bookingData.status === "rejected") {
      return NextResponse.json(
        { error: "Booking is already rejected" },
        { status: 400 }
      );
    }

    const releasedPayment = await releaseBookingPayment(
      stripe,
      bookingData.sessionId,
      bookingId,
      "host_rejection"
    );

    // Update booking status
    await adminDb.collection("bookings").doc(bookingId).update({
      status: "rejected",
      cancelReason: "host_rejection",
      declineReason: cleanDeclineReason,
      rejectedAt: new Date(),
      paymentStatus: releasedPayment.paymentStatus,
      ...(releasedPayment.refundId ? { refundId: releasedPayment.refundId } : {}),
    });

    const [playerDoc, ownerDoc] = await Promise.all([
      adminDb.collection("users").doc(bookingData.userId).get(),
      adminDb.collection("users").doc(userId).get(),
    ]);
    const playerData = playerDoc.exists ? playerDoc.data() : null;
    const ownerData = ownerDoc.exists ? ownerDoc.data() : null;
    const price =
      typeof bookingData.totalAmountCents === "number"
        ? bookingData.totalAmountCents / 100
        : (courtData?.price || 0) * (bookingData.duration || 1);

    let conversationMessage:
      | Awaited<ReturnType<typeof postBookingStatusConversationMessage>>
      | undefined;

    try {
      conversationMessage = await postBookingStatusConversationMessage(adminDb, {
        bookingId,
        conversationId: bookingData.conversationId,
        courtId: bookingData.courtId,
        courtName: courtData?.name || "Court",
        playerId: bookingData.userId,
        playerName: playerData?.displayName || playerData?.name,
        ownerId: userId,
        ownerName: ownerData?.displayName || ownerData?.name,
        actorId: userId,
        date: bookingData.date,
        time: bookingData.time,
        durationMinutes:
          typeof bookingData.durationMinutes === "number"
            ? bookingData.durationMinutes
            : Math.round((bookingData.duration || 1) * 60),
        courtNumber: bookingData.courtNumber || 1,
        status: "declined",
        declineReason: cleanDeclineReason,
        paymentStatus: releasedPayment.paymentStatus,
      });
    } catch (conversationErr: any) {
      console.warn(
        "[REJECT-BOOKING] Failed to post conversation status message:",
        conversationErr.message || conversationErr
      );
    }

    // Send email to player (non-blocking)
    try {
      if (playerData?.email) {
        await sendPlayerRejectionNotification({
          courtName: courtData?.name || "Court",
          playerEmail: playerData.email,
          playerName: playerData.displayName || playerData.name,
          date: bookingData.date,
          time: bookingData.time,
          duration: bookingData.duration || 1,
          price,
          paymentStatus: releasedPayment.paymentStatus,
          declineReason: cleanDeclineReason,
        });
      }
    } catch (emailErr: any) {
      console.warn("[REJECT-BOOKING] Failed to send player email:", emailErr.message);
    }

    return NextResponse.json({ success: true, conversationMessage });
  } catch (err: any) {
    console.error("[REJECT-BOOKING] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to reject booking" },
      { status: 500 }
    );
  }
}
