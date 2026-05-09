import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createBookingFromPaidCheckoutSession } from "@/lib/bookingCreation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
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
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[FINALIZE CHECKOUT] Failed:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to finalize booking" },
      { status: 500 }
    );
  }
}
