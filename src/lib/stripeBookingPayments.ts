import Stripe from "stripe";

export type ReleasedBookingPayment = {
  paymentIntentId: string | null;
  paymentStatus: "authorization_released" | "refunded" | "no_payment";
  refundId?: string;
};

export async function releaseBookingPayment(
  stripe: Stripe,
  sessionId: string | undefined,
  bookingId: string,
  reason: string
): Promise<ReleasedBookingPayment> {
  if (!sessionId) {
    return { paymentIntentId: null, paymentStatus: "no_payment" };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paymentIntentId = session.payment_intent as string | null;
  if (!paymentIntentId) {
    return { paymentIntentId: null, paymentStatus: "no_payment" };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "requires_capture") {
    await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: "requested_by_customer",
    });
    return {
      paymentIntentId,
      paymentStatus: "authorization_released",
    };
  }

  if (paymentIntent.status === "succeeded") {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: { bookingId, reason },
    });
    return {
      paymentIntentId,
      paymentStatus: "refunded",
      refundId: refund.id,
    };
  }

  return { paymentIntentId, paymentStatus: "no_payment" };
}
