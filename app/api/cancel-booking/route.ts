import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { isBookingCancellable } from "@/lib/bookingDates";
import { postBookingStatusConversationMessage } from "@/lib/conversations";
import {
  sendOwnerCancellationNotification,
  sendPlayerCancellationConfirmation,
  sendPlayerHostCancellationNotification,
} from "@/lib/email";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockCancelBookingPOST } from "@/lib/mockApiServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return mockCancelBookingPOST(req);
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
    const isPlayerCancellation = bookingData.userId === userId;
    const isHostCancellation = courtData?.ownerId === userId;

    if (!isPlayerCancellation && !isHostCancellation) {
      return NextResponse.json(
        { error: "Only the player or court host can cancel this booking" },
        { status: 403 }
      );
    }

    if (bookingData.status === "cancelled") {
      return NextResponse.json(
        { error: "Booking is already cancelled" },
        { status: 400 }
      );
    }

    if (
      isPlayerCancellation &&
      bookingData.status === "confirmed" &&
      !isBookingCancellable(
        {
          date: String(bookingData.date || ""),
          time: String(bookingData.time || ""),
        },
        24 * 60
      )
    ) {
      return NextResponse.json(
        { error: "Confirmed bookings can only be cancelled at least 24 hours before court time" },
        { status: 400 }
      );
    }

    const cancelReason = isHostCancellation
      ? "host_cancellation"
      : "player_cancellation";

    const releasedPayment = await releaseBookingPayment(
      stripe,
      bookingData.sessionId,
      bookingId,
      cancelReason
    );

    // Update booking status
    await adminDb.collection("bookings").doc(bookingId).update({
      status: "cancelled",
      cancelReason,
      cancelledAt: new Date(),
      paymentStatus: releasedPayment.paymentStatus,
      ...(releasedPayment.refundId ? { refundId: releasedPayment.refundId } : {}),
    });

    const [ownerDoc, playerDoc] = await Promise.all([
      courtData?.ownerId
        ? adminDb.collection("users").doc(courtData.ownerId).get()
        : Promise.resolve(null),
      adminDb.collection("users").doc(bookingData.userId).get(),
    ]);
    const ownerData = ownerDoc?.exists ? ownerDoc.data() : null;
    const playerData = playerDoc.exists ? playerDoc.data() : null;
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
        ownerId: courtData?.ownerId || "",
        ownerName: ownerData?.displayName || ownerData?.name,
        actorId: userId,
        date: bookingData.date,
        time: bookingData.time,
        durationMinutes:
          typeof bookingData.durationMinutes === "number"
            ? bookingData.durationMinutes
            : Math.round((bookingData.duration || 1) * 60),
        courtNumber: bookingData.courtNumber || 1,
        status: "cancelled",
        cancelledBy: isHostCancellation ? "host" : "player",
        paymentStatus: releasedPayment.paymentStatus,
      });
    } catch (conversationErr: any) {
      console.warn(
        "[CANCEL-BOOKING] Failed to post conversation status message:",
        conversationErr.message || conversationErr
      );
    }

    // Send cancellation emails (fire-and-forget, each independent)
    const emailBase = {
      courtName: courtData?.name || "Court",
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration || 1,
      price,
      paymentStatus: releasedPayment.paymentStatus,
    };
    if (isPlayerCancellation && ownerData?.email) {
      sendOwnerCancellationNotification({
        ...emailBase,
        ownerEmail: ownerData.email,
        ownerName: ownerData.displayName || ownerData.name,
        playerName: playerData?.displayName || playerData?.name || playerData?.email,
      }).catch((e: any) =>
        console.warn("[CANCEL-BOOKING] Owner notification email failed:", e.message)
      );
    }
    if (isPlayerCancellation && playerData?.email) {
      sendPlayerCancellationConfirmation({
        ...emailBase,
        playerEmail: playerData.email,
        playerName: playerData.displayName || playerData.name,
      }).catch((e: any) =>
        console.warn("[CANCEL-BOOKING] Player cancellation confirmation email failed:", e.message)
      );
    }
    if (isHostCancellation && playerData?.email) {
      sendPlayerHostCancellationNotification({
        ...emailBase,
        playerEmail: playerData.email,
        playerName: playerData.displayName || playerData.name,
      }).catch((e: any) =>
        console.warn("[CANCEL-BOOKING] Player host cancellation notification email failed:", e.message)
      );
    }

    return NextResponse.json({ success: true, conversationMessage });
  } catch (err: any) {
    console.error("[CANCEL-BOOKING] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to cancel booking" },
      { status: 500 }
    );
  }
}
