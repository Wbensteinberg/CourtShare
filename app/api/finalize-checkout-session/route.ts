import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createBookingFromPaidCheckoutSession } from "@/lib/bookingCreation";
import { sendOwnerBookingNotification } from "@/lib/email";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockFinalizeCheckoutSessionPOST } from "@/lib/mockApiServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  if (isMockApiMode()) {
    return mockFinalizeCheckoutSessionPOST(req);
  }

  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  let userId: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(
      authHeader.split("Bearer ")[1],
      true
    );
    userId = decodedToken.uid;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  const { sessionId } = await req.json().catch(() => ({ sessionId: "" }));
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "Missing checkout session" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.userId !== userId) {
      return NextResponse.json(
        { error: "Checkout session does not belong to this user" },
        { status: 403 }
      );
    }

    if (session.status !== "complete") {
      return NextResponse.json(
        {
          error: "Checkout has not completed yet",
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
        },
        { status: 409 }
      );
    }

    const result = await createBookingFromPaidCheckoutSession(adminDb, session);

    if (result.status === "created") {
      try {
        const bookingDoc = await adminDb
          .collection("bookings")
          .doc(result.bookingId)
          .get();
        const bookingData = bookingDoc.exists ? bookingDoc.data() : null;

        if (bookingData) {
          const [courtDoc, playerDoc] = await Promise.all([
            adminDb.collection("courts").doc(bookingData.courtId).get(),
            adminDb.collection("users").doc(bookingData.userId).get(),
          ]);
          const courtData = courtDoc.exists ? courtDoc.data() : null;
          const playerData = playerDoc.exists ? playerDoc.data() : null;
          const ownerId = bookingData.ownerId || courtData?.ownerId;
          const ownerDoc = ownerId
            ? await adminDb.collection("users").doc(ownerId).get()
            : null;
          const ownerData = ownerDoc?.exists ? ownerDoc.data() : null;
          const duration =
            typeof bookingData.duration === "number"
              ? bookingData.duration
              : typeof bookingData.durationMinutes === "number"
                ? bookingData.durationMinutes / 60
                : 1;
          const price =
            typeof bookingData.totalAmountCents === "number"
              ? bookingData.totalAmountCents / 100
              : (courtData?.price || 0) * duration;

          if (courtData && ownerData?.email) {
            await sendOwnerBookingNotification({
              bookingId: result.bookingId,
              conversationId: result.conversationId,
              courtName: courtData.name || "Court",
              courtAddress: courtData.address || courtData.location,
              courtLocation: courtData.location,
              courtImageUrl:
                Array.isArray(courtData.imageUrls) && courtData.imageUrls[0]
                  ? courtData.imageUrls[0]
                  : courtData.imageUrl,
              playerName: playerData?.displayName || playerData?.name,
              playerEmail: playerData?.email || session.customer_email || userId,
              ownerName: ownerData.displayName || ownerData.name,
              ownerEmail: ownerData.email,
              date: bookingData.date,
              time: bookingData.time,
              duration,
              durationMinutes:
                typeof bookingData.durationMinutes === "number"
                  ? bookingData.durationMinutes
                  : undefined,
              courtNumber:
                typeof bookingData.courtNumber === "number"
                  ? bookingData.courtNumber
                  : undefined,
              guestCount:
                typeof bookingData.guestCount === "number"
                  ? bookingData.guestCount
                  : undefined,
              price,
              playerProfileImageUrl: playerData?.profileImageUrl,
              ownerAmount:
                typeof bookingData.ownerAmountCents === "number"
                  ? bookingData.ownerAmountCents / 100
                  : undefined,
              initialMessage: bookingData.initialMessage || "",
            });
          }
        }
      } catch (emailError: any) {
        console.warn(
          "[FINALIZE CHECKOUT] Failed to send host booking request email:",
          emailError?.message || emailError
        );
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[FINALIZE CHECKOUT] Failed:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to finalize booking" },
      { status: 500 }
    );
  }
}
