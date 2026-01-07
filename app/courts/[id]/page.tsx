"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, MapPin, Star, Clock, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Court {
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  blockedDates?: string[];
  blockedTimes?: { [date: string]: string[] };
  surface?: string;
  indoor?: boolean;
  amenities?: string[];
  rating?: number;
  reviewCount?: number;
}

export default function CourtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, loading: authLoading, isOwner } = useAuth();

  // Booking state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("1");
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "loading" | "success" | "error" | "conflict"
  >("idle");
  const [bookingsForDate, setBookingsForDate] = useState<any[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  // Time slots and durations
  const timeSlots = [
    "6:00 AM",
    "7:00 AM",
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
  ];

  const durations = ["1", "1.5", "2", "2.5", "3"];

  // Helper function to convert time string (e.g., "2:00 PM") to minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let totalMinutes = hours * 60 + (minutes || 0);
    if (period === "PM" && hours !== 12) {
      totalMinutes += 12 * 60;
    } else if (period === "AM" && hours === 12) {
      totalMinutes -= 12 * 60;
    }
    return totalMinutes;
  };

  // Helper function to check if two time ranges overlap
  const timeRangesOverlap = (
    start1: string,
    duration1: number,
    start2: string,
    duration2: number
  ): boolean => {
    const start1Minutes = timeToMinutes(start1);
    const end1Minutes = start1Minutes + duration1 * 60;
    const start2Minutes = timeToMinutes(start2);
    const end2Minutes = start2Minutes + duration2 * 60;

    // Two ranges overlap if one starts before the other ends
    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  };

  // Filter function for blocked dates
  const filterBlockedDates = (date: Date) => {
    if (date < new Date()) return false; // Disable past dates
    if (!court?.blockedDates) return true; // Enable all future dates if no blocked dates
    const dateString = date.toISOString().split("T")[0];
    return !court.blockedDates.includes(dateString); // Return true to enable, false to disable
  };

  // Compute all blocked times for the selected date
  const blockedTimes = new Set<string>();

  // Add existing bookings
  bookingsForDate.forEach((b) => {
    const startHour = parseInt((b.time || "").split(":")[0], 10);
    const dur = Number(b.duration) || 1;
    for (let i = 0; i < dur; i++) {
      const hour = startHour + i;
      if (hour >= 8 && hour <= 20) {
        blockedTimes.add(hour.toString().padStart(2, "0") + ":00");
      }
    }
  });

  // Add court's blocked times for the selected date
  if (court && selectedDate && court.blockedTimes) {
    const dateString = selectedDate.toISOString().split("T")[0];
    const courtBlockedTimes = court.blockedTimes[dateString] || [];
    courtBlockedTimes.forEach((time) => {
      blockedTimes.add(time);
    });
  }

  // Filter available time slots
  const availableTimeSlots = timeSlots.filter((time) => {
    // Check if time is in blocked times (for court's blocked times)
    const hour = parseInt(time.split(":")[0], 10);
    const time24 = hour.toString().padStart(2, "0") + ":00";
    if (blockedTimes.has(time24)) return false;

    // Check if a booking starting at this time with selected duration would conflict
    // with any existing bookings
    if (selectedDate && duration) {
      const bookingDuration = parseFloat(duration);
      const wouldConflict = bookingsForDate.some((b) => {
        const existingDuration = Number(b.duration) || 1;
        return timeRangesOverlap(
          time,
          bookingDuration,
          b.time,
          existingDuration
        );
      });
      if (wouldConflict) return false;
    }

    // Check if time is in the past for today
    if (selectedDate) {
      const today = new Date();
      const selectedDateOnly = new Date(selectedDate.toDateString());
      const todayOnly = new Date(today.toDateString());

      if (selectedDateOnly.getTime() === todayOnly.getTime()) {
        const nowHour = today.getHours();
        return hour > nowHour;
      }
    }

    return true;
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    const fetchCourt = async () => {
      try {
        const docRef = doc(db, "courts", id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setCourt(snapshot.data() as Court);
        } else {
          setCourt(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch court");
      } finally {
        setLoading(false);
      }
    };
    fetchCourt();
  }, [id]);

  // Fetch bookings for selected date
  useEffect(() => {
    if (!id || !selectedDate) {
      setBookingsForDate([]);
      return;
    }
    setFetchingBookings(true);
    const fetchBookings = async () => {
      try {
        const q = query(
          collection(db, "bookings"),
          where("courtId", "==", id),
          where(
            "date",
            "==",
            selectedDate instanceof Date
              ? selectedDate.toISOString().slice(0, 10)
              : selectedDate
          )
        );
        const snap = await getDocs(q);
        setBookingsForDate(snap.docs.map((doc) => doc.data()));
      } catch (e) {
        setBookingsForDate([]);
      } finally {
        setFetchingBookings(false);
      }
    };
    fetchBookings();
  }, [id, selectedDate]);

  const handleCheckout = async () => {
    // Wait for auth to finish loading before checking
    if (authLoading) {
      console.log("[BOOKING] Auth still loading, waiting...");
      return; // Don't do anything while auth is loading
    }

    // Double-check auth state directly from Firebase
    const currentUser = auth.currentUser;
    if (!user && !currentUser) {
      console.log(
        "[BOOKING] No user found in context or auth, redirecting to login"
      );
      router.push(`/login?redirect=/courts/${id}`);
      return;
    }

    // Use currentUser if user from context is null (race condition fix)
    const activeUser = user || currentUser;
    if (!activeUser) {
      console.log("[BOOKING] No active user, redirecting to login");
      router.push(`/login?redirect=/courts/${id}`);
      return;
    }

    console.log("[BOOKING] User authenticated:", activeUser.uid);
    if (!selectedDate || !selectedTime || !duration) {
      alert("Please fill out all fields.");
      return;
    }
    // Prevent double booking - check for time range overlaps including duration
    const bookingDuration = parseFloat(duration);
    const hasConflict = bookingsForDate.some((b) => {
      const existingDuration = Number(b.duration) || 1;
      return timeRangesOverlap(
        selectedTime,
        bookingDuration,
        b.time,
        existingDuration
      );
    });

    if (hasConflict) {
      setBookingStatus("conflict");
      return;
    }
    setBookingStatus("loading");
    try {
      // SECURITY FIX 2: Get Firebase ID token for authentication
      const idToken = await activeUser.getIdToken();

      // SECURITY FIX 1: Convert duration from hours to minutes
      // Duration is stored/selected in hours, convert to minutes for API
      const durationMinutes = Math.round(parseFloat(duration) * 60);

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // SECURITY FIX 2: Send auth token
        },
        body: JSON.stringify({
          courtId: id,
          // SECURITY FIX 1 & 2: Don't send userId or price - server will verify token and fetch price
          date:
            selectedDate instanceof Date
              ? selectedDate.toISOString().slice(0, 10)
              : selectedDate,
          time: selectedTime,
          durationMinutes: durationMinutes, // SECURITY FIX 1: Send as minutes
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setBookingStatus("error");
        alert("Failed to start checkout: " + data.error);
      }
    } catch (err) {
      setBookingStatus("error");
      alert("Failed to start checkout");
    }
  };

  const totalPrice = (court?.price || 0) * parseFloat(duration || "1");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading court...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">Court not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      {/* Header - Modernized */}
      <div className="glass border-b border-gray-200/50 backdrop-blur-xl">
        <div className="container py-4">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 font-semibold group"
            onClick={() => router.push("/courts")}
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Browse
          </Button>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Court Details */}
          <div className="space-y-6">
            {/* Court Image - Modernized */}
            <Card className="overflow-hidden shadow-elegant border-0 rounded-3xl">
              <div className="relative h-72 md:h-96 group">
                <Image
                  src={
                    court.imageUrls && court.imageUrls.length > 0
                      ? court.imageUrls[currentImageIndex]
                      : court.imageUrl
                  }
                  alt={court.name}
                  fill
                  className="object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  onClick={() => setShowImageModal(true)}
                />
                <div className="absolute top-4 right-4">
                  <Badge
                    variant="secondary"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {court.indoor ? "Indoor" : "Outdoor"}
                  </Badge>
                </div>
                {court.imageUrls && court.imageUrls.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev > 0 ? prev - 1 : court.imageUrls!.length - 1
                        )
                      }
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 transition"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev < court.imageUrls!.length - 1 ? prev + 1 : 0
                        )
                      }
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 transition"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                      {court.imageUrls.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition ${
                            index === currentImageIndex
                              ? "bg-white"
                              : "bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Court Info - Modernized */}
            <Card className="shadow-elegant border-0 hover:shadow-glow-hover transition-all duration-500 rounded-3xl">
              <CardContent className="p-8 pt-10">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
                      {court.name}
                    </h1>
                    <div className="flex items-center gap-2 text-gray-500 mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>{court.location}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {court.rating || 4.5}
                        </span>
                        <span className="text-gray-500">
                          ({court.reviewCount || 0} reviews)
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-gray-600 border-gray-300"
                      >
                        {court.surface || "Hard Court"}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-green-600">
                        ${court.price}
                      </span>
                      <span className="text-gray-500">per hour</span>
                    </div>
                    <p className="text-gray-600">{court.description}</p>
                  </div>

                  {/* Amenities */}
                  {court.amenities && court.amenities.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-semibold mb-3">Amenities</h3>
                      <div className="flex flex-wrap gap-2">
                        {court.amenities.map((amenity) => (
                          <Badge
                            key={amenity}
                            variant="secondary"
                            className="bg-gray-100 text-gray-700"
                          >
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="lg:sticky lg:top-8">
            {user && isOwner ? (
              <Card className="shadow-elegant border-0 rounded-3xl">
                <CardHeader className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white border-0 rounded-t-3xl">
                  <CardTitle className="text-2xl font-black tracking-tight">
                    Owner Mode Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <p className="text-center text-gray-600 font-medium leading-relaxed">
                    You're currently in owner mode. Switch to player mode to
                    book courts.
                  </p>
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-4 rounded-2xl shadow-xl hover:shadow-glow-hover transition-all duration-300 transform hover:scale-[1.02]"
                    size="lg"
                    onClick={() => router.push("/dashboard/owner")}
                  >
                    Go to Owner Dashboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-elegant border-0 rounded-3xl">
                <CardHeader className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white border-0 rounded-t-3xl">
                  <CardTitle className="text-2xl font-black tracking-tight">
                    Book This Court
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-8 space-y-6">
                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="date"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Date
                    </Label>
                    <ReactDatePicker
                      selected={selectedDate}
                      onChange={(date) => setSelectedDate(date)}
                      dateFormat="MM/dd/yyyy"
                      placeholderText="Select date"
                      minDate={new Date()}
                      filterDate={filterBlockedDates}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="time"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Time
                    </Label>
                    <Select
                      value={selectedTime}
                      onValueChange={setSelectedTime}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                        {availableTimeSlots.map((time) => (
                          <SelectItem
                            key={time}
                            value={time}
                            className="hover:bg-green-50 cursor-pointer"
                          >
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="duration"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Duration (hours)
                    </Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                        {durations.map((dur) => (
                          <SelectItem
                            key={dur}
                            value={dur}
                            className="hover:bg-green-50 cursor-pointer"
                          >
                            {dur} {parseFloat(dur) === 1 ? "hour" : "hours"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Summary */}
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        Court rental ({duration}{" "}
                        {parseFloat(duration) === 1 ? "hour" : "hours"})
                      </span>
                      <span>${totalPrice}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                      <span>Total</span>
                      <span className="text-green-600">${totalPrice}</span>
                    </div>
                  </div>

                  {/* Book Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white font-semibold py-3 shadow-md hover:shadow-lg transition-all duration-200"
                    size="lg"
                    disabled={
                      !selectedDate ||
                      !selectedTime ||
                      bookingStatus === "loading" ||
                      fetchingBookings ||
                      authLoading
                    }
                    onClick={handleCheckout}
                  >
                    {bookingStatus === "loading"
                      ? "Processing..."
                      : "Book & Pay"}
                  </Button>

                  {bookingStatus === "conflict" && (
                    <p className="text-red-500 text-sm text-center">
                      This time slot is already booked. Please choose another.
                    </p>
                  )}
                  {bookingStatus === "error" && (
                    <p className="text-red-500 text-sm text-center">
                      Something went wrong. Please try again.
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Secure payment processing. Cancel up to 24 hours before your
                    booking.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <Image
              src={
                court.imageUrls && court.imageUrls.length > 0
                  ? court.imageUrls[currentImageIndex]
                  : court.imageUrl
              }
              alt={court.name}
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {court.imageUrls && court.imageUrls.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {court.imageUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                    className={`w-3 h-3 rounded-full transition ${
                      index === currentImageIndex ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
