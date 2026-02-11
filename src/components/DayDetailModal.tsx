"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Lock, Unlock, Check, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Booking {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  userId: string;
}

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  courtId: string;
  date: Date;
  blockedTimes: string[];
  alwaysBlockedForDay?: string[];
  bookings?: Booking[];
  bookingUsers?: Record<string, string>;
  onBlockedTimesUpdate: (times: string[]) => void;
  onBookingUpdate?: (bookingId: string, status: string) => void;
}

// Generate all time slots from 6 AM to 9 PM
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 6; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

// Convert 24-hour time to 12-hour format for display
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export default function DayDetailModal({
  isOpen,
  onClose,
  courtId,
  date,
  blockedTimes,
  alwaysBlockedForDay = [],
  bookings = [],
  bookingUsers = {},
  onBlockedTimesUpdate,
  onBookingUpdate,
}: DayDetailModalProps) {
  const [localBlockedTimes, setLocalBlockedTimes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null
  );

  // Convert 12-hour time to 24-hour format for matching
  const convertTo24Hour = (time12: string): string => {
    // If already in 24-hour format (HH:MM), return as is
    if (/^\d{2}:\d{2}$/.test(time12)) {
      return time12;
    }
    // Otherwise, parse 12-hour format (e.g., "10:00 AM")
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

  // Get bookings for each time slot and accepted bookings (which should be locked)
  const bookingsByTime = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((booking) => {
      // Convert booking time to 24-hour format for matching
      const bookingTime24 = convertTo24Hour(booking.time);
      if (!map[bookingTime24]) {
        map[bookingTime24] = [];
      }
      map[bookingTime24].push(booking);
    });
    return map;
  }, [bookings]);

  // Accepted bookings should be locked (added to blocked times)
  // Block multiple time slots based on duration (e.g., 3 hours = 3 time slots)
  const acceptedBookingTimes = useMemo(() => {
    const blockedSlots: string[] = [];
    const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
    
    confirmedBookings.forEach((booking) => {
      const startTime24 = convertTo24Hour(booking.time);
      const durationHours = Math.ceil(booking.duration); // Round up to full hours
      const [startHour] = startTime24.split(":").map(Number);
      
      // Block all time slots for the duration
      for (let i = 0; i < durationHours; i++) {
        const slotHour = startHour + i;
        if (slotHour <= 21) { // Don't go past 9 PM
          const slotTime = `${slotHour.toString().padStart(2, "0")}:00`;
          blockedSlots.push(slotTime);
        }
      }
    });
    
    return [...new Set(blockedSlots)];
  }, [bookings]);

  useEffect(() => {
    // Combine manually blocked times + always-blocked from settings + accepted booking times
    const allBlocked = [...new Set([...blockedTimes, ...alwaysBlockedForDay, ...acceptedBookingTimes])];
    setLocalBlockedTimes(allBlocked);
  }, [blockedTimes, alwaysBlockedForDay, acceptedBookingTimes]);

  const handleToggleTimeSlot = (time: string) => {
    if (isLockedByBooking(time) || isLockedBySettings(time)) return;
    
    const currentManualBlocks = localBlockedTimes.filter(
      (t) => !acceptedBookingTimes.includes(t) && !alwaysBlockedForDay.includes(t)
    );
    const isCurrentlyManuallyBlocked = currentManualBlocks.includes(time);
    const newManualBlocks = isCurrentlyManuallyBlocked
      ? currentManualBlocks.filter((t) => t !== time)
      : [...currentManualBlocks, time].sort();
    const newAllBlocked = [...new Set([...newManualBlocks, ...alwaysBlockedForDay, ...acceptedBookingTimes])];
    setLocalBlockedTimes(newAllBlocked);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only save manually blocked times (exclude accepted bookings and settings-locked)
      const manualBlocked = localBlockedTimes.filter(
        (time) => !acceptedBookingTimes.includes(time) && !alwaysBlockedForDay.includes(time)
      );
      onBlockedTimesUpdate(manualBlocked);
      onClose();
    } catch (error) {
      console.error("Error saving blocked times:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setUpdatingBookingId(bookingId);
    try {
      onBookingUpdate?.(bookingId, "confirmed");
    } catch (error) {
      console.error("Error accepting booking:", error);
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    setUpdatingBookingId(bookingId);
    try {
      onBookingUpdate?.(bookingId, "rejected");
    } catch (error) {
      console.error("Error rejecting booking:", error);
    } finally {
      setUpdatingBookingId(null);
    }
  };

  // Helper to check if a time slot has a booking (at the start time)
  const getBookingForTime = (time: string): Booking | undefined => {
    return bookingsByTime[time]?.[0];
  };

  // Helper to check if time is locked by accepted booking (could be part of a multi-hour booking)
  const isLockedByBooking = (time: string): boolean => {
    return acceptedBookingTimes.includes(time);
  };

  // Helper to check if time is locked by default settings (always-blocked or day-specific)
  const isLockedBySettings = (time: string): boolean => {
    return alwaysBlockedForDay.includes(time);
  };

  // Helper to get the booking that locks this time slot (could be from a previous hour)
  const getBookingLockingTime = (time: string): Booking | undefined => {
    const [hour] = time.split(":").map(Number);
    // Check if this time is locked by a booking that started earlier
    for (let checkHour = hour - 1; checkHour >= 6; checkHour--) {
      const checkTime = `${checkHour.toString().padStart(2, "0")}:00`;
      const booking = bookingsByTime[checkTime]?.[0];
      if (booking && booking.status === "confirmed") {
        const durationHours = Math.ceil(booking.duration);
        const bookingStartHour = parseInt(convertTo24Hour(booking.time).split(":")[0]);
        if (hour >= bookingStartHour && hour < bookingStartHour + durationHours) {
          return booking;
        }
      }
    }
    return undefined;
  };

  const formattedDate = format(date, "EEEE, MMMM d, yyyy");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 bg-white rounded-3xl shadow-2xl border-0 overflow-hidden max-h-[90vh] flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">
          Manage time slots for {formattedDate}
        </DialogTitle>
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {formattedDate}
              </h2>
              <p className="text-sm text-gray-600">
                Click time slots to block or unblock them
              </p>
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

        {/* Time Slots Grid */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-4">
            {timeSlots.map((time) => {
              const booking = getBookingForTime(time);
              const lockingBooking = getBookingLockingTime(time);
              const displayBooking = booking || lockingBooking;
              const isLockedByAccepted = isLockedByBooking(time);
              const isManuallyBlocked =
                localBlockedTimes.includes(time) && !isLockedByAccepted;
              const isBlocked = isManuallyBlocked || isLockedByAccepted;
              const isPast = (() => {
                const today = new Date();
                const slotDate = new Date(date);
                slotDate.setHours(
                  parseInt(time.split(":")[0]),
                  parseInt(time.split(":")[1]),
                  0,
                  0
                );
                return slotDate < today;
              })();

              return (
                <div
                  key={time}
                  className={`
                    relative rounded-xl border-2 transition-all duration-200 overflow-hidden
                    ${
                      isPast
                        ? "bg-gray-50 border-gray-200"
                        : displayBooking
                        ? displayBooking.status === "pending"
                          ? "bg-amber-50 border-amber-300"
                          : displayBooking.status === "confirmed"
                          ? "bg-blue-50 border-blue-400"
                          : displayBooking.status === "rejected"
                          ? "bg-red-50 border-red-300"
                          : "bg-gray-50 border-gray-200"
                        : isBlocked
                        ? isLockedBySettings(time)
                          ? "bg-gray-100 border-gray-300"
                          : "bg-red-50 border-red-300"
                        : "bg-white border-gray-200 hover:border-emerald-300 cursor-pointer"
                    }
                  `}
                  onClick={(e) => {
                    if (!displayBooking && !isPast && !isLockedByAccepted && !isLockedBySettings(time)) {
                      e.stopPropagation();
                      handleToggleTimeSlot(time);
                    }
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-lg text-gray-900">
                        {formatTime12Hour(time)}
                      </span>
                      {/* Only show lock icon for confirmed bookings (locked in) */}
                      {(isLockedByAccepted || isLockedBySettings(time) || (lockingBooking && lockingBooking.status === "confirmed")) && (
                        <Lock className="h-5 w-5 text-blue-600" />
                      )}
                    </div>

                    {displayBooking ? (
                      <div className="space-y-2">
                        {booking && (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  displayBooking.status === "pending"
                                    ? "secondary"
                                    : displayBooking.status === "confirmed"
                                    ? "default"
                                    : "destructive"
                                }
                                className={
                                  displayBooking.status === "pending"
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : displayBooking.status === "confirmed"
                                    ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : displayBooking.status === "rejected"
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : ""
                                }
                              >
                                {displayBooking.status === "pending"
                                  ? "Pending"
                                  : displayBooking.status === "confirmed"
                                  ? "Confirmed"
                                  : "Rejected"}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {displayBooking.duration}h
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <User className="h-4 w-4" />
                              <span>
                                {bookingUsers[displayBooking.userId] ||
                                  `${displayBooking.userId.slice(0, 12)}...`}
                              </span>
                            </div>
                            {displayBooking.status === "pending" && !isPast && (
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleAcceptBooking(displayBooking.id)
                                  }
                                  disabled={
                                    updatingBookingId === displayBooking.id
                                  }
                                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleRejectBooking(displayBooking.id)
                                  }
                                  disabled={
                                    updatingBookingId === displayBooking.id
                                  }
                                  className="flex-1 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {displayBooking.status === "confirmed" && (
                              <p className="text-xs text-blue-600 font-medium">
                                ✓ Locked in ({displayBooking.duration}h)
                              </p>
                            )}
                          </>
                        )}
                        {!booking && lockingBooking && (
                          <p className="text-xs text-blue-600 font-medium">
                            Part of {formatTime12Hour(convertTo24Hour(lockingBooking.time))} booking ({lockingBooking.duration}h)
                          </p>
                        )}
                      </div>
                    ) : (
                      !isPast && (
                        <div className="mt-1">
                          {isLockedByAccepted ? (
                            <span className="text-sm text-gray-400">
                              Locked by booking
                            </span>
                          ) : isLockedBySettings(time) ? (
                            <span className="text-sm text-gray-500">
                              Blocked in settings
                            </span>
                          ) : (
                            <span className="text-sm text-gray-600">
                              {isManuallyBlocked
                                ? "Click anywhere to unblock"
                                : "Click anywhere to block"}
                            </span>
                          )}
                        </div>
                      )
                    )}

                    {isPast && (
                      <span className="text-xs text-gray-400 mt-1 block">
                        Past
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with Save Button */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {localBlockedTimes.filter(
                  (t) => !acceptedBookingTimes.includes(t) && !alwaysBlockedForDay.includes(t)
                ).length}
              </span>{" "}
              manually blocked,{" "}
              {alwaysBlockedForDay.length > 0 && (
                <>
                  <span className="font-semibold text-gray-900">
                    {alwaysBlockedForDay.length}
                  </span>{" "}
                  from settings,{" "}
                </>
              )}
              <span className="font-semibold text-gray-900">
                {bookings.filter((b) => b.status === "confirmed").length}
              </span>{" "}
              confirmed booking
              {bookings.filter((b) => b.status === "confirmed").length !== 1
                ? "s"
                : ""}
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-6"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
