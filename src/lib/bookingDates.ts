export type BookingDateParts = {
  date: string;
  time: string;
};

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

export const PENDING_BOOKING_ACCEPTANCE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const BOOKING_REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const parseBookingDateTime = (dateStr: string, timeStr: string): Date => {
  const [timePart = "0:0", period] = timeStr.trim().split(/\s+/);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);
  let hour24 = hours;

  if (period === "PM" && hours !== 12) {
    hour24 = hours + 12;
  } else if (period === "AM" && hours === 12) {
    hour24 = 0;
  }

  return new Date(
    `${dateStr}T${hour24.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`
  );
};

export const getBookingCreatedAtDate = (
  createdAt?: Date | string | number | TimestampLike | null
): Date | null => {
  if (!createdAt) return null;

  if (createdAt instanceof Date) {
    return Number.isNaN(createdAt.getTime()) ? null : createdAt;
  }

  if (typeof createdAt === "string" || typeof createdAt === "number") {
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof createdAt.toDate === "function") {
    const parsed = createdAt.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof createdAt.seconds === "number") {
    const parsed = new Date(
      createdAt.seconds * 1000 +
        Math.floor((createdAt.nanoseconds || 0) / 1_000_000)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const getPendingBookingExpiresAtDate = (
  booking: {
    createdAt?: Date | string | number | TimestampLike | null;
    expiresAt?: Date | string | number | TimestampLike | null;
  }
): Date | null => {
  const explicitExpiration = getBookingCreatedAtDate(booking.expiresAt);
  if (explicitExpiration) return explicitExpiration;

  const createdAt = getBookingCreatedAtDate(booking.createdAt);
  if (!createdAt) return null;

  return new Date(createdAt.getTime() + PENDING_BOOKING_ACCEPTANCE_WINDOW_MS);
};

export const formatPendingBookingTimeRemaining = (
  booking: {
    createdAt?: Date | string | number | TimestampLike | null;
    expiresAt?: Date | string | number | TimestampLike | null;
  },
  now = new Date()
): string | null => {
  const expiresAt = getPendingBookingExpiresAtDate(booking);
  if (!expiresAt) return null;

  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return "Expired";

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 1) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m left`;
  }

  return `${minutes}m left`;
};

export const isPendingBookingExpired = (
  booking: BookingDateParts & {
    status: string;
    createdAt?: Date | string | number | TimestampLike | null;
    expiresAt?: Date | string | number | TimestampLike | null;
  },
  now = new Date()
): boolean => {
  if (booking.status !== "pending") return false;

  try {
    if (parseBookingDateTime(booking.date, booking.time) < now) {
      return true;
    }
  } catch {
    return true;
  }

  const explicitExpiration = getBookingCreatedAtDate(booking.expiresAt);
  if (explicitExpiration) {
    return explicitExpiration <= now;
  }

  const createdAt = getBookingCreatedAtDate(booking.createdAt);
  if (!createdAt) return false;

  return now.getTime() - createdAt.getTime() >= PENDING_BOOKING_ACCEPTANCE_WINDOW_MS;
};

export const isActionablePendingBooking = (
  booking: BookingDateParts & {
    status: string;
    createdAt?: Date | string | number | TimestampLike | null;
    expiresAt?: Date | string | number | TimestampLike | null;
  },
  now = new Date()
): boolean =>
  booking.status === "pending" && !isPendingBookingExpired(booking, now);

export const formatBookingDateWithDay = (dateStr: string): string => {
  const date = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${dayOfWeek}, ${formatted}`;
};

export const formatBookingDateLong = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const isBookingCancellable = (
  booking: BookingDateParts,
  minimumLeadMinutes = 60
): boolean => {
  try {
    const bookingDateTime = parseBookingDateTime(booking.date, booking.time);
    const cutoff = new Date(Date.now() + minimumLeadMinutes * 60 * 1000);
    return bookingDateTime >= cutoff;
  } catch {
    return false;
  }
};

export const getBookingEndDateTime = (
  booking: BookingDateParts & {
    duration?: number;
    durationMinutes?: number;
  }
): Date => {
  const start = parseBookingDateTime(booking.date, booking.time);
  const durationMinutes =
    typeof booking.durationMinutes === "number"
      ? booking.durationMinutes
      : Math.round((booking.duration || 1) * 60);

  return new Date(start.getTime() + durationMinutes * 60 * 1000);
};

export const isBookingReviewable = (
  booking: BookingDateParts & {
    status: string;
    duration?: number;
    durationMinutes?: number;
  },
  now = new Date()
): boolean => {
  if (booking.status !== "confirmed" && booking.status !== "completed") return false;

  try {
    const end = getBookingEndDateTime(booking);
    const elapsed = now.getTime() - end.getTime();
    return elapsed >= 0 && elapsed <= BOOKING_REVIEW_WINDOW_MS;
  } catch {
    return false;
  }
};

export const isPastOrInactiveBooking = (
  booking: BookingDateParts & { status: string },
  now = new Date()
): boolean => {
  try {
    return (
      parseBookingDateTime(booking.date, booking.time) < now ||
      booking.status === "cancelled" ||
      booking.status === "rejected" ||
      booking.status === "expired" ||
      booking.status === "completed"
    );
  } catch {
    return true;
  }
};

export const isActiveFutureBooking = (
  booking: BookingDateParts & { status: string },
  now = new Date()
): boolean => {
  try {
    return (
      parseBookingDateTime(booking.date, booking.time) >= now &&
      booking.status !== "cancelled" &&
      booking.status !== "rejected" &&
      booking.status !== "expired" &&
      booking.status !== "completed"
    );
  } catch {
    return false;
  }
};

export const sortBookingsAscending = <T extends BookingDateParts>(
  a: T,
  b: T
): number =>
  parseBookingDateTime(a.date, a.time).getTime() -
  parseBookingDateTime(b.date, b.time).getTime();

export const sortBookingsDescending = <T extends BookingDateParts>(
  a: T,
  b: T
): number =>
  parseBookingDateTime(b.date, b.time).getTime() -
  parseBookingDateTime(a.date, a.time).getTime();
