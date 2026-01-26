"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import DayDetailModal from "./DayDetailModal";

interface Booking {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  userId: string;
}

interface CourtCalendarProps {
  courtId: string;
  courtName: string;
  isOpen: boolean;
  onClose: () => void;
  blockedTimes?: { [date: string]: string[] };
  onBlockedTimesUpdate?: (blockedTimes: { [date: string]: string[] }) => void;
  bookings?: Booking[];
  bookingUsers?: Record<string, string>;
  onBookingUpdate?: (bookingId: string, status: string) => void;
}

export default function CourtCalendar({
  courtId,
  courtName,
  isOpen,
  onClose,
  blockedTimes = {},
  onBlockedTimesUpdate,
  bookings = [],
  bookingUsers = {},
  onBookingUpdate,
}: CourtCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the start of the week (Sunday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Get Sunday of this week
    return new Date(d.setDate(diff));
  };

  // Generate calendar days for the week
  const calendarDays = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const days: Date[] = [];

    // Add all 7 days of the week
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

  const getDayBlockedCount = (day: Date): number => {
    const dateKey = formatDateKey(day);
    return blockedTimes[dateKey]?.length || 0;
  };

  const getDayBookings = (day: Date): Booking[] => {
    const dateKey = formatDateKey(day);
    return bookings.filter((booking) => booking.date === dateKey);
  };

  const getDayBookingCount = (day: Date): number => {
    return getDayBookings(day).length;
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-white rounded-3xl shadow-2xl border-0 overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">
            Calendar for {courtName} - Manage availability
          </DialogTitle>
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {courtName}
                </h2>
                <p className="text-sm text-gray-600">Manage availability</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Calendar Container */}
          <div className="p-8">
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {weekRange}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousWeek}
                  className="rounded-full border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextWeek}
                  className="rounded-full border-gray-200 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Day Names Header */}
            <div className="grid grid-cols-7 gap-3 mb-4">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-semibold text-gray-600 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Weekly Calendar Grid */}
            <div className="grid grid-cols-7 gap-3">
              {calendarDays.map((day) => {
                const blockedCount = getDayBlockedCount(day);
                const dayBookings = getDayBookings(day);
                const bookingCount = dayBookings.length;
                const pendingCount = dayBookings.filter(
                  (b) => b.status === "pending"
                ).length;
                const dayIsToday = isToday(day);
                const dayIsPast = isPast(day);


                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !dayIsPast && handleDayClick(day)}
                    disabled={dayIsPast}
                    className={`
                      min-h-[300px] rounded-xl p-4 flex flex-col items-start
                      transition-all duration-200
                      ${
                        dayIsPast
                          ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                          : dayIsToday
                          ? "bg-emerald-100 border-2 border-emerald-500 text-gray-900 hover:bg-emerald-200 cursor-pointer"
                          : "bg-white border border-gray-200 text-gray-900 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer hover:shadow-md"
                      }
                    `}
                  >
                    <span
                      className={`text-xl font-bold mb-3 ${
                        dayIsToday ? "text-emerald-700" : "text-gray-900"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    
                    {/* Bookings List */}
                    <div className="flex flex-col gap-2 w-full flex-1">
                      {dayBookings.length > 0 ? (
                        dayBookings
                          .sort((a, b) => {
                            // Sort by time
                            const timeA = convertTo24Hour(a.time);
                            const timeB = convertTo24Hour(b.time);
                            return timeA.localeCompare(timeB);
                          })
                          .map((booking) => {
                            const bookingTime12 = convertTo12Hour(
                              convertTo24Hour(booking.time)
                            );
                            return (
                              <div
                                key={booking.id}
                                className={`text-xs p-2 rounded-lg ${
                                  booking.status === "pending"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : booking.status === "confirmed"
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : booking.status === "rejected"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-gray-100 text-gray-600 border border-gray-200"
                                }`}
                              >
                                <div className="font-semibold">
                                  {bookingTime12}
                                </div>
                                <div className="text-[10px] opacity-75">
                                  {booking.duration}h •{" "}
                                  {bookingUsers[booking.userId] ||
                                    `${booking.userId.slice(0, 8)}...`}
                                </div>
                                {booking.status === "pending" && (
                                  <div className="text-[10px] font-medium text-amber-700 mt-0.5">
                                    Pending
                                  </div>
                                )}
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          No bookings
                        </div>
                      )}
                    </div>

                    {/* Footer badges */}
                    <div className="flex flex-col gap-1 w-full mt-auto pt-2">
                      {pendingCount > 0 && !dayIsPast && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-center">
                          {pendingCount} pending
                        </span>
                      )}
                      {blockedCount > 0 && !dayIsPast && (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full text-center">
                          {blockedCount} blocked
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
