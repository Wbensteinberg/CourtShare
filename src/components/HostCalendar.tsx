"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MessageCircle,
  SlidersHorizontal,
  Unlock,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TimestampLike =
  | Date
  | string
  | number
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number };

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  price?: number;
  surface?: string;
  indoor?: boolean;
  numberOfCourts?: number;
  blockedTimes?: Record<string, string[]>;
  blockedDates?: string[];
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: Record<number, string[]>;
  courtSpecificAlwaysBlockedTimes?: Record<string, string[]>;
  courtSpecificAlwaysBlockedTimesByDay?: Record<string, Record<string, string[]>>;
  maxAdvanceBookingDays?: number | null;
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  courtNumber?: number;
  createdAt?: TimestampLike;
  expiresAt?: TimestampLike;
  conversationId?: string;
  totalAmountCents?: number;
  ownerAmountCents?: number;
  courtShareFeeCents?: number;
  processingFeeCents?: number;
  expectedAmountCents?: number;
  durationMinutes?: number;
}

type BookingUserSummary = {
  displayName: string;
  profileImageUrl?: string;
};

type BookingFinancials = {
  totalAmountCents: number;
  courtShareFeeCents: number;
  processingFeeCents: number;
  ownerAmountCents: number;
};

interface HostCalendarProps {
  courts: Court[];
  bookings: Booking[];
  bookingUsers: Record<string, BookingUserSummary>;
  focusedCourtId?: string | null;
  onBlockedTimesUpdate: (
    courtId: string,
    blockedTimes: Record<string, string[]>
  ) => Promise<void> | void;
  onOpenBookingDetails: (bookingId: string) => void;
  onOpenConversation: (booking: Booking) => void;
  onAcceptBooking: (booking: Booking, court: Court) => void;
  onDeclineBooking: (booking: Booking) => void;
  getBookingFinancials: (
    booking: Booking,
    court?: Court
  ) => BookingFinancials | null;
}

const SLOT_TIMES = Array.from({ length: 16 }, (_, index) => {
  const hour = index + 6;
  return `${String(hour).padStart(2, "0")}:00`;
});

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const normalizeTime = (value: string) => {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const formatSlotLabel = (slot: string) => {
  const [hour, minute] = slot.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute || 0).padStart(2, "0")} ${period}`;
};

const getBookingDurationHours = (booking: Booking) => {
  if (typeof booking.durationMinutes === "number" && booking.durationMinutes > 0) {
    return Math.max(1, Math.ceil(booking.durationMinutes / 60));
  }
  return Math.max(1, Math.ceil(booking.duration || 1));
};

const getBookingDurationLabel = (booking: Booking) => {
  const minutes =
    typeof booking.durationMinutes === "number" && booking.durationMinutes > 0
      ? booking.durationMinutes
      : Math.round((booking.duration || 1) * 60);

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${minutes} min`;
};

const doesBookingCoverSlot = (booking: Booking, slot: string) => {
  const start = normalizeTime(booking.time);
  const startHour = Number(start.split(":")[0]);
  const slotHour = Number(slot.split(":")[0]);
  return slotHour >= startHour && slotHour < startHour + getBookingDurationHours(booking);
};

const isLiveCalendarBooking = (booking: Booking) =>
  booking.status === "confirmed" || booking.status === "pending";

const statusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-500",
  rejected: "border-red-200 bg-red-50 text-red-700",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
};

const formatStatusLabel = (status: string) => {
  if (status === "rejected") return "Declined";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function HostCalendar({
  courts,
  bookings,
  bookingUsers,
  focusedCourtId,
  onBlockedTimesUpdate,
  onOpenBookingDetails,
  onOpenConversation,
  onAcceptBooking,
  onDeclineBooking,
  getBookingFinancials,
}: HostCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all");
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [draftBlockedTimes, setDraftBlockedTimes] = useState<string[]>([]);
  const [dragMode, setDragMode] = useState<"block" | "open" | null>(null);
  const [saving, setSaving] = useState(false);

  const courtsById = useMemo(
    () => Object.fromEntries(courts.map((court) => [court.id, court])),
    [courts]
  );

  const liveBookings = useMemo(
    () => bookings.filter(isLiveCalendarBooking),
    [bookings]
  );

  const selectedCourt = selectedCourtId === "all" ? null : courtsById[selectedCourtId];
  const editorCourt = selectedCourt || courts[0] || null;
  const editorCourtNumber =
    selectedCourtNumber === "all" ? null : Number(selectedCourtNumber);

  useEffect(() => {
    if (focusedCourtId && courts.some((court) => court.id === focusedCourtId)) {
      setSelectedCourtId(focusedCourtId);
      setSelectedCourtNumber("all");
    }
  }, [focusedCourtId, courts]);

  useEffect(() => {
    if (!selectedDate || !editorCourt) return;
    const dateKey = formatDateKey(selectedDate);
    setDraftBlockedTimes([...(editorCourt.blockedTimes?.[dateKey] || [])].sort());
  }, [selectedDate, editorCourt?.id, editorCourt?.blockedTimes]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, month, index + 1)
    );
  }, [currentMonth]);

  const leadingBlankDays = monthDays[0]?.getDay() || 0;
  const trailingBlankDays =
    (7 - ((leadingBlankDays + monthDays.length) % 7)) % 7;

  const courtNumberOptions = useMemo(() => {
    if (!selectedCourt) return [];
    const count = selectedCourt.numberOfCourts || 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [selectedCourt]);

  const getUserName = (userId: string) =>
    bookingUsers[userId]?.displayName || "Player";

  const getUserImage = (userId: string) =>
    bookingUsers[userId]?.profileImageUrl || "";

  const getUserInitial = (userId: string) =>
    getUserName(userId).trim().charAt(0).toUpperCase() || "P";

  const matchesCalendarFilters = (booking: Booking) => {
    if (selectedCourtId !== "all" && booking.courtId !== selectedCourtId) {
      return false;
    }
    if (
      selectedCourtNumber !== "all" &&
      (booking.courtNumber || 1) !== Number(selectedCourtNumber)
    ) {
      return false;
    }
    return true;
  };

  const getDayBookings = (day: Date, editorOnly = false) => {
    const dateKey = formatDateKey(day);
    return liveBookings
      .filter((booking) => booking.date === dateKey)
      .filter((booking) => {
        if (editorOnly && editorCourt && booking.courtId !== editorCourt.id) {
          return false;
        }
        if (editorOnly && editorCourtNumber && (booking.courtNumber || 1) !== editorCourtNumber) {
          return false;
        }
        return editorOnly ? true : matchesCalendarFilters(booking);
      })
      .sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time)));
  };

  const getRecurringBlockedTimes = (
    court: Court | null,
    day: Date,
    courtNumber: number | null
  ) => {
    if (!court) return [];

    const dayOfWeek = day.getDay();
    const base = [
      ...(court.alwaysBlockedTimes || []),
      ...(court.alwaysBlockedTimesByDay?.[dayOfWeek] || []),
    ];

    const courtSpecific = courtNumber
      ? [
          ...(court.courtSpecificAlwaysBlockedTimes?.[String(courtNumber)] || []),
          ...(court.courtSpecificAlwaysBlockedTimesByDay?.[String(courtNumber)]?.[
            String(dayOfWeek)
          ] || []),
        ]
      : [];

    return [...new Set([...base, ...courtSpecific])].sort();
  };

  const getManualBlockedTimes = (court: Court | null, day: Date) =>
    court?.blockedTimes?.[formatDateKey(day)] || [];

  const getMonthDayAvailability = (day: Date) => {
    const scopedCourts = selectedCourt ? [selectedCourt] : courts;
    const blocked = scopedCourts.reduce((count, court) => {
      const manual = getManualBlockedTimes(court, day).length;
      const recurring = getRecurringBlockedTimes(
        court,
        day,
        selectedCourtNumber === "all" ? null : Number(selectedCourtNumber)
      ).length;
      return count + manual + recurring;
    }, 0);

    return {
      blocked,
      bookings: getDayBookings(day),
    };
  };

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : "";
  const editorRecurringBlocks = selectedDate
    ? getRecurringBlockedTimes(editorCourt, selectedDate, editorCourtNumber)
    : [];
  const editorBookings = selectedDate ? getDayBookings(selectedDate, true) : [];

  const getBookingForSlot = (slot: string) =>
    editorBookings.find((booking) => doesBookingCoverSlot(booking, slot));

  const isSlotLocked = (slot: string) =>
    Boolean(getBookingForSlot(slot)) || editorRecurringBlocks.includes(slot);

  const applySlotDraft = (slot: string, mode: "block" | "open") => {
    if (isSlotLocked(slot)) return;
    setDraftBlockedTimes((current) => {
      const next =
        mode === "block"
          ? [...new Set([...current, slot])].sort()
          : current.filter((time) => time !== slot);
      return next;
    });
  };

  const handleSlotPointerDown = (slot: string) => {
    if (isSlotLocked(slot)) return;
    const mode = draftBlockedTimes.includes(slot) ? "open" : "block";
    setDragMode(mode);
    applySlotDraft(slot, mode);
  };

  const handleSlotPointerEnter = (slot: string) => {
    if (!dragMode) return;
    applySlotDraft(slot, dragMode);
  };

  const blockAllOpenSlots = () => {
    const openSlots = SLOT_TIMES.filter((slot) => !isSlotLocked(slot));
    setDraftBlockedTimes(openSlots);
  };

  const openManualBlocks = () => setDraftBlockedTimes([]);

  const saveDayBlocks = async () => {
    if (!editorCourt || !selectedDateKey) return;

    setSaving(true);
    try {
      const nextBlockedTimes = { ...(editorCourt.blockedTimes || {}) };
      if (draftBlockedTimes.length > 0) {
        nextBlockedTimes[selectedDateKey] = [...draftBlockedTimes].sort();
      } else {
        delete nextBlockedTimes[selectedDateKey];
      }
      await onBlockedTimesUpdate(editorCourt.id, nextBlockedTimes);
      setSelectedDate(null);
    } finally {
      setSaving(false);
    }
  };

  const moveMonth = (offset: number) => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
    );
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const renderBookingChip = (booking: Booking, compact = false) => {
    const court = courtsById[booking.courtId];
    const showCourtName = selectedCourtId === "all";

    return (
      <button
        key={booking.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setSelectedBooking(booking);
        }}
        className={cn(
          "group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          statusStyles[booking.status] || "border-slate-200 bg-white text-slate-700"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            booking.status === "pending" ? "bg-amber-500" : "bg-emerald-600"
          )}
        />
        <span className="min-w-0 flex-1 truncate">
          {formatSlotLabel(normalizeTime(booking.time))} {getUserName(booking.userId)}
          {showCourtName && court?.name ? `, ${court.name}` : ""}
        </span>
        {!compact && (court?.numberOfCourts || 1) > 1 && (
          <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px]">
            C{booking.courtNumber || 1}
          </span>
        )}
      </button>
    );
  };

  const selectedBookingCourt = selectedBooking
    ? courtsById[selectedBooking.courtId]
    : null;
  const selectedBookingFinancials =
    selectedBooking && selectedBookingCourt
      ? getBookingFinancials(selectedBooking, selectedBookingCourt)
      : null;

  if (courts.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[var(--site-accent)]">
          <CalendarDays className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">
          Your calendar will live here
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Add a court listing first, then come back here to manage reservations
          and block unavailable time slots.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-gradient-to-br from-white via-emerald-50/80 to-sky-50/70 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--site-accent)]">
                Host calendar
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-emerald-200 bg-white/90 text-slate-950 shadow-sm hover:bg-emerald-50"
                  onClick={() => moveMonth(-1)}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="min-w-[11rem] text-center text-2xl font-black tracking-tight text-slate-950">
                  {monthFormatter.format(currentMonth)}
                </h3>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-emerald-200 bg-white/90 text-slate-950 shadow-sm hover:bg-emerald-50"
                  onClick={() => moveMonth(1)}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-slate-300 bg-white/90 px-4 font-bold shadow-sm hover:bg-white"
                  onClick={goToToday}
                >
                  Today
                </Button>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                See booking requests by day, open a reservation, and block or reopen
                bookable times without leaving the calendar.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:flex">
                <select
                  value={selectedCourtId}
                  onChange={(event) => {
                    setSelectedCourtId(event.target.value);
                    setSelectedCourtNumber("all");
                  }}
                  className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All courts</option>
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                </select>

                {selectedCourt && (selectedCourt.numberOfCourts || 1) > 1 && (
                  <select
                    value={selectedCourtNumber}
                    onChange={(event) => setSelectedCourtNumber(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="all">All court numbers</option>
                    {courtNumberOptions.map((courtNumber) => (
                      <option key={courtNumber} value={courtNumber}>
                        Court {courtNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-emerald-800 shadow-sm ring-1 ring-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Confirmed
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-amber-800 shadow-sm ring-1 ring-amber-100">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Request pending
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-slate-700 shadow-sm ring-1 ring-slate-200">
              <Lock className="h-3.5 w-3.5" />
              Blocked slots
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-slate-500"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 bg-slate-200 sm:grid-cols-7">
          {Array.from({ length: leadingBlankDays }).map((_, index) => (
            <div
              key={`leading-${index}`}
              className="hidden min-h-[150px] border-b border-r border-slate-200 bg-slate-50/70 sm:block sm:min-h-[166px]"
            />
          ))}
          {monthDays.map((day) => {
            const dayKey = formatDateKey(day);
            const todayKey = formatDateKey(new Date());
            const isToday = dayKey === todayKey;
            const { blocked, bookings: dayBookings } = getMonthDayAvailability(day);
            const visibleBookings = dayBookings.slice(0, 3);
            const extraBookings = dayBookings.length - visibleBookings.length;

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[142px] border-b border-r border-slate-200 bg-white p-3 text-left transition hover:bg-emerald-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--site-accent)] sm:min-h-[166px]",
                  dayBookings.length > 0 && "bg-emerald-50/40",
                  isToday && "bg-emerald-100/70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-black",
                      isToday
                        ? "bg-[var(--site-accent)] text-white"
                        : "text-slate-950"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {blocked > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                      <Lock className="h-3 w-3" />
                      {blocked}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  {visibleBookings.map((booking) => renderBookingChip(booking, true))}
                  {extraBookings > 0 && (
                    <span className="block rounded-xl bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-600">
                      +{extraBookings} more
                    </span>
                  )}
                  {dayBookings.length === 0 && (
                    <span
                      className={cn(
                        "mt-auto inline-flex rounded-full px-2.5 py-1.5 text-xs font-bold",
                        blocked > 0
                          ? "bg-slate-50 text-slate-400"
                          : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {blocked > 0 ? "No bookings" : "Open"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {Array.from({ length: trailingBlankDays }).map((_, index) => (
            <div
              key={`trailing-${index}`}
              className="hidden min-h-[150px] border-b border-r border-slate-200 bg-slate-50/70 sm:block sm:min-h-[166px]"
            />
          ))}
        </div>
      </section>

      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
          setDragMode(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[32px] border-slate-200 bg-white p-0 shadow-2xl">
          {selectedDate && (
            <div className="grid max-h-[92vh] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-h-0 flex-col">
                <div className="border-b border-slate-200 p-5 sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-950">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-[var(--site-accent)]">
                        <CalendarDays className="h-5 w-5" />
                      </span>
                      {dateFormatter.format(selectedDate)}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <select
                      value={editorCourt?.id || ""}
                      onChange={(event) => {
                        setSelectedCourtId(event.target.value);
                        setSelectedCourtNumber("all");
                      }}
                      className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-emerald-100"
                    >
                      {courts.map((court) => (
                        <option key={court.id} value={court.id}>
                          {court.name}
                        </option>
                      ))}
                    </select>

                    {editorCourt && (editorCourt.numberOfCourts || 1) > 1 && (
                      <select
                        value={selectedCourtNumber}
                        onChange={(event) => setSelectedCourtNumber(event.target.value)}
                        className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="all">All court numbers</option>
                        {Array.from(
                          { length: editorCourt.numberOfCourts || 1 },
                          (_, index) => index + 1
                        ).map((courtNumber) => (
                          <option key={courtNumber} value={courtNumber}>
                            Court {courtNumber}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-2xl border-slate-300 bg-white font-bold"
                        onClick={blockAllOpenSlots}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Block open
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-2xl border-slate-300 bg-white font-bold"
                        onClick={openManualBlocks}
                      >
                        <Unlock className="mr-2 h-4 w-4" />
                        Open manual
                      </Button>
                    </div>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"
                  onPointerLeave={() => setDragMode(null)}
                  onPointerUp={() => setDragMode(null)}
                >
                  <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                    <div className="flex items-start gap-3">
                      <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Click or drag across open slots to block or reopen them.
                        Bookings and recurring availability settings stay locked.
                        Date-specific blocks apply to this listing for the selected day.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 select-none">
                    {SLOT_TIMES.map((slot) => {
                      const booking = getBookingForSlot(slot);
                      const startsBooking =
                        booking && normalizeTime(booking.time) === slot;
                      const recurringBlocked = editorRecurringBlocks.includes(slot);
                      const manuallyBlocked = draftBlockedTimes.includes(slot);
                      const locked = recurringBlocked || Boolean(booking);

                      return (
                        <div
                          key={slot}
                          role="button"
                          tabIndex={locked ? -1 : 0}
                          onPointerDown={() => handleSlotPointerDown(slot)}
                          onPointerEnter={() => handleSlotPointerEnter(slot)}
                          className={cn(
                            "grid min-h-[56px] grid-cols-[88px_minmax(0,1fr)] items-stretch overflow-hidden rounded-2xl border text-sm transition",
                            booking
                              ? booking.status === "pending"
                                ? "border-amber-200 bg-amber-50"
                                : "border-emerald-200 bg-emerald-50"
                              : recurringBlocked
                                ? "border-slate-200 bg-slate-100 text-slate-500"
                                : manuallyBlocked
                                  ? "border-slate-300 bg-slate-800 text-white"
                                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50",
                            !locked && "cursor-pointer"
                          )}
                        >
                          <div className="flex items-center justify-center border-r border-inherit px-3 font-black">
                            {formatSlotLabel(slot)}
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                            {booking ? (
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(booking)}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                <Avatar className="h-9 w-9 shrink-0">
                                  <AvatarImage src={getUserImage(booking.userId)} />
                                  <AvatarFallback>{getUserInitial(booking.userId)}</AvatarFallback>
                                </Avatar>
                                <span className="min-w-0">
                                  <span className="block truncate font-black text-slate-950">
                                    {startsBooking
                                      ? getUserName(booking.userId)
                                      : `${getUserName(booking.userId)} continues`}
                                  </span>
                                  <span className="block truncate text-xs font-semibold text-slate-600">
                                    {startsBooking
                                      ? `${getBookingDurationLabel(booking)}${(editorCourt?.numberOfCourts || 1) > 1 ? `, Court ${booking.courtNumber || 1}` : ""}`
                                      : formatStatusLabel(booking.status)}
                                  </span>
                                </span>
                              </button>
                            ) : recurringBlocked ? (
                              <span className="inline-flex items-center gap-2 font-bold text-slate-600">
                                <Lock className="h-4 w-4" />
                                Blocked by recurring settings
                              </span>
                            ) : manuallyBlocked ? (
                              <span className="inline-flex items-center gap-2 font-bold">
                                <Lock className="h-4 w-4" />
                                Manually blocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 font-bold text-slate-500">
                                <Unlock className="h-4 w-4" />
                                Open for requests
                              </span>
                            )}

                            {booking && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0 rounded-full px-3 py-1 font-black",
                                  statusStyles[booking.status]
                                )}
                              >
                                {formatStatusLabel(booking.status)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-5 sm:p-6">
                  <div className="text-sm text-slate-500">
                    <span className="font-black text-slate-950">
                      {draftBlockedTimes.length}
                    </span>{" "}
                    manual blocks on {shortDateFormatter.format(selectedDate)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-slate-300 bg-white font-bold"
                      onClick={() => setSelectedDate(null)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="rounded-2xl bg-[var(--site-accent)] font-bold text-white hover:bg-[var(--site-accent-hover)]"
                      onClick={saveDayBlocks}
                      disabled={saving || !editorCourt}
                    >
                      {saving ? "Saving..." : "Save availability"}
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 p-5 lg:border-l lg:border-t-0 sm:p-6">
                <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Reservations
                </h4>
                <div className="mt-4 space-y-3">
                  {editorBookings.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
                      No requests or confirmed reservations on this day.
                    </div>
                  ) : (
                    editorBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getUserImage(booking.userId)} />
                            <AvatarFallback>{getUserInitial(booking.userId)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black text-slate-950">
                              {getUserName(booking.userId)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {formatSlotLabel(normalizeTime(booking.time))} for{" "}
                              {getBookingDurationLabel(booking)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-black",
                              statusStyles[booking.status]
                            )}
                          >
                            {formatStatusLabel(booking.status)}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-slate-300 bg-white font-bold"
                            onClick={() => setSelectedBooking(booking)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-slate-300 bg-white font-bold"
                            onClick={() => onOpenConversation(booking)}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Message
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedBooking}
        onOpenChange={(open) => {
          if (!open) setSelectedBooking(null);
        }}
      >
        <DialogContent className="max-w-xl rounded-[32px] border-slate-200 bg-white p-0 shadow-2xl">
          {selectedBooking && selectedBookingCourt && (
            <div>
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-3xl bg-slate-100">
                    {selectedBookingCourt.imageUrl ? (
                      <Image
                        src={selectedBookingCourt.imageUrl}
                        alt={selectedBookingCourt.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                        Court
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogHeader>
                      <DialogTitle className="truncate text-2xl font-black tracking-tight text-slate-950">
                        {selectedBookingCourt.name}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1 font-black",
                          statusStyles[selectedBooking.status]
                        )}
                      >
                        {formatStatusLabel(selectedBooking.status)}
                      </Badge>
                      {(selectedBookingCourt.numberOfCourts || 1) > 1 && (
                        <Badge variant="outline" className="rounded-full px-3 py-1 font-black">
                          Court {selectedBooking.courtNumber || 1}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={getUserImage(selectedBooking.userId)} />
                      <AvatarFallback>{getUserInitial(selectedBooking.userId)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-black text-slate-950">
                        {getUserName(selectedBooking.userId)}
                      </p>
                      <p className="text-sm font-semibold text-slate-500">Player</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <Clock className="mb-3 h-5 w-5 text-[var(--site-accent)]" />
                    <p className="text-sm font-semibold text-slate-500">When</p>
                    <p className="mt-1 font-black text-slate-950">
                      {dateFormatter.format(parseDateKey(selectedBooking.date))}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {formatSlotLabel(normalizeTime(selectedBooking.time))} for{" "}
                      {getBookingDurationLabel(selectedBooking)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <UserRound className="mb-3 h-5 w-5 text-[var(--site-accent)]" />
                    <p className="text-sm font-semibold text-slate-500">Host payout</p>
                    <p className="mt-1 font-black text-slate-950">
                      {selectedBookingFinancials
                        ? moneyFormatter.format(selectedBookingFinancials.ownerAmountCents / 100)
                        : "Not available"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      Player pays{" "}
                      {selectedBookingFinancials
                        ? moneyFormatter.format(selectedBookingFinancials.totalAmountCents / 100)
                        : "TBD"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-300 bg-white font-bold"
                    onClick={() => onOpenBookingDetails(selectedBooking.id)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-300 bg-white font-bold"
                    onClick={() => onOpenConversation(selectedBooking)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Message
                  </Button>
                </div>

                {selectedBooking.status === "pending" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      className="rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                      onClick={() => {
                        setSelectedBooking(null);
                        onAcceptBooking(selectedBooking, selectedBookingCourt);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      className="rounded-2xl bg-red-600 font-bold text-white hover:bg-red-700"
                      onClick={() => {
                        setSelectedBooking(null);
                        onDeclineBooking(selectedBooking);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
