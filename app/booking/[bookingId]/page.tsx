import CourtBookingDetailUnified from "@/components/CourtBookingDetailUnified";

export default async function BookingRoutePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <CourtBookingDetailUnified bookingId={bookingId} />;
}

