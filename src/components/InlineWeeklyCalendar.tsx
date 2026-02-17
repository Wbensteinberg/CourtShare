"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import DayDetailModal from "./DayDetailModal";

interface Booking {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  userId: string;
}

interface InlineWeeklyCalendarProps {
  courtId: string;
  blockedTimes?: { [date: string]: string[] };
  blockedDates?: string[];
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: { [dayOfWeek: number]: string[] };
  maxAdvanceBookingDays?: number | null;
  bookings?: Booking[];
  bookingUsers?: Record<string, string>;
  onBlockedTimesUpdate?: (blockedTimes: { [date: string]: string[] }) => void;
  onBookingUpdate?: (bookingId: string, status: string) => void;
}

export default function InlineWeeklyCalendar({
  courtId,
  blockedTimes = {},
  blockedDates = [],
  alwaysBlockedTimes = [],
  alwaysBlockedTimesByDay = {},
  maxAdvanceBookingDays = null,
  bookings = [],
  bookingUsers = {},
  onBlockedTimesUpdate,
  onBookingUpdate,
}: InlineWeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the start of the week (Sunday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Generate calendar days for the week
  const calendarDays = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const days: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get week range for display
  const weekRange = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startMonth = monthNames[weekStart.getMonth()];
    const endMonth = monthNames[weekEnd.getMonth()];
    
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    } else {
      return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    }
  }, [currentDate]);

  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  const formatDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // Convert 12-hour time to 24-hour format
  const convertTo24Hour = (time12: string): string => {
    if (/^\d{2}:\d{2}$/.test(time12)) {
      return time12;
    }
    const [time, period] = time12.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let hours24 = hours;
    if (period === "PM" && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === "AM" && hours === 12) {
      hours24 = 0;
    }
    return `${hours24.toString().padStart(2, "0")}:${(minutes || 0).toString().padStart(2, "0")}`;
  };

  // Convert 24-hour time to 12-hour format
  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${(minutes || 0).toString().padStart(2, "0")} ${period}`;
  };

  // Get all blocked times for a day (date-specific + always + day-of-week)
  const getDayBlockedTimes = (day: Date): string[] => {
    const dateKey = formatDateKey(day);
    const dateSpecific = blockedTimes[dateKey] || [];
    const dayOfWeek = day.getDay();
    const daySpecific = alwaysBlockedTimesByDay[dayOfWeek] || [];
    const allBlocked = [
      ...new Set([...dateSpecific, ...alwaysBlockedTimes, ...daySpecific]),
    ];
    return allBlocked.sort();
  };

  const getDayBlockedCount = (day: Date): number => {
    return getDayBlockedTimes(day).length;
  };

  const isDayFullyBlocked = (day: Date): boolean => {
    const dateKey = formatDateKey(day);
    return blockedDates.includes(dateKey);
  };

  const isBeyondBookingWindow = (day: Date): boolean => {
    if (maxAdvanceBookingDays == null || typeof maxAdvanceBookingDays !== "number") return false;
    const dateOnly = new Date(day);
    dateOnly.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceBookingDays);
    return dateOnly > maxDate;
  };

  const getDayBookings = (day: Date): Booking[] => {
    const dateKey = formatDateKey(day);
    return bookings.filter((booking) => booking.date === dateKey);
  };

  const isToday = (day: Date): boolean => {
    return (
      day.getDate() === today.getDate() &&
      day.getMonth() === today.getMonth() &&
      day.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (day: Date): boolean => {
    return day < today;
  };

  // Time range: 6 AM to 9 PM = 16 one-hour slots
  const TIME_SLOTS = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  const SLOT_COUNT = 16; // 6 AM to 9 PM
  const SLOT_HEIGHT_PCT = 100 / SLOT_COUNT;

  return (
    <>
      <div className="border-t border-gray-100 pt-6 mt-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {weekRange}
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousWeek}
              className="rounded-full border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextWeek}
              className="rounded-full border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day Names Header */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-600 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weekly Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const blockedTimesForDay = getDayBlockedTimes(day);
            const blockedCount = blockedTimesForDay.length;
            const dayBookings = getDayBookings(day);
            const pendingCount = dayBookings.filter(
              (b) => b.status === "pending"
            ).length;
            const dayIsToday = isToday(day);
            const dayIsPast = isPast(day);
            const dayFullyBlocked = isDayFullyBlocked(day);
            const dayBeyondWindow = isBeyondBookingWindow(day);
            const dayUnavailable = dayFullyBlocked || dayBeyondWindow;

            return (
              <button
                key={day.toISOString()}
                onClick={() => !dayIsPast && !dayBeyondWindow && handleDayClick(day)}
                disabled={dayIsPast}
                className={`
                  min-h-[360px] rounded-xl p-3 flex flex-col items-start
                  transition-all duration-200
                  ${
                    dayIsPast
                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                      : dayBeyondWindow
                      ? "bg-gray-100 border-2 border-gray-300 text-gray-600 cursor-not-allowed"
                      : dayFullyBlocked && !dayIsPast
                      ? "bg-gray-100 border-2 border-gray-300 text-gray-600 hover:bg-gray-200 cursor-pointer"
                      : dayIsToday
                      ? "bg-emerald-100 border-2 border-emerald-500 text-gray-900 hover:bg-emerald-200 cursor-pointer"
                      : "bg-white border border-gray-200 text-gray-900 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer hover:shadow-md"
                  }
                `}
              >
                <span
                  className={`text-lg font-bold mb-2 flex-shrink-0 ${
                    dayIsToday ? "text-emerald-700" : dayUnavailable ? "text-gray-600" : "text-gray-900"
                  }`}
                >
                  {day.getDate()}
                </span>
                
                {dayBeyondWindow && (
                  <div className="text-[10px] font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded w-full mb-2 text-center flex-shrink-0">
                    Beyond booking window
                  </div>
                )}
                {dayFullyBlocked && !dayIsPast && !dayBeyondWindow && (
                  <div className="text-[10px] font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded w-full mb-2 text-center flex-shrink-0">
                    Day blocked
                  </div>
                )}

                {/* Timeline - gray time slots for every bookable day; fills the whole card */}
                {!dayUnavailable && !dayIsPast && (
                  <div className="relative flex-1 w-full min-h-0 bg-gray-100 rounded-lg overflow-hidden flex flex-col">
                    <div className="absolute inset-0 flex flex-col">
                      {/* Subtle hour dividers - full height */}
                      {TIME_SLOTS.slice(0, -1).map((time24, i) => (
                        <div
                          key={time24}
                          className="absolute left-0 right-0 border-b border-gray-200/80"
                          style={{ top: `${(i + 1) * SLOT_HEIGHT_PCT}%` }}
                        />
                      ))}
                      {/* Blocked time segments - darker gray overlay */}
                      {blockedTimesForDay.map((time24) => {
                        const [h] = time24.split(":").map(Number);
                        const idx = h - 6;
                        if (idx < 0 || idx >= SLOT_COUNT) return null;
                        return (
                          <div
                            key={time24}
                            className="absolute left-0.5 right-0.5 bg-gray-300/80 rounded-sm"
                            style={{
                              top: `${idx * SLOT_HEIGHT_PCT + 0.5}%`,
                              height: `${SLOT_HEIGHT_PCT - 1}%`,
                            }}
                            title={convertTo12Hour(time24) + " blocked"}
                          />
                        );
                      })}
                      {/* Bookings - show time and name clearly */}
                      {dayBookings
                        .filter((b) => b.status !== "rejected")
                        .map((booking) => {
                          const start24 = convertTo24Hour(booking.time);
                          const [startH] = start24.split(":").map(Number);
                          const durationHours = Math.ceil(booking.duration);
                          const topPct = (startH - 6) * SLOT_HEIGHT_PCT;
                          const heightPct = durationHours * SLOT_HEIGHT_PCT;
                          const isPending = booking.status === "pending";
                          const displayName = bookingUsers[booking.userId] || "Guest";
                          const displayTime = convertTo12Hour(start24);
                          return (
                            <div
                              key={booking.id}
                              className={`absolute left-1 right-1 rounded-md overflow-hidden flex flex-col justify-center ${
                                isPending
                                  ? "bg-amber-100 border border-amber-300"
                                  : "bg-blue-100 border border-blue-300"
                              }`}
                              style={{
                                top: `${topPct + 0.5}%`,
                                height: `${heightPct - 1}%`,
                              }}
                              title={`${displayTime} · ${booking.duration}h · ${displayName}${isPending ? " · Pending" : ""}`}
                            >
                              <div className="px-2 py-1 h-full flex flex-col justify-center min-w-0">
                                <span className="text-xs font-bold text-gray-900 truncate leading-tight">
                                  {displayTime}
                                </span>
                                <span className="text-xs font-medium text-gray-700 truncate leading-tight">
                                  {displayName}
                                  {isPending && " · Pending"}
                                </span>
                                <span className="text-[10px] text-gray-600 truncate">
                                  {booking.duration}h
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Footer badges */}
                <div className="flex flex-col gap-1 w-full mt-auto pt-2">
                  {pendingCount > 0 && !dayIsPast && !dayBeyondWindow && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-center">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          isOpen={isDayModalOpen}
          onClose={() => {
            setIsDayModalOpen(false);
            setSelectedDay(null);
          }}
          courtId={courtId}
          date={selectedDay}
          blockedTimes={blockedTimes[formatDateKey(selectedDay)] || []}
          alwaysBlockedForDay={[
            ...alwaysBlockedTimes,
            ...(alwaysBlockedTimesByDay[selectedDay.getDay()] || []),
          ]}
          bookings={getDayBookings(selectedDay)}
          bookingUsers={bookingUsers}
          onBlockedTimesUpdate={(times) => {
            const dateKey = formatDateKey(selectedDay);
            const updated = { ...blockedTimes };
            if (times.length > 0) {
              updated[dateKey] = times;
            } else {
              delete updated[dateKey];
            }
            onBlockedTimesUpdate?.(updated);
          }}
          onBookingUpdate={onBookingUpdate}
        />
      )}
    </>
  );
}
