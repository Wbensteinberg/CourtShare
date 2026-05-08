export type BookingDateParts = {
  date: string;
  time: string;
};

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

export const isPastOrInactiveBooking = (
  booking: BookingDateParts & { status: string },
  now = new Date()
): boolean => {
  try {
    return (
      parseBookingDateTime(booking.date, booking.time) < now ||
      booking.status === "cancelled" ||
      booking.status === "rejected"
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
      booking.status !== "rejected"
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
