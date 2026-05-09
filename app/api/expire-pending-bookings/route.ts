import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isPendingBookingExpired } from "@/lib/bookingDates";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";

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

    const { bookingIds } = await req.json();
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json({ expiredBookingIds: [] });
    }

    const expiredBookingIds: string[] = [];

    await Promise.all(
      bookingIds.map(async (bookingId) => {
        if (typeof bookingId !== "string") return;

        const bookingRef = db.collection("bookings").doc(bookingId);
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) return;

        const bookingData = bookingDoc.data();
        if (!bookingData || bookingData.status !== "pending") return;

        const courtDoc = await db
          .collection("courts")
          .doc(bookingData.courtId)
          .get();
        const courtData = courtDoc.exists ? courtDoc.data() : null;
        if (!courtData || courtData.ownerId !== ownerId) return;

        if (!isPendingBookingExpired(bookingData as Parameters<typeof isPendingBookingExpired>[0])) {
          return;
        }

        const releasedPayment = await releaseBookingPayment(
          stripe,
          bookingData.sessionId,
          bookingId,
          "owner_acceptance_window_expired"
        );

        await bookingRef.update({
          status: "expired",
          expiredAt: new Date(),
          paymentStatus: releasedPayment.paymentStatus,
          ...(releasedPayment.refundId
            ? { refundId: releasedPayment.refundId }
            : {}),
        });
        expiredBookingIds.push(bookingId);
      })
    );

    return NextResponse.json({ expiredBookingIds });
  } catch (err: any) {
    console.error("[EXPIRE-PENDING-BOOKINGS] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to expire pending bookings" },
      { status: 500 }
    );
  }
}
