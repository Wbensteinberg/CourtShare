import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isPendingBookingExpired } from "@/lib/bookingDates";
import { releaseBookingPayment } from "@/lib/stripeBookingPayments";
import { sendPlayerBookingExpiredNotification } from "@/lib/email";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockExpirePendingBookingsPOST } from "@/lib/mockApiServer";
import {
  enforceRateLimit,
  isNextResponse,
  requireFirebaseUser,
  validateMutationOrigin,
} from "@/lib/apiSecurity";
import { expirePendingBookingsBodySchema, parseJsonBody } from "@/lib/apiSchemas";
import { releaseBookingSlotLocks } from "@/lib/bookingSlotLocks";
import { writeSecurityAuditLog } from "@/lib/securityAudit";
import { sendOpsAlert } from "@/lib/opsAlerts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return mockExpirePendingBookingsPOST(req);
    }

    const originError = validateMutationOrigin(req);
    if (originError) return originError;

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const db = adminDb;

    const auth = await requireFirebaseUser(req, adminAuth);
    if (isNextResponse(auth)) return auth;
    const ownerId = auth.uid;

    const rateLimitError = await enforceRateLimit(req, "expire-pending", ownerId);
    if (rateLimitError) return rateLimitError;

    const parsedBody = await parseJsonBody(req, expirePendingBookingsBodySchema);
    if (isNextResponse(parsedBody)) return parsedBody;
    const { bookingIds } = parsedBody;
    if (bookingIds.length === 0) {
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

        let releasedPayment: Awaited<ReturnType<typeof releaseBookingPayment>>;
        try {
          releasedPayment = await releaseBookingPayment(
            stripe,
            bookingData.sessionId,
            bookingId,
            "owner_acceptance_window_expired"
          );
        } catch (releaseErr: any) {
          await sendOpsAlert(
            "PAYMENT RELEASE FAILED (expire)",
            `bookingId=${bookingId} courtId=${bookingData.courtId} error=${releaseErr?.message ?? String(releaseErr)}`
          );
          throw releaseErr;
        }

        await bookingRef.update({
          status: "expired",
          cancelReason: "host_acceptance_window_expired",
          expiredAt: new Date(),
          paymentStatus: releasedPayment.paymentStatus,
          ...(releasedPayment.refundId
            ? { refundId: releasedPayment.refundId }
            : {}),
        });
        await releaseBookingSlotLocks(db, { ...bookingData, status: "expired" });
        await writeSecurityAuditLog(db, "booking_expired_by_host_view", {
          actorId: ownerId,
          bookingId,
          courtId: bookingData.courtId,
          paymentStatus: releasedPayment.paymentStatus,
        });

        try {
          const playerDoc = await db
            .collection("users")
            .doc(bookingData.userId)
            .get();
          const playerData = playerDoc.exists ? playerDoc.data() : null;
          const price =
            typeof bookingData.totalAmountCents === "number"
              ? bookingData.totalAmountCents / 100
              : (courtData.price || 0) * (bookingData.duration || 1);

          if (playerData?.email) {
            await sendPlayerBookingExpiredNotification({
              courtName: courtData.name || "Court",
              playerEmail: playerData.email,
              playerName: playerData.displayName || playerData.name,
              date: bookingData.date,
              time: bookingData.time,
              duration: bookingData.duration || 1,
              price,
              paymentStatus: releasedPayment.paymentStatus,
            });
          }
        } catch (emailErr: any) {
          console.warn(
            "[EXPIRE-PENDING-BOOKINGS] Failed to send expiration email:",
            emailErr.message || emailErr
          );
        }

        expiredBookingIds.push(bookingId);
      })
    );

    return NextResponse.json({ expiredBookingIds });
  } catch (err: any) {
    console.error("[EXPIRE-PENDING-BOOKINGS] Error:", err);
    return NextResponse.json(
      { error: "Failed to expire pending bookings" },
      { status: 500 }
    );
  }
}
