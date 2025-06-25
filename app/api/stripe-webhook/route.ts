import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";

// Initialize Stripe with your secret key (set in .env.local)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

// Stripe webhook signing secret (set in .env.local)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

// Firebase config (use env vars, not NEXT_PUBLIC_*)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase app only once
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function POST(req: NextRequest) {
  console.log(
    "[WEBHOOK] Stripe webhook POST handler called at",
    new Date().toISOString()
  );
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;

  // Read the raw body for signature verification
  const rawBody = await req.text();

  try {
    if (!sig || !endpointSecret) {
      console.error("[WEBHOOK] Missing Stripe signature or webhook secret");
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
        const bookingData = {
          courtId: metadata.courtId,
          userId: metadata.userId,
          date: metadata.date,
          time: metadata.time,
          duration: Number(metadata.duration) || 1,
          status: "pending",
          createdAt: new Date(),
          sessionId: session.id,
        };
        console.log("[WEBHOOK] Booking data to write:", bookingData);
        await addDoc(collection(db, "bookings"), bookingData);
        console.log(
          "[WEBHOOK] Booking created in Firestore for session:",
          session.id
        );
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
