"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth, isMockMode } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Clock, Calendar, Users } from "lucide-react";
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
import { calculateBookingPriceBreakdown, formatCents } from "@/lib/pricing";
import { WaiverAcknowledgmentDialog } from "@/components/WaiverAcknowledgmentDialog";
import LoadingScreen from "@/components/LoadingScreen";
import CourtBookingDetailUnified from "@/components/CourtBookingDetailUnified";
import CourtListingGalleryCard from "@/components/CourtListingGalleryCard";
import CourtListingHostCard from "@/components/CourtListingHostCard";
import ReviewsListDialog from "@/components/ReviewsListDialog";
import {
  PLAYER_BOOKING_WAIVER_INTRO,
  PLAYER_BOOKING_WAIVER_BODY,
  PLAYER_BOOKING_WAIVER_VERSION,
} from "@/lib/waivers";
import { format } from "date-fns";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  createMockBooking,
  getMockAuthUser,
  getMockBookingsForCourtAndDate,
  getMockCourtById,
  getMockCourts,
  getMockProfile,
  getMockReviewsForCourt,
  getMockReviewsForTarget,
} from "@/lib/mockData";

interface Court {
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  numberOfCourts?: number;
  blockedDates?: string[];
  blockedTimes?: { [date: string]: string[] };
  maxAdvanceBookingDays?: number | null;
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: { [dayOfWeek: number]: string[] };
  courtSpecificAlwaysBlockedTimes?: { [courtNum: string]: string[] };
  courtSpecificAlwaysBlockedTimesByDay?: { [courtNum: string]: { [dayOfWeek: string]: string[] } };
  surface?: string;
  indoor?: boolean;
  amenities?: string[];
  rating?: number;
  reviewCount?: number;
  ownerId?: string;
}

type PublicProfile = {
  uid: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner?: boolean;
  playerRating?: number | null;
  playerReviewCount?: number;
  ownerRating?: number | null;
  ownerReviewCount?: number;
  memberSince?: string | null;
  listingsCount?: number;
};

type PublicReview = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: string | null;
  targetType?: string;
};

function CourtDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const id =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const [court, setCourt] = useState<Court | null>(null);
  const [hostProfile, setHostProfile] = useState<PublicProfile | null>(null);
  const [courtReviews, setCourtReviews] = useState<PublicReview[]>([]);
  const [hostReviews, setHostReviews] = useState<PublicReview[]>([]);
  const [courtReviewsDialogOpen, setCourtReviewsDialogOpen] = useState(false);
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
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<number>(1);
  const [playerWaiverOpen, setPlayerWaiverOpen] = useState(false);
  const [playerWaiverChecked, setPlayerWaiverChecked] = useState(false);

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

  const durations = ["1", "2", "3"];

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDays = court?.maxAdvanceBookingDays;
    if (maxDays != null) {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + maxDays);
      if (date > maxDate) return false; // Disable dates beyond booking window
    }
    if (!court?.blockedDates) return true; // Enable all future dates if no blocked dates
    const dateString = date.toISOString().split("T")[0];
    return !court.blockedDates.includes(dateString); // Return true to enable, false to disable
  };

  // Compute all blocked times for the selected date
  const blockedTimes = new Set<string>();

  // Add existing bookings (filtered by courtNumber for multi-court)
  bookingsForDate.filter((b) => {
    if ((court?.numberOfCourts || 1) <= 1) return true;
    return (b.courtNumber || 1) === selectedCourtNumber;
  }).forEach((b) => {
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
  if (court && selectedDate) {
    const dateString = selectedDate.toISOString().split("T")[0];
    const courtBlockedTimes = court.blockedTimes?.[dateString] || [];
    courtBlockedTimes.forEach((time) => blockedTimes.add(time));
    // Add always-blocked times (every day)
    (court.alwaysBlockedTimes || []).forEach((time) => blockedTimes.add(time));
    // Add always-blocked times for this day of week (0=Sun, 1=Mon, ...)
    const dayOfWeek = new Date(dateString).getDay();
    (court.alwaysBlockedTimesByDay?.[dayOfWeek] || []).forEach((time) => blockedTimes.add(time));
    // Add court-specific blocked times for multi-court listings
    if ((court.numberOfCourts || 1) > 1) {
      const courtKey = String(selectedCourtNumber);
      const courtSpecificAlways = (court.courtSpecificAlwaysBlockedTimes || {})[courtKey] || [];
      courtSpecificAlways.forEach((time) => blockedTimes.add(time));
      const courtSpecificForDay = ((court.courtSpecificAlwaysBlockedTimesByDay || {})[courtKey] || {})[String(dayOfWeek)] || [];
      courtSpecificForDay.forEach((time) => blockedTimes.add(time));
    }
  }

  // Helper function to convert 12-hour time to 24-hour format
  const convertTo24Hour = (time12: string): string => {
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

  // Filter available time slots
  const availableTimeSlots = timeSlots.filter((time) => {
    // Check if time is in blocked times (for court's blocked times)
    const time24 = convertTo24Hour(time);
    if (blockedTimes.has(time24)) return false;

    // Check if a booking starting at this time with selected duration would overlap
    // with any blocked time (e.g. 1pm + 3h spans 1pm-4pm; if 3pm is blocked, disallow)
    if (selectedDate && duration) {
      const bookingDuration = parseFloat(duration);
      const startHour = parseInt(time24.split(":")[0], 10);
      for (let i = 0; i < bookingDuration; i++) {
        const hour = startHour + i;
        const hourStr = hour.toString().padStart(2, "0") + ":00";
        if (blockedTimes.has(hourStr)) return false;
      }
    }

    // Check if a booking starting at this time with selected duration would conflict
    // with any existing bookings (filtered by courtNumber for multi-court)
    if (selectedDate && duration) {
      const bookingDuration = parseFloat(duration);
      const relevantBookings = bookingsForDate.filter((b) => {
        if ((court?.numberOfCourts || 1) <= 1) return true;
        return (b.courtNumber || 1) === selectedCourtNumber;
      });
      const wouldConflict = relevantBookings.some((b) => {
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
        const timeHour = parseInt(time24.split(":")[0], 10);
        return timeHour > nowHour;
      }
    }

    return true;
  });

  // Clear selectedTime when it becomes invalid (e.g. duration change causes overlap with blocked times)
  useEffect(() => {
    if (!selectedTime || !duration || !selectedDate || !court) return;
    const time24 = convertTo24Hour(selectedTime);
    if (blockedTimes.has(time24)) {
      setSelectedTime("");
      return;
    }
    const startHour = parseInt(time24.split(":")[0], 10);
    const bookingDuration = parseFloat(duration);
    for (let i = 0; i < bookingDuration; i++) {
      const hour = startHour + i;
      const hourStr = hour.toString().padStart(2, "0") + ":00";
      if (blockedTimes.has(hourStr)) {
        setSelectedTime("");
        return;
      }
    }
    const wouldConflict = bookingsForDate.some((b) => {
      const existingDuration = Number(b.duration) || 1;
      return timeRangesOverlap(selectedTime, bookingDuration, b.time, existingDuration);
    });
    if (wouldConflict) setSelectedTime("");
  }, [selectedTime, duration, selectedDate, court, bookingsForDate]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    const fetchCourt = async () => {
      try {
        if (isMockMode) {
          const mockCourt = getMockCourtById(id);
          setCourt((mockCourt as Court | null) || null);
        } else {
          const docRef = doc(db, "courts", id);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            setCourt(snapshot.data() as Court);
          } else {
            setCourt(null);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch court");
      } finally {
        setLoading(false);
      }
    };
    fetchCourt();
  }, [id]);

  useEffect(() => {
    const fetchHostAndReviews = async () => {
      if (!id || !court) {
        setHostProfile(null);
        setCourtReviews([]);
        setHostReviews([]);
        return;
      }

      try {
        if (isMockMode) {
          const mockHostRow = court.ownerId ? getMockProfile(court.ownerId) : null;
          setHostProfile(
            mockHostRow
              ? ({
                  uid: mockHostRow.uid,
                  displayName: mockHostRow.displayName,
                  bio: mockHostRow.bio || "",
                  profileImageUrl: mockHostRow.profileImageUrl || "",
                  isOwner: mockHostRow.isOwner,
                  playerRating: mockHostRow.playerRating ?? null,
                  playerReviewCount: mockHostRow.playerReviewCount ?? 0,
                  ownerRating: mockHostRow.ownerRating ?? null,
                  ownerReviewCount: mockHostRow.ownerReviewCount ?? 0,
                  memberSince: mockHostRow.createdAt ?? null,
                  listingsCount: getMockCourts().filter((c) => c.ownerId === court.ownerId).length,
                } as PublicProfile)
              : null
          );
          setCourtReviews(getMockReviewsForCourt(id));
          const mockHostReviews =
            court.ownerId
              ? getMockReviewsForTarget(court.ownerId).filter(
                  (r: any) => r.targetType === "court_owner"
                )
              : [];
          setHostReviews(mockHostReviews);
          return;
        }

        const reviewsPromise = fetch(
          `/api/reviews?courtId=${encodeURIComponent(id)}`
        ).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to load reviews");
          return data.reviews || [];
        });

        const hostPromise = court.ownerId
          ? fetch(`/api/public-profiles/${encodeURIComponent(court.ownerId)}`).then(
              async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(data.error || "Failed to load host");
                }
                return data.profile as PublicProfile;
              }
            )
          : Promise.resolve(null);

        const hostReviewsPromise = court.ownerId
          ? fetch(`/api/reviews?targetUserId=${encodeURIComponent(court.ownerId)}`).then(
              async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(data.error || "Failed to load host reviews");
                }
                const allReviews: PublicReview[] = data.reviews || [];
                return allReviews.filter((r) => r.targetType === "court_owner");
              }
            )
          : Promise.resolve([]);

        const [profileData, reviewData, hostReviewsData] = await Promise.all([
          hostPromise,
          reviewsPromise,
          hostReviewsPromise,
        ]);
        setHostProfile(profileData);
        setCourtReviews(reviewData);
        setHostReviews(hostReviewsData);
      } catch (err) {
        console.warn("[COURT] Unable to load host profile or reviews:", err);
        setHostProfile(null);
        setCourtReviews([]);
        setHostReviews([]);
      }
    };

    fetchHostAndReviews();
  }, [court, id]);

  // Fetch bookings for selected date
  useEffect(() => {
    if (!id || !selectedDate) {
      setBookingsForDate([]);
      return;
    }
    setFetchingBookings(true);
    const fetchBookings = async () => {
      try {
        const bookingDate =
          selectedDate instanceof Date
            ? selectedDate.toISOString().slice(0, 10)
            : String(selectedDate);

        if (isMockMode) {
          setBookingsForDate(getMockBookingsForCourtAndDate(id, bookingDate));
        } else {
          const q = query(
            collection(db, "bookings"),
            where("courtId", "==", id),
            where("date", "==", bookingDate)
          );
          const snap = await getDocs(q);
          setBookingsForDate(snap.docs.map((doc) => doc.data()));
        }
      } catch (e) {
        setBookingsForDate([]);
      } finally {
        setFetchingBookings(false);
      }
    };
    fetchBookings();
  }, [id, selectedDate]);

  useEffect(() => {
    if (playerWaiverOpen) setPlayerWaiverChecked(false);
  }, [playerWaiverOpen]);

  /** Validates booking, then shows waiver before payment. */
  const handleCheckout = async () => {
    if (authLoading) {
      console.log("[BOOKING] Auth still loading, waiting...");
      return;
    }

    const currentUser = isMockMode ? getMockAuthUser() : auth.currentUser;
    if (!user && !currentUser) {
      router.push(`/sign-in?redirect=/courts/${id}`);
      return;
    }

    const activeUser = user || currentUser;
    if (!activeUser) {
      router.push(`/sign-in?redirect=/courts/${id}`);
      return;
    }

    if (!selectedDate || !selectedTime || !duration) {
      alert("Please fill out all fields.");
      return;
    }

    if (court?.ownerId === activeUser.uid) {
      setBookingStatus("error");
      alert("You cannot book your own court.");
      return;
    }

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

    const time24 = convertTo24Hour(selectedTime);
    const startHour = parseInt(time24.split(":")[0], 10);
    for (let i = 0; i < bookingDuration; i++) {
      const hour = startHour + i;
      const hourStr = hour.toString().padStart(2, "0") + ":00";
      if (blockedTimes.has(hourStr)) {
        setBookingStatus("conflict");
        alert(
          "This booking would overlap with blocked time slots. Please choose a different time or duration."
        );
        return;
      }
    }

    setPlayerWaiverOpen(true);
  };

  const confirmPlayerWaiverAndCheckout = async () => {
    const currentUser = isMockMode ? getMockAuthUser() : auth.currentUser;
    const activeUser = user || currentUser;
    if (!activeUser) {
      router.push(`/sign-in?redirect=/courts/${id}`);
      return;
    }

    if (isMockMode) {
      setPlayerWaiverOpen(false);
      await performCheckout();
      return;
    }

    try {
      await setDoc(
        doc(db, "users", activeUser.uid),
        {
          playerBookingWaiverVersionAccepted: PLAYER_BOOKING_WAIVER_VERSION,
          playerBookingWaiverAcceptedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      setBookingStatus("error");
      alert("Failed to record waiver acceptance. Please try again.");
      return;
    }

    setPlayerWaiverOpen(false);
    await performCheckout();
  };

  /** Runs Stripe checkout after waiver is accepted. */
  const performCheckout = async () => {
    const currentUser = isMockMode ? getMockAuthUser() : auth.currentUser;
    const activeUser = user || currentUser;
    if (!activeUser) {
      router.push(`/sign-in?redirect=/courts/${id}`);
      return;
    }

    setBookingStatus("loading");
    try {
      if (court?.ownerId === activeUser.uid) {
        throw new Error("You cannot book your own court.");
      }

      if (isMockMode) {
        const mockBooking = await createMockBooking({
          courtId: id,
          userId: activeUser.uid,
          date:
            selectedDate instanceof Date
              ? selectedDate.toISOString().slice(0, 10)
              : String(selectedDate),
          time: selectedTime,
          duration: Math.round(parseFloat(duration)),
          status: "pending",
          courtNumber: selectedCourtNumber,
        });

        setBookingStatus("success");
        router.push(`/booking/${mockBooking.id}`);
        return;
      }

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
          date:
            selectedDate instanceof Date
              ? selectedDate.toISOString().slice(0, 10)
              : selectedDate,
          time: selectedTime,
          durationMinutes: durationMinutes,
          courtNumber: selectedCourtNumber,
        }),
      });

      // Check if response is ok before parsing
      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("[BOOKING] API error:", res.status, errorData);
        setBookingStatus("error");
        alert(
          `Failed to start checkout: ${errorData.error || `HTTP ${res.status}`}`
        );
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        console.error("[BOOKING] No URL in response:", data);
        setBookingStatus("error");
        alert(
          "Failed to start checkout: " +
            (data.error || "No checkout URL received")
        );
      }
    } catch (err: any) {
      console.error("[BOOKING] Checkout error:", err);
      setBookingStatus("error");
      alert(`Failed to start checkout: ${err.message || "Network error"}`);
    }
  };

  const durationMinutesForPrice = Math.round(parseFloat(duration || "1") * 60);
  const priceBreakdown = court
    ? calculateBookingPriceBreakdown(court.price || 0, durationMinutesForPrice)
    : null;
  const isOwnCourt = !!user && court?.ownerId === user.uid;
  const latestCourtReview = courtReviews[0];

  if (loading) {
    return (
      <LoadingScreen
        message="Loading Court Details"
        detail="Checking court details, availability, host info, and reviews."
      />
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
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Browse
          </Button>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-6">
            <CourtListingGalleryCard
              listingKey={id || ""}
              court={court}
              latestCourtReview={latestCourtReview}
              onOpenCourtReviews={() => setCourtReviewsDialogOpen(true)}
              hourlyPriceDollars={court.price}
            />
            <CourtListingHostCard
              hostProfile={hostProfile}
              hostReviews={hostReviews}
              ownerId={court.ownerId}
            />
          </div>

          {/* Booking Form */}
          <div className="space-y-4 lg:sticky lg:top-8">
              <Card className="shadow-elegant border-0 rounded-3xl">
                <CardHeader className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white border-0 rounded-t-3xl">
                  <CardTitle className="text-2xl font-black tracking-tight">
                    Book This Court
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-8 space-y-6">
                  {/* Court Number Selection (only for multi-court listings) */}
                  {court.numberOfCourts && court.numberOfCourts > 1 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Court Number
                      </Label>
                      <Select
                        value={String(selectedCourtNumber)}
                        onValueChange={(v) => {
                          setSelectedCourtNumber(Number(v));
                          setSelectedTime("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-lg">
                          {Array.from({ length: court.numberOfCourts }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)} className="hover:bg-green-50 cursor-pointer">
                              Court {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

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
                    {court.numberOfCourts && court.numberOfCourts > 1 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Court</span>
                        <span className="font-medium">Court {selectedCourtNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>
                        Court rental ({duration}{" "}
                        {parseFloat(duration) === 1 ? "hour" : "hours"})
                      </span>
                      <span>${formatCents(priceBreakdown?.totalAmountCents || 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                      <span>Authorized today</span>
                      <span className="text-green-600">
                        ${formatCents(priceBreakdown?.totalAmountCents || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Your card is authorized for the court price now and only
                      charged if the host accepts within 24 hours.
                    </p>
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
                      authLoading ||
                      isOwnCourt
                    }
                    onClick={handleCheckout}
                  >
                    {isOwnCourt
                      ? "You host this court"
                      : bookingStatus === "loading"
                        ? "Processing..."
                        : "Request Booking"}
                  </Button>
                  {isOwnCourt && (
                    <p className="text-sm text-center text-slate-500">
                      Hosts cannot book their own courts.
                    </p>
                  )}

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
                    Secure payment processing. Hosts have 24 hours to accept.
                  </p>
                </CardContent>
              </Card>
          </div>
        </div>
      </div>

      <WaiverAcknowledgmentDialog
        open={playerWaiverOpen}
        onOpenChange={setPlayerWaiverOpen}
        title="Booking acknowledgment & assumption of risk"
        introBeforeTerms={PLAYER_BOOKING_WAIVER_INTRO}
        body={PLAYER_BOOKING_WAIVER_BODY}
        agreeLabel="I have read and agree to this acknowledgment. I understand CourtShare does not operate the facility and I assume the risks of athletic activity as described above."
        confirmButtonText="Agree & continue to payment"
        checked={playerWaiverChecked}
        onCheckedChange={setPlayerWaiverChecked}
        onConfirm={confirmPlayerWaiverAndCheckout}
        confirmDisabled={bookingStatus === "loading"}
      />

      <ReviewsListDialog
        open={courtReviewsDialogOpen}
        onOpenChange={setCourtReviewsDialogOpen}
        title="All court reviews"
        reviews={courtReviews}
      />
    </div>
  );
}

export default function CourtRoutePage() {
  return (
    <CourtBookingDetailUnified>
      <CourtDetailPage />
    </CourtBookingDetailUnified>
  );
}
