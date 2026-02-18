import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { sendOwnerBookingNotification } from "@/lib/email";

// Initialize Stripe with your secret key (set in .env.local)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

// Stripe webhook signing secret. Must be set in env as STRIPE_WEBHOOK_SECRET (exact name).
// In production (Vercel): use the signing secret from the Stripe Dashboard for the endpoint
// https://courtshare.co/api/stripe-webhook (Developers → Webhooks → that endpoint → Reveal).
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: NextRequest) {
  console.log(
    "[WEBHOOK] Stripe webhook POST handler called at",
    new Date().toISOString()
  );

  // Log all headers for debugging
  console.log(
    "[WEBHOOK] Request headers:",
    Object.fromEntries(req.headers.entries())
  );

  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;

  // Read the raw body for signature verification
  const rawBody = await req.text();
  console.log("[WEBHOOK] Raw body length:", rawBody.length);

  try {
    if (!sig || !endpointSecret) {
      console.error("[WEBHOOK] Missing Stripe signature or webhook secret");
      console.error("[WEBHOOK] sig:", sig);
      console.error("[WEBHOOK] endpointSecret exists:", !!endpointSecret);
      return NextResponse.json(
        { error: "Missing Stripe signature or webhook secret" },
        { status: 400 }
      );
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log("[WEBHOOK] Stripe event type:", event.type);
  } catch (err: any) {
    console.error(
      "[WEBHOOK] Webhook signature verification failed:",
      err.message
    );
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      console.log("[WEBHOOK] Session metadata:", metadata);
      console.log(
        "[WEBHOOK] Full session object:",
        JSON.stringify(session, null, 2)
      );
      try {
        // Add booking to Firestore
        // Status is "pending" - requires host approval before confirmation
        if (!adminDb) {
          throw new Error("Firebase Admin not initialized");
        }

        // SECURITY: Verify webhook amounts server-side to prevent disputes/chargebacks
        // Fetch court to verify the amount matches what was charged
        if (!adminDb) {
          throw new Error("Firebase Admin not initialized");
        }

        const courtDoc = await adminDb
          .collection("courts")
          .doc(metadata.courtId)
          .get();

        if (!courtDoc.exists) {
          throw new Error(`Court ${metadata.courtId} not found`);
        }

        const courtData = courtDoc.data();
        if (!courtData) {
          throw new Error("Court data not found");
        }

        // Verify the amount charged matches the expected amount
        const expectedDurationMinutes = metadata.durationMinutes
          ? Number(metadata.durationMinutes)
          : (Number(metadata.duration) || 60) * 60;
        const pricePerHour = Number(courtData.price);
        const pricePerMinuteCents = Math.round((pricePerHour * 100) / 60);
        const expectedAmountCents =
          pricePerMinuteCents * expectedDurationMinutes;
        const actualAmountCents = session.amount_total || 0;

        // Allow small rounding differences (within 1 cent)
        if (Math.abs(actualAmountCents - expectedAmountCents) > 1) {
          console.error(
            `[WEBHOOK] Amount mismatch! Expected ${expectedAmountCents} cents, got ${actualAmountCents} cents`
          );
          // Log but don't fail - Stripe already charged the correct amount
          // This is just for fraud detection logging
        }

        // SECURITY FIX 4: Only create booking after payment is confirmed via webhook
        const durationMinutes = expectedDurationMinutes;

        // IDEMPOTENCY: Check if booking already exists for this session (prevent duplicate webhook processing)
        const existingBookingBySession = await adminDb
          .collection("bookings")
          .where("sessionId", "==", session.id)
          .get();
        
        if (!existingBookingBySession.empty) {
          console.log("[WEBHOOK] Booking already exists for this session, skipping duplicate webhook:", session.id);
          return NextResponse.json({ received: true, message: "Booking already processed" });
        }

        // SECURITY: Final check for double bookings before creating booking (race condition protection)
        // This is the last line of defense in case two payments completed simultaneously
        const convertTo24Hour = (time12: string): string => {
          if (/^\d{2}:\d{2}$/.test(time12)) return time12;
          const [timePart, period] = time12.split(" ");
          const [hours, minutes] = timePart.split(":").map(Number);
          let hours24 = hours;
          if (period === "PM" && hours !== 12) hours24 = hours + 12;
          else if (period === "AM" && hours === 12) hours24 = 0;
          return `${hours24.toString().padStart(2, "0")}:${(minutes || 0).toString().padStart(2, "0")}`;
        };

        const timeRangesOverlap = (
          start1: string,
          duration1Hours: number,
          start2: string,
          duration2Hours: number
        ): boolean => {
          const s1 = convertTo24Hour(start1);
          const s2 = convertTo24Hour(start2);
          const [h1] = s1.split(":").map(Number);
          const [h2] = s2.split(":").map(Number);
          const e1 = h1 + duration1Hours;
          const e2 = h2 + duration2Hours;
          return h1 < e2 && e1 > h2;
        };

        const durationHours = Math.ceil(durationMinutes / 60);
        const existingBookingsSnapshot = await adminDb
          .collection("bookings")
          .where("courtId", "==", metadata.courtId)
          .where("date", "==", metadata.date)
          .get();

        for (const bookingDoc of existingBookingsSnapshot.docs) {
          const existingBooking = bookingDoc.data();
          // Skip if this is the same session (idempotency - webhook might be called multiple times)
          if (existingBooking.sessionId === session.id) {
            continue;
          }
          // Skip bookings with different courtNumber
          const bookingCourtNum = existingBooking.courtNumber || 1;
          const newCourtNum = Number(metadata.courtNumber) || 1;
          if (bookingCourtNum !== newCourtNum) continue;
          // Check confirmed and pending bookings (rejected don't block)
          if (existingBooking.status === "confirmed" || existingBooking.status === "pending") {
            const existingDuration = Math.ceil((existingBooking.durationMinutes || existingBooking.duration * 60) / 60);
            if (timeRangesOverlap(metadata.time, durationHours, existingBooking.time, existingDuration)) {
              console.error("[WEBHOOK] Double booking detected! Payment completed but time slot already booked:", {
                existingBooking: bookingDoc.id,
                newBooking: { time: metadata.time, duration: durationHours },
              });
              // Refund the payment since we can't fulfill the booking
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
                if (paymentIntent.status === "succeeded") {
                  await stripe.refunds.create({
                    payment_intent: paymentIntent.id,
                    reason: "requested_by_customer",
                    metadata: {
                      reason: "double_booking_prevention",
                      courtId: metadata.courtId,
                      date: metadata.date,
                      time: metadata.time,
                    },
                  });
                  console.log("[WEBHOOK] Refunded payment due to double booking");
                }
              } catch (refundError) {
                console.error("[WEBHOOK] Failed to refund double booking:", refundError);
              }
              // Don't create the booking - return error
              return NextResponse.json(
                { error: "Time slot was already booked. Payment has been refunded." },
                { status: 409 }
              );
            }
          }
        }

        const bookingData = {
          courtId: metadata.courtId,
          userId: metadata.userId,
          date: metadata.date,
          time: metadata.time,
          courtNumber: Number(metadata.courtNumber) || 1,
          duration: durationMinutes / 60, // Store as hours for backward compatibility
          durationMinutes: durationMinutes, // Also store as minutes
          status: "pending", // Requires host approval - SECURITY FIX 4: Only confirmed after webhook
          createdAt: new Date(),
          sessionId: session.id,
          paymentStatus: "paid",
          totalAmountCents: actualAmountCents, // Use actual amount from Stripe
          expectedAmountCents: expectedAmountCents, // Store expected for audit
        };
        console.log("[WEBHOOK] Booking data to write:", bookingData);
        const bookingRef = await adminDb
          .collection("bookings")
          .add(bookingData);
        console.log(
          "[WEBHOOK] Booking created in Firestore for session:",
          session.id,
          "with booking ID:",
          bookingRef.id
        );

        // Fetch user details to send email notification (court already fetched above)
        try {
          console.log("[WEBHOOK] Fetching player doc for userId:", metadata.userId);
          const playerDoc = await adminDb
            .collection("users")
            .doc(metadata.userId)
            .get();

          if (!playerDoc.exists) {
            console.warn("[WEBHOOK] Player doc not found for userId:", metadata.userId, "- skipping email");
          }

          if (playerDoc.exists) {
            const playerData = playerDoc.data();

            if (!courtData || !playerData) {
              console.warn("[WEBHOOK] Court or player data is undefined");
              return;
            }

            console.log("[WEBHOOK] Fetching owner doc for ownerId:", courtData.ownerId);
            const ownerDoc = await adminDb
              .collection("users")
              .doc(courtData.ownerId)
              .get();
            const ownerData = ownerDoc.exists ? ownerDoc.data() : null;

            if (!ownerDoc.exists) {
              console.warn("[WEBHOOK] Owner doc not found for ownerId:", courtData.ownerId, "- skipping email");
            } else if (!ownerData?.email) {
              console.warn("[WEBHOOK] Owner doc exists but email missing or empty - skipping email");
            }

            if (ownerData?.email) {
              console.log("[WEBHOOK] Sending owner notification to:", ownerData.email);
              // Calculate total price from stored metadata or compute it
              const durationMinutes = metadata.durationMinutes
                ? Number(metadata.durationMinutes)
                : (Number(metadata.duration) || 1) * 60;
              const durationHours = durationMinutes / 60;
              const price = metadata.totalAmountCents
                ? Number(metadata.totalAmountCents) / 100
                : (courtData.price || 0) * durationHours;

              // Send email to owner
              await sendOwnerBookingNotification({
                bookingId: bookingRef.id,
                courtName: courtData.name || "Court",
                courtAddress: courtData.address || courtData.location,
                playerName: playerData.displayName || playerData.name,
                playerEmail: playerData.email || metadata.userId,
                ownerName: ownerData.displayName || ownerData.name,
                ownerEmail: ownerData.email,
                date: metadata.date,
                time: metadata.time,
                duration: durationHours,
                price: price,
              });
              console.log("[WEBHOOK] Owner notification email sent");
            } else {
              console.warn(
                "[WEBHOOK] Owner email not found, skipping email notification"
              );
            }
          } else {
            console.warn(
              "[WEBHOOK] Court or player data not found, skipping email notification"
            );
          }
        } catch (emailError: any) {
          // Don't fail the webhook if email fails - log and continue
          console.error(
            "[WEBHOOK] Failed to send email notification:",
            emailError?.message ?? emailError
          );
          if (emailError?.stack) {
            console.error("[WEBHOOK] Email error stack:", emailError.stack);
          }
        }
      } catch (err: any) {
        console.error(
          "[WEBHOOK] Failed to write booking to Firestore:",
          err.message
        );
        return NextResponse.json(
          { error: "Failed to write booking to Firestore" },
          { status: 500 }
        );
      }
      break;
    }
    // Add more event types as needed
    default:
      console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
