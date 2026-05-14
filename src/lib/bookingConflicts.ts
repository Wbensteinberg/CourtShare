import { isActionablePendingBooking } from "@/lib/bookingDates";

type BookingLike = {
  date: string;
  time: string;
  status: string;
  courtNumber?: number;
  duration?: number;
  durationMinutes?: number;
  createdAt?: unknown;
  expiresAt?: unknown;
};

const timeToMinutes = (timeValue: string): number => {
  const trimmed = timeValue.trim();
  const [timePart = "", periodPart] = trimmed.split(/\s+/);
  const [rawHours, rawMinutes = 0] = timePart.split(":").map(Number);

  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) {
    return Number.NaN;
  }

  const period = periodPart?.toUpperCase();
  let hours = rawHours;
  if (period === "PM" && rawHours !== 12) {
    hours += 12;
  } else if (period === "AM" && rawHours === 12) {
    hours = 0;
  }

  return hours * 60 + rawMinutes;
};

export const bookingTimeRangesOverlap = (
  start1: string,
  durationMinutes1: number,
  start2: string,
  durationMinutes2: number
): boolean => {
  const startMinutes1 = timeToMinutes(start1);
  const startMinutes2 = timeToMinutes(start2);

  if (
    !Number.isFinite(startMinutes1) ||
    !Number.isFinite(startMinutes2) ||
    !Number.isFinite(durationMinutes1) ||
    !Number.isFinite(durationMinutes2)
  ) {
    return false;
  }

  const endMinutes1 = startMinutes1 + durationMinutes1;
  const endMinutes2 = startMinutes2 + durationMinutes2;

  return startMinutes1 < endMinutes2 && startMinutes2 < endMinutes1;
};

export const getBookingDurationMinutes = (
  booking: Pick<BookingLike, "duration" | "durationMinutes">
): number => {
  if (
    typeof booking.durationMinutes === "number" &&
    Number.isFinite(booking.durationMinutes)
  ) {
    return booking.durationMinutes;
  }

  return Math.round((Number(booking.duration) || 1) * 60);
};

export const isBookingBlockingSlot = (
  booking: BookingLike,
  requested: {
    date: string;
    time: string;
    durationMinutes: number;
    courtNumber?: number;
  },
  now = new Date()
): boolean => {
  if (booking.date !== requested.date) return false;

  const bookingCourtNumber = booking.courtNumber || 1;
  const requestedCourtNumber = requested.courtNumber || 1;
  if (bookingCourtNumber !== requestedCourtNumber) return false;

  const statusBlocks =
    booking.status === "confirmed" ||
    isActionablePendingBooking(booking as Parameters<typeof isActionablePendingBooking>[0], now);

  if (!statusBlocks) return false;

  return bookingTimeRangesOverlap(
    requested.time,
    requested.durationMinutes,
    booking.time,
    getBookingDurationMinutes(booking)
  );
};
