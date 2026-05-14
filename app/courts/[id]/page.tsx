"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  ArrowLeft,
  Calendar,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Lightbulb,
  MapPin,
  Shield,
  Shirt,
  Star,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Building2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { calculateBookingPriceBreakdown, formatCents } from "@/lib/pricing";
import { WaiverAcknowledgmentDialog } from "@/components/WaiverAcknowledgmentDialog";
import LoadingScreen from "@/components/LoadingScreen";
import CourtBookingDetailUnified from "@/components/CourtBookingDetailUnified";
// CourtListingHostCard kept per design spec — host dialog is rendered inline using its visual language
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import CourtListingHostCard from "@/components/CourtListingHostCard";
import ReviewsListDialog from "@/components/ReviewsListDialog";
import AppHeader from "@/components/AppHeader";
import {
  PLAYER_BOOKING_WAIVER_INTRO,
  PLAYER_BOOKING_WAIVER_BODY,
  PLAYER_BOOKING_WAIVER_VERSION,
} from "@/lib/waivers";
import { isActionablePendingBooking } from "@/lib/bookingDates";
import { format } from "date-fns";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  createMockBooking,
  getMockAuthUser,
  getMockBookingsForCourtAndDate,
  getMockBookingsForUser,
  getMockCourtById,
  getMockCourts,
  getMockProfile,
  getMockReviewsForCourt,
  getMockReviewsForTarget,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Court interface ────────────────────────────────────────────────────────
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
  // Extended fields
  latitude?: number;
  longitude?: number;
  maxGuests?: number | null;
  speakersPolicy?: "allowed" | "not_allowed" | "quiet_hours_only" | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  houseRules?: string[];
  additionalRules?: string;
  spaceGreatFor?: string[];
  checkInType?: "self" | "host";
  parkingSpaces?: number | null;
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
  reviewerId?: string;
  playerId?: string;
  reviewerName?: string;
  reviewerProfileImageUrl?: string;
};

// ─── Amenity helpers ─────────────────────────────────────────────────────────
const AMENITY_LABELS: Record<string, string> = {
  on_site_parking: "On-site parking",
  free_street_parking: "Free street parking",
  wifi: "WiFi",
  restrooms: "Restrooms",
  balls_provided: "Balls provided",
  night_lights: "Night lights",
  water_provided: "Water",
  towels_provided: "Towels provided",
};

function AmenityIcon({ slug, className }: { slug: string; className?: string }) {
  const cls = cn("h-5 w-5 shrink-0", className);
  switch (slug) {
    case "on_site_parking":
    case "free_street_parking":
      return <Car className={cls} />;
    case "wifi":
      return <Wifi className={cls} />;
    case "restrooms":
      return <Building2 className={cls} />;
    case "balls_provided":
      return <Circle className={cls} />;
    case "night_lights":
      return <Lightbulb className={cls} />;
    case "water_provided":
      return <Droplets className={cls} />;
    case "towels_provided":
      return <Shirt className={cls} />;
    default:
      return <Shield className={cls} />;
  }
}

// ─── House rules helpers ──────────────────────────────────────────────────────
const HOUSE_RULE_LABELS: Record<string, string> = {
  no_smoking: "No smoking",
  no_alcohol: "No alcohol",
  no_outside_food: "No outside food or drinks",
  court_shoes_required: "Court shoes required",
  no_pets: "No pets",
  guests_must_sign_in: "Guests must sign in",
};

// ─── Speakers policy display ─────────────────────────────────────────────────
function formatHour(raw: string | null | undefined): string {
  if (!raw) return "";
  // Accepts "HH:00" or "H:00" → "H:00 AM/PM"
  const [hStr] = raw.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return raw;
  const ampm = h < 12 ? "AM" : "PM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${ampm}`;
}

function SpeakersRow({ policy, start, end }: {
  policy: Court["speakersPolicy"];
  start?: string | null;
  end?: string | null;
}) {
  if (!policy) return null;
  let icon: React.ReactNode;
  let label: string;
  if (policy === "allowed") {
    icon = <Volume2 className="h-5 w-5 text-emerald-600" />;
    label = "Speakers allowed";
  } else if (policy === "not_allowed") {
    icon = <VolumeX className="h-5 w-5 text-slate-500" />;
    label = "No speakers";
  } else {
    icon = <Volume1 className="h-5 w-5 text-amber-500" />;
    label = `Quiet hours: ${formatHour(start)} – ${formatHour(end)}`;
  }
  return (
    <div className="flex items-center gap-3 text-sm text-slate-700">
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ─── Member Since formatter ──────────────────────────────────────────────────
function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Member since ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

// ─── Review date formatter ────────────────────────────────────────────────────
function formatReviewDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <hr className="border-slate-200" />;
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-black text-slate-950">{children}</h2>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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

  // Image gallery state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  // State to control the inline host profile dialog
  const [hostProfileDialogOpen, setHostProfileDialogOpen] = useState(false);

  // Ref for scrolling to reviews section
  const reviewsRef = useRef<HTMLElement>(null);
  const scrollToReviews = () =>
    reviewsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Booking state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("1");
  const [guestCount, setGuestCount] = useState<string>("1");
  const [initialMessage, setInitialMessage] = useState<string>("");
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "loading" | "success" | "error" | "conflict"
  >("idle");
  const [bookingsForDate, setBookingsForDate] = useState<any[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<number>(1);
  const [playerWaiverOpen, setPlayerWaiverOpen] = useState(false);
  const [playerWaiverChecked, setPlayerWaiverChecked] = useState(false);
  const [duplicateRequestDialogOpen, setDuplicateRequestDialogOpen] =
    useState(false);

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

  const isStartTimeInPast = (time: string) => {
    if (!selectedDate) return false;
    const today = new Date();
    const selectedDateOnly = new Date(selectedDate.toDateString());
    const todayOnly = new Date(today.toDateString());
    if (selectedDateOnly.getTime() !== todayOnly.getTime()) return false;
    const time24 = convertTo24Hour(time);
    const timeHour = parseInt(time24.split(":")[0], 10);
    return timeHour <= today.getHours();
  };

  const isDurationAvailable = (startTime: string, durationHours: number) => {
    if (!selectedDate || !court) return true;
    const time24 = convertTo24Hour(startTime);
    const startHour = parseInt(time24.split(":")[0], 10);
    for (let i = 0; i < durationHours; i++) {
      const hour = startHour + i;
      const hourStr = hour.toString().padStart(2, "0") + ":00";
      if (blockedTimes.has(hourStr)) return false;
    }
    const relevantBookings = bookingsForDate.filter((b) => {
      if ((court?.numberOfCourts || 1) <= 1) return true;
      return (b.courtNumber || 1) === selectedCourtNumber;
    });
    return !relevantBookings.some((b) => {
      const existingDurationMinutes = b.durationMinutes || (Number(b.duration) || 1) * 60;
      const existingDuration = Math.ceil(existingDurationMinutes / 60);
      return timeRangesOverlap(startTime, durationHours, b.time, existingDuration);
    });
  };

  const getStartTimeUnavailableReason = (time: string) => {
    if (!selectedDate) return "Select a date first";
    if (isStartTimeInPast(time)) return "Past time";
    return isDurationAvailable(time, 1) ? "" : "Unavailable";
  };

  const startTimeOptions = timeSlots.map((time) => ({
    time,
    unavailableReason: getStartTimeUnavailableReason(time),
  }));

  const durationOptions = durations.map((dur) => {
    const durationHours = parseFloat(dur);
    const available =
      !!selectedDate &&
      !!selectedTime &&
      !getStartTimeUnavailableReason(selectedTime) &&
      isDurationAvailable(selectedTime, durationHours);
    return { value: dur, available };
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
    if (!isDurationAvailable(selectedTime, bookingDuration)) {
      setDuration("1");
      if (!isDurationAvailable(selectedTime, 1)) setSelectedTime("");
    }
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
          setCourtReviews(
            getMockReviewsForCourt(id).map((review) => {
              const reviewer = getMockProfile(review.reviewerId || review.playerId);
              return {
                ...review,
                reviewerName: reviewer?.displayName || "CourtShare player",
                reviewerProfileImageUrl: reviewer?.profileImageUrl || "",
              };
            })
          );
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

  const hasActionablePendingRequestForCourt = async (uid: string) => {
    if (!id) return false;

    if (isMockMode) {
      return getMockBookingsForUser(uid).some(
        (booking) =>
          booking.courtId === id &&
          isActionablePendingBooking(booking as Parameters<typeof isActionablePendingBooking>[0])
      );
    }

    try {
      const pendingRequestQuery = query(
        collection(db, "bookings"),
        where("userId", "==", uid),
        where("courtId", "==", id),
        where("status", "==", "pending")
      );
      const snap = await getDocs(pendingRequestQuery);
      return snap.docs.some((bookingDoc) =>
        isActionablePendingBooking(
          bookingDoc.data() as Parameters<typeof isActionablePendingBooking>[0]
        )
      );
    } catch (error) {
      console.warn("[BOOKING] Unable to check duplicate pending requests:", error);
      return false;
    }
  };

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
    if (!isDurationAvailable(selectedTime, bookingDuration)) {
      setBookingStatus("conflict");
      alert("This booking would overlap with an unavailable slot. Please choose a different time or duration.");
      return;
    }

    const normalizedGuestCount = Number(guestCount);
    if (!Number.isInteger(normalizedGuestCount) || normalizedGuestCount < 1) {
      alert("Please enter at least 1 guest.");
      return;
    }
    if (court?.maxGuests && normalizedGuestCount > court.maxGuests) {
      alert(`This court allows up to ${court.maxGuests} guests.`);
      return;
    }

    if (await hasActionablePendingRequestForCourt(activeUser.uid)) {
      setDuplicateRequestDialogOpen(true);
      return;
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
    if (!id) return;
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
          guestCount: Number(guestCount) || 1,
          initialMessage: initialMessage.trim().slice(0, 1000),
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
          guestCount: Number(guestCount) || 1,
          initialMessage: initialMessage.trim().slice(0, 500),
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

  // ─── Derived display values ──────────────────────────────────────────────
  const courtImages = (court?.imageUrls?.length ? court.imageUrls : [court?.imageUrl]).filter(
    Boolean
  ) as string[];

  const displayRating =
    court?.rating != null ? court.rating.toFixed(1) : null;
  const reviewCount = court?.reviewCount ?? courtReviews.length;
  const checkInLabel =
    court?.checkInType === "self"
      ? "Self check-in"
      : court?.checkInType === "host"
        ? "Check-in with host"
        : "";

  const top3Reviews = courtReviews.slice(0, 3);

  // ─── Loading / error states ───────────────────────────────────────────────
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">Court not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Global app header ── */}
      <AppHeader />

      {/* ── Title / location / rating — above gallery ── */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-4 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Browse
        </button>

        <h1 className="text-3xl font-black text-slate-950 leading-tight">
          {court.name}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--site-accent)]" />
            <span>{court.location}</span>
          </div>
          {(displayRating || reviewCount > 0) && (
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {displayRating && (
                <span className="font-semibold text-slate-900">{displayRating}</span>
              )}
              {reviewCount > 0 && (
                <button
                  type="button"
                  onClick={scrollToReviews}
                  className="text-slate-500 underline-offset-2 hover:underline hover:text-slate-800 transition-colors"
                >
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </button>
              )}
            </div>
          )}
          {/* Key fact pills */}
          {court.indoor != null && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
              {court.indoor ? "Indoor" : "Outdoor"}
            </span>
          )}
          {court.surface && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
              {court.surface}
            </span>
          )}
          {(court.numberOfCourts ?? 1) > 1 && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
              {court.numberOfCourts} courts
            </span>
          )}
          {court.maxGuests != null && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
              Up to {court.maxGuests} guests
            </span>
          )}
        </div>
      </div>

      {/* ── Image Gallery ── */}
	      <div className="w-full bg-slate-50">
        {/* Desktop gallery: selected main photo + thumbnail rail */}
        <div className="hidden lg:block relative">
          <div className="max-w-7xl mx-auto px-4 pt-4">
	            <div className="grid h-[520px] grid-cols-[minmax(0,1fr)_180px] gap-3 rounded-[32px] border border-slate-200 bg-white p-3 shadow-sm">
              <div
                className="group relative cursor-pointer overflow-hidden rounded-[26px] bg-slate-800"
                onClick={() => {
                  setShowImageModal(true);
                }}
              >
                {courtImages[currentImageIndex] && (
                  <img
                    src={courtImages[currentImageIndex]}
                    alt={court.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}

                {courtImages.length > 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowImageModal(true);
                    }}
                    className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-2xl bg-white/95 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg backdrop-blur transition hover:bg-white"
                  >
                    <span className="text-base">⊞</span>
                    View all {courtImages.length}
                  </button>
                )}
              </div>

              <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                {courtImages.map((img, index) => (
                  <button
                    key={`${img}-${index}`}
                    type="button"
                    onClick={() => setCurrentImageIndex(index)}
                    className={cn(
	                      "relative h-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-slate-100 transition",
	                      index === currentImageIndex
	                        ? "border-slate-950 shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
	                        : "border-slate-200 opacity-75 hover:border-slate-400 hover:opacity-100"
                    )}
                    aria-label={`Show photo ${index + 1}`}
                  >
                    <img
                      src={img}
                      alt={`${court.name} photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
	                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile gallery: carousel */}
        <div className="lg:hidden relative h-64 sm:h-80 overflow-hidden">
          {courtImages.length > 0 && (
            <>
              <img
                src={courtImages[currentImageIndex]}
                alt={court.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setShowImageModal(true)}
              />
              {courtImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i === 0 ? courtImages.length - 1 : i - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow text-slate-800 hover:bg-white transition-colors"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentImageIndex((i) =>
                        i === courtImages.length - 1 ? 0 : i + 1
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow text-slate-800 hover:bg-white transition-colors"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {courtImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentImageIndex(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === currentImageIndex
                            ? "w-5 bg-white"
                            : "w-1.5 bg-white/50"
                        )}
                        aria-label={`Go to photo ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Fullscreen image lightbox ── */}
      {showImageModal && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {courtImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCurrentImageIndex((i) =>
                    i === 0 ? courtImages.length - 1 : i - 1
                  )
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentImageIndex((i) =>
                    i === courtImages.length - 1 ? 0 : i + 1
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="max-w-5xl max-h-[90vh] w-full px-16">
            {courtImages[currentImageIndex] && (
              <img
                src={courtImages[currentImageIndex]}
                alt={`${court.name} – photo ${currentImageIndex + 1}`}
                className="w-full h-full object-contain max-h-[85vh] rounded-xl"
              />
            )}
            <p className="text-center text-white/60 text-sm mt-3">
              {currentImageIndex + 1} / {courtImages.length}
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          {/* ─────────────── LEFT COLUMN ─────────────── */}
          <div className="space-y-8 min-w-0">

            {/* ── Meet your host ── */}
            {hostProfile && (
              <>
                <section className="space-y-4">
                  <SectionHeader>Meet Your Host</SectionHeader>

                  <button
                    type="button"
                    onClick={() => setHostProfileDialogOpen(true)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 transition-colors text-left"
                  >
                    <Avatar className="h-14 w-14 shrink-0 border-2 border-white shadow-md">
                      <AvatarImage
                        src={hostProfile.profileImageUrl || undefined}
                        alt={hostProfile.displayName}
                      />
                      <AvatarFallback className="bg-emerald-100 text-xl font-bold text-emerald-800">
                        {hostProfile.displayName?.trim().charAt(0).toUpperCase() || "H"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-950 text-base leading-snug">
                        {hostProfile.displayName}
                      </p>
                      {hostProfile.ownerRating != null ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-semibold text-slate-700">
                            {hostProfile.ownerRating.toFixed(1)}
                          </span>
                          {(hostProfile.ownerReviewCount ?? 0) > 0 && (
                            <span className="text-sm text-slate-500">
                              · {hostProfile.ownerReviewCount} {hostProfile.ownerReviewCount === 1 ? "host review" : "host reviews"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 mt-0.5">New host</p>
                      )}
                      {hostProfile.memberSince && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatMemberSince(hostProfile.memberSince)}
                        </p>
                      )}
                    </div>
                  </button>
                </section>
                <Divider />
              </>
            )}

            {/* ── About this court ── */}
            {court.description && (
              <>
                <section className="space-y-3">
                  <SectionHeader>Description</SectionHeader>
                  <p className="text-slate-700 leading-7 whitespace-pre-line">
                    {court.description}
                  </p>
                </section>
                <Divider />
              </>
            )}

            {/* ── Amenities ── */}
            {court.amenities && court.amenities.length > 0 && (
              <>
                <section className="space-y-4">
                  <SectionHeader>Amenities</SectionHeader>
                  <div className="grid grid-cols-2 gap-3">
                    {court.amenities.map((slug) => (
                      <div key={slug} className="flex items-center gap-3 text-sm text-slate-700">
                        <AmenityIcon slug={slug} className="text-[var(--site-accent)]" />
                        <span>{AMENITY_LABELS[slug] ?? slug.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <Divider />
              </>
            )}

            {checkInLabel && (
              <>
                <section className="space-y-3">
                  <SectionHeader>Check-In</SectionHeader>
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <Shield className="h-4 w-4 shrink-0 text-[var(--site-accent)]" />
                    <span>{checkInLabel}</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Detailed check-in instructions are shared after the host accepts your booking request.
                  </p>
                </section>
                <Divider />
              </>
            )}

            {/* ── Court Rules ── */}
            {(court.speakersPolicy ||
              (court.houseRules && court.houseRules.length > 0) ||
              court.additionalRules) && (
              <>
                <section className="space-y-4">
                  <SectionHeader>Court Rules</SectionHeader>
                  {court.speakersPolicy && (
                    <SpeakersRow
                      policy={court.speakersPolicy}
                      start={court.quietHoursStart}
                      end={court.quietHoursEnd}
                    />
                  )}
                  {court.houseRules && court.houseRules.length > 0 && (
                    <ul className="space-y-2">
                      {court.houseRules.map((rule) => (
                        <li key={rule} className="flex items-center gap-3 text-sm text-slate-700">
                          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{HOUSE_RULE_LABELS[rule] ?? rule.replace(/_/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {court.additionalRules && (
                    <p className="text-sm text-slate-700 leading-6 whitespace-pre-line">
                      {court.additionalRules}
                    </p>
                  )}
                </section>
                <Divider />
              </>
            )}

            {/* ── Location map ── */}
            {court.latitude != null && court.longitude != null && (
              <>
                <section className="space-y-4">
                  <SectionHeader>Approximate Location</SectionHeader>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <iframe
                      title="Court location"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${court.longitude - 0.025},${court.latitude - 0.012},${court.longitude + 0.025},${court.latitude + 0.012}&layer=mapnik`}
                      className="w-full h-56 sm:h-72 border-0"
                      loading="lazy"
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 shrink-0" />
                    Exact address shared after booking
                  </p>
                </section>
                <Divider />
              </>
            )}

            {/* ── Reviews ── */}
            {courtReviews.length > 0 && (
              <>
                <section id="reviews" ref={reviewsRef} className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SectionHeader>Reviews</SectionHeader>
	                      {displayRating && (
	                        <span className="flex items-center gap-1 text-slate-500 text-base">
	                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
	                          <span className="font-semibold text-slate-800">{displayRating}</span>
	                          <span className="text-sm text-slate-500">
	                            ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
	                          </span>
	                        </span>
	                      )}
                    </div>
                  </div>

                  {/* Top 3 reviews */}
                  <div className="space-y-4">
                    {top3Reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
	                        <div className="mb-3 flex items-start justify-between gap-3">
	                          <div className="flex min-w-0 items-center gap-3">
	                            <Avatar className="h-10 w-10 border border-slate-200">
	                              <AvatarImage src={review.reviewerProfileImageUrl || undefined} />
	                              <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">
	                                {(review.reviewerName || "P").charAt(0).toUpperCase()}
	                              </AvatarFallback>
	                            </Avatar>
	                            <div className="min-w-0">
	                              <p className="truncate text-sm font-bold text-slate-950">
	                                {review.reviewerName || "CourtShare player"}
	                              </p>
	                              <div className="mt-1 flex items-center gap-1">
	                                {[1, 2, 3, 4, 5].map((v) => (
	                                  <Star
	                                    key={v}
	                                    className="h-4 w-4"
	                                    fill={v <= review.rating ? "rgb(245 158 11)" : "transparent"}
	                                    color={v <= review.rating ? "rgb(245 158 11)" : "rgb(148 163 184)"}
	                                  />
	                                ))}
	                              </div>
	                            </div>
	                          </div>
	                          <span className="text-xs text-slate-500 shrink-0">
	                            {formatReviewDate(review.createdAt)}
	                          </span>
                        </div>
                        {review.comment?.trim() ? (
                          <p className="text-sm leading-6 text-slate-700">
                            {review.comment}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">No comments.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* View all reviews button */}
                  {courtReviews.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setCourtReviewsDialogOpen(true)}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                      View all {courtReviews.length} reviews
                    </button>
                  )}
                </section>
              </>
            )}
          </div>

          {/* ─────────────── RIGHT COLUMN — Sticky booking card ─────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Price header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-950">
                    ${court.price}
                  </span>
                  <span className="text-slate-500 font-medium">/hr</span>
                </div>
                {displayRating && reviewCount > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold text-slate-700">{displayRating}</span>
                    <span className="text-sm text-slate-500">
                      · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Court number (multi-court only) */}
                {court.numberOfCourts && court.numberOfCourts > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 block">
                      Court
                    </label>
                    <Select
                      value={String(selectedCourtNumber)}
                      onValueChange={(v) => {
                        setSelectedCourtNumber(Number(v));
                        setSelectedTime("");
                      }}
                    >
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-lg rounded-xl">
                        {Array.from(
                          { length: court.numberOfCourts },
                          (_, i) => i + 1
                        ).map((n) => (
                          <SelectItem
                            key={n}
                            value={String(n)}
                            className="hover:bg-emerald-50 cursor-pointer"
                          >
                            Court {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date picker */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <ReactDatePicker
                      selected={selectedDate}
                      onChange={(date) => {
                        setSelectedDate(date);
                        setSelectedTime("");
                      }}
                      dateFormat="MMM d, yyyy"
                      placeholderText="Choose date"
                      minDate={new Date()}
                      filterDate={filterBlockedDates}
                      className="court-booking-date-input w-full"
                      wrapperClassName="w-full"
                      popperClassName="z-[90]"
                      calendarClassName="courtshare-calendar"
                      popperPlacement="bottom-start"
                      showPopperArrow={false}
                    />
                  </div>
                </div>
                {/* Time slot pills */}
                {selectedDate && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 block">
                      Start time
                    </label>
                    {fetchingBookings ? (
                      <p className="text-sm text-slate-500 py-2">
                        Checking availability...
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {startTimeOptions.map(({ time, unavailableReason }) => (
                          <button
                            key={time}
                            type="button"
                            disabled={!!unavailableReason}
                            title={unavailableReason || undefined}
                            onClick={() => {
                              setSelectedTime(time);
                              if (!isDurationAvailable(time, parseFloat(duration))) {
                                setDuration("1");
                              }
                            }}
                            className={cn(
                              "rounded-xl border px-2 py-2 text-xs font-semibold transition-all",
                              unavailableReason &&
                                "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through opacity-70",
                              selectedTime === time && !unavailableReason
                                ? "border-[var(--site-accent)] bg-emerald-50 text-emerald-700 shadow-sm"
                                : !unavailableReason &&
                                  "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Duration pill buttons */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">
                    Duration
                  </label>
                  <div className="flex gap-2">
                    {durationOptions.map(({ value: dur, available }) => (
                      <button
                        key={dur}
                        type="button"
                        disabled={!available}
                        onClick={() => setDuration(dur)}
                        className={cn(
                          "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                          !available &&
                            "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70",
                          available && duration === dur
                            ? "border-[var(--site-accent)] bg-emerald-50 text-emerald-700 shadow-sm"
                            : available &&
                              "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        {dur} {parseFloat(dur) === 1 ? "hr" : "hrs"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">
                    Guests
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={court.maxGuests || undefined}
                    value={guestCount}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      if (!digits) {
                        setGuestCount("");
                        return;
                      }
                      const cappedGuests =
                        court.maxGuests && court.maxGuests > 0
                          ? Math.min(Number(digits), court.maxGuests)
                          : Number(digits);
                      setGuestCount(String(cappedGuests));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition-colors focus:border-[var(--site-accent)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--site-accent)_13%,transparent)]"
                    placeholder="1"
                  />
                  {court.maxGuests ? (
                    <p className="text-xs text-slate-500">Up to {court.maxGuests} guests.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">
                    Message to host
                  </label>
                  <textarea
                    value={initialMessage}
                    onChange={(event) => setInitialMessage(event.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium leading-5 text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-[var(--site-accent)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--site-accent)_13%,transparent)]"
                    placeholder="Share arrival notes or anything the host should know..."
                  />
                </div>

                {/* Price breakdown */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>
                      {duration} {parseFloat(duration) === 1 ? "hr" : "hrs"} × ${court.price}/hr
                    </span>
                    <span className="font-medium text-slate-800">
                      ${formatCents(priceBreakdown?.totalAmountCents || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span className="text-[var(--site-accent)]">
                      ${formatCents(priceBreakdown?.totalAmountCents || 0)}
                    </span>
                  </div>
                </div>

                {/* CTA button */}
                <Button
                  className="w-full rounded-2xl bg-[var(--site-accent)] hover:opacity-90 text-white font-bold py-3 text-base shadow-md transition-all"
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
                  <p className="text-xs text-center text-slate-500">
                    Hosts cannot book their own courts.
                  </p>
                )}

                {bookingStatus === "conflict" && (
                  <p className="text-red-500 text-xs text-center">
                    This time slot is already booked. Please choose another.
                  </p>
                )}
                {bookingStatus === "error" && (
                  <p className="text-red-500 text-xs text-center">
                    Something went wrong. Please try again.
                  </p>
                )}

                {/* Note */}
                <p className="text-xs text-slate-500 text-center leading-5">
                  Hosts have 24 hours to accept. Your card is authorized now and
                  only charged upon acceptance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AlertDialog
        open={duplicateRequestDialogOpen}
        onOpenChange={setDuplicateRequestDialogOpen}
      >
        <AlertDialogContent className="rounded-3xl border-slate-200 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-xl font-bold text-slate-950">
              You already have a request here
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6 text-slate-600">
              You already have a booking request for this court. Are you sure
              you want to make another one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-2">
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--site-accent)] text-white hover:bg-[var(--site-accent-hover)]"
              onClick={() => setPlayerWaiverOpen(true)}
            >
              Continue request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* ── Host profile dialog (inline, controlled by hostProfileDialogOpen) ── */}
      {hostProfile && (
        <Dialog open={hostProfileDialogOpen} onOpenChange={setHostProfileDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-slate-200 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-left text-xl font-bold text-slate-950">
                {hostProfile.displayName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              <Card className="rounded-[32px] border-slate-200 shadow-sm">
                <CardContent className="grid gap-8 p-8 sm:grid-cols-[1fr_170px] sm:p-10">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-28 w-28 border-4 border-white shadow-md md:h-32 md:w-32">
                      <AvatarImage
                        src={hostProfile.profileImageUrl || undefined}
                        alt={hostProfile.displayName}
                      />
                      <AvatarFallback className="bg-emerald-100 text-3xl font-bold text-emerald-800">
                        {hostProfile.displayName?.trim().charAt(0).toUpperCase() || "H"}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="mt-5 text-2xl font-bold text-slate-950 md:text-3xl">
                      {hostProfile.displayName}
                    </h2>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <Badge variant="secondary">Court host</Badge>
                      {hostProfile.ownerRating != null && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                          {hostProfile.ownerRating.toFixed(1)} host rating
                        </Badge>
                      )}
                    </div>
                    {hostProfile.bio ? (
                      <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 md:text-base md:leading-7">
                        {hostProfile.bio}
                      </p>
                    ) : (
                      <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 md:text-base md:leading-7">
                        This member has not added a bio yet.
                      </p>
                    )}
                  </div>

                  <div className="grid content-center divide-y divide-slate-200">
                    <div className="py-4 first:pt-0">
                      <p className="text-3xl font-black text-slate-950">
                        {hostProfile.listingsCount ?? 0}
                      </p>
                      <p className="text-sm font-semibold text-slate-600">Listings</p>
                    </div>
                    <div className="py-4">
                      <p className="text-3xl font-black text-slate-950">
                        {hostProfile.ownerReviewCount ?? hostReviews.length}
                      </p>
                      <p className="text-sm font-semibold text-slate-600">Reviews</p>
                    </div>
                    <div className="py-4">
                      <p className="text-3xl font-black text-slate-950">
                        {hostProfile.memberSince
                          ? Math.max(
                              0,
                              (new Date().getFullYear() -
                                new Date(hostProfile.memberSince).getFullYear()) *
                                12 +
                                new Date().getMonth() -
                                new Date(hostProfile.memberSince).getMonth()
                            )
                          : 0}
                      </p>
                      <p className="text-sm font-semibold text-slate-600">
                        Months on CourtShare
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[32px] border-slate-200 shadow-sm">
                <CardHeader>
                  <h3 className="text-xl font-bold text-slate-950">Host reviews</h3>
                  <p className="text-sm text-slate-500">
                    Feedback from players after completed bookings.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hostReviews.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      No host reviews yet.
                    </p>
                  ) : (
                    [...hostReviews]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt || 0).getTime() -
                          new Date(a.createdAt || 0).getTime()
                      )
                      .map((review) => (
                        <div
                          key={review.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-semibold text-slate-950">
                                {review.rating}/5
                              </span>
                              <Badge variant="outline">Host review</Badge>
                            </div>
                            <span className="text-xs text-slate-500">
                              {formatReviewDate(review.createdAt)}
                            </span>
                          </div>
                          {review.comment ? (
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {review.comment}
                            </p>
                          ) : null}
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
