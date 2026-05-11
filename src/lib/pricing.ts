export const COURTSHARE_COMMISSION_RATE = 0.08;
export const STRIPE_US_CARD_PERCENT = 0.029;
export const STRIPE_US_CARD_FIXED_CENTS = 30;
export const PLATFORM_FEE_BUFFER_CENTS = 2;

export type BookingPriceBreakdown = {
  ownerAmountCents: number;
  courtShareFeeCents: number;
  processingFeeCents: number;
  applicationFeeCents: number;
  totalAmountCents: number;
};

export function calculateBookingPriceBreakdown(
  pricePerHour: number,
  durationMinutes: number
): BookingPriceBreakdown {
  const totalAmountCents = Math.round(
    (pricePerHour * 100 * durationMinutes) / 60
  );
  const courtShareFeeCents = Math.ceil(
    totalAmountCents * COURTSHARE_COMMISSION_RATE
  );
  const processingFeeCents = Math.ceil(
    totalAmountCents * STRIPE_US_CARD_PERCENT +
      STRIPE_US_CARD_FIXED_CENTS +
      PLATFORM_FEE_BUFFER_CENTS
  );
  const ownerAmountCents = Math.max(
    0,
    totalAmountCents - courtShareFeeCents - processingFeeCents
  );

  return {
    ownerAmountCents,
    courtShareFeeCents,
    processingFeeCents,
    applicationFeeCents: courtShareFeeCents + processingFeeCents,
    totalAmountCents,
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
