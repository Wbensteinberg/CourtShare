"use client";

import type { ReactNode } from "react";
import CourtBookingBookingMode from "@/components/CourtBookingBookingMode";

type CourtBookingDetailUnifiedProps = {
  bookingId?: string;
  children?: ReactNode;
};

export default function CourtBookingDetailUnified({
  bookingId,
  children,
}: CourtBookingDetailUnifiedProps) {
  if (bookingId) {
    return <CourtBookingBookingMode bookingId={bookingId} />;
  }

  // Avoid a silent blank screen if a route forgets to pass `bookingId`.
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[CourtBookingDetailUnified] No bookingId and no children — nothing to render."
    );
  }

  return <>{children}</>;
}

