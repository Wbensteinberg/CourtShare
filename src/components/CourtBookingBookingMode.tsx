"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { db, isMockMode } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronDown, Clock, KeyRound, ListChecks, MapPin, Star } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import ReviewsListDialog, { type ReviewsListDialogReview } from "@/components/ReviewsListDialog";
import ReviewDialog from "@/components/ReviewDialog";
import BookingConversationChat from "@/components/BookingConversationChat";
import CourtListingGalleryCard from "@/components/CourtListingGalleryCard";
import CourtListingHostCard from "@/components/CourtListingHostCard";
import {
  formatBookingDateLong,
  formatPendingBookingTimeRemaining,
  parseBookingDateTime,
  isBookingReviewable,
} from "@/lib/bookingDates";
import { formatBookingCancelReason } from "@/lib/bookingCancelReasons";
import { calculateBookingPriceBreakdown } from "@/lib/pricing";
import {
  createMockReview,
  getMockBookingById,
  getMockBookingsForUser,
  getMockCourtById,
  getMockCourts,
  getMockProfile,
  getMockReviewsForCourt,
  getMockReviewsForTarget,
  getMockReviewsForUser,
  updateMockBooking,
} from "@/lib/mockData";

const DECLINE_REASON_MAX_LENGTH = 280;

type Court = {
  id: string;
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  checkInType?: "self" | "host";
  checkInInstructions?: string;
  price?: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  surface?: string;
  indoor?: boolean;
  ownerId?: string;
  amenities?: string[];
  houseRules?: string[];
  additionalRules?: string;
  rating?: number;
  reviewCount?: number;
};

type Booking = {
  id: string;
  courtId: string;
  userId: string; // player
  ownerId?: string; // legacy/live compat, if present
  date: string;
  time: string;
  duration: number; // hours (back compat)
  durationMinutes?: number;
  status: string;
  cancelReason?: string;
  declineReason?: string;
  totalAmountCents?: number;
  expectedAmountCents?: number;
  ownerAmountCents?: number;
  courtShareFeeCents?: number;
  processingFeeCents?: number;
  applicationFeeCents?: number;
  createdAt?: any;
  expiresAt?: any;
  conversationId?: string;
};

type PublicProfile = {
  uid: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  playerRating?: number | null;
  playerReviewCount?: number;
  ownerRating?: number | null;
  ownerReviewCount?: number;
  isOwner: boolean;
  /** ISO timestamp from `users.createdAt` (public API). */
  memberSince?: string | null;
  /** Confirmed bookings as a player (`bookings.userId` + `status === "confirmed"`). */
  confirmedBookingsCount?: number;
  /** Courts listed by this user (`courts.ownerId`). */
  listingsCount?: number;
};

type ApiReview = ReviewsListDialogReview & {
  targetType?: string;
  reviewerRole?: string;
  bookingId?: string;
};

type ReviewsDialogKind = "court" | "host" | "player";

const sortReviewsNewestFirst = (list: ApiReview[]) =>
  [...list].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

const formatProfileReviewDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

/** Same calendar-month delta as `app/profile/page.tsx` `getMonthCount`. */
const getMonthCountFromMemberSince = (iso: string | null | undefined) => {
  if (!iso) return 1;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  return Math.max(
    1,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth()
  );
};

const formatCents = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return (value / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  });
};

const humanizeSlug = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function CourtBookingBookingMode({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [court, setCourt] = useState<Court | null>(null);

  const [playerProfile, setPlayerProfile] = useState<PublicProfile | null>(null);
  const [hostProfile, setHostProfile] = useState<PublicProfile | null>(null);

  const [courtReviews, setCourtReviews] = useState<ApiReview[]>([]);
  const [hostReviews, setHostReviews] = useState<ApiReview[]>([]);
  const [playerReviews, setPlayerReviews] = useState<ApiReview[]>([]);
  /** All reviews where this booking’s player is the reviewee (for host profile popup). */
  const [playerAllReceivedReviews, setPlayerAllReceivedReviews] = useState<ApiReview[]>([]);

  /** null until we know whether the viewer already submitted a review for this booking */
  const [reviewedBooking, setReviewedBooking] = useState<boolean | null>(null);
  /** null until loaded; whether the other participant submitted a review for this booking */
  const [counterpartyReviewedForThisBooking, setCounterpartyReviewedForThisBooking] = useState<boolean | null>(null);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewsDialogKind, setReviewsDialogKind] = useState<ReviewsDialogKind | null>(null);
  const [playerProfileDialogOpen, setPlayerProfileDialogOpen] = useState(false);
  const [hostProfileDialogOpen, setHostProfileDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const viewerRole = useMemo(() => {
    if (!user || !booking || !court?.ownerId) return null;
    if (booking.userId === user.uid) return "player";
    if (court.ownerId === user.uid) return "host";
    return null;
  }, [booking, court?.ownerId, user]);

  const conversationId = useMemo(() => {
    if (!booking) return `booking_${bookingId}`;
    return booking.conversationId || `booking_${booking.id}`;
  }, [booking, bookingId]);

  const [isActioning, setIsActioning] = useState<"accepting" | "declining" | "cancelling" | null>(null);

  const latestCourtReview = courtReviews[0];
  const latestHostReview = hostReviews[0];
  const latestPlayerReview = playerReviews[0];

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) return;
      if (!user) {
        router.replace(`/sign-in?redirect=${encodeURIComponent(`/booking/${bookingId}`)}`);
        return;
      }
      if (!bookingId) return;

      setLoading(true);
      setError("");
      setReviewedBooking(null);
      setCounterpartyReviewedForThisBooking(null);
      setReviewDialogOpen(false);

      try {
        if (isMockMode) {
          const mockBooking = getMockBookingById(bookingId);
          if (!mockBooking) {
            if (cancelled) return;
            setError("Booking not found.");
            setLoading(false);
            return;
          }
          const mockCourt = getMockCourtById(mockBooking.courtId);
          if (!mockCourt) {
            if (cancelled) return;
            setError("Court not found.");
            setLoading(false);
            return;
          }

          const hostId = mockCourt.ownerId;
          const playerId = mockBooking.userId;

          const isPlayer = playerId === user.uid;
          const isHost = hostId === user.uid;

          if (!isPlayer && !isHost) {
            if (cancelled) return;
            setError("You don’t have permission to view this booking.");
            setLoading(false);
            return;
          }

          if (cancelled) return;
          setBooking(mockBooking as Booking);
          setCourt(mockCourt as any as Court);

          const mockHostRow = hostId ? getMockProfile(hostId) : null;
          setHostProfile(
            mockHostRow
              ? {
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
                  listingsCount: getMockCourts().filter((c) => c.ownerId === hostId).length,
                }
              : null
          );
          const mockPlayerRow = getMockProfile(playerId);
          setPlayerProfile(
            mockPlayerRow
              ? {
                  uid: mockPlayerRow.uid,
                  displayName: mockPlayerRow.displayName,
                  bio: mockPlayerRow.bio || "",
                  profileImageUrl: mockPlayerRow.profileImageUrl || "",
                  isOwner: mockPlayerRow.isOwner,
                  playerRating: mockPlayerRow.playerRating ?? null,
                  playerReviewCount: mockPlayerRow.playerReviewCount ?? 0,
                  ownerRating: mockPlayerRow.ownerRating ?? null,
                  ownerReviewCount: mockPlayerRow.ownerReviewCount ?? 0,
                  memberSince: mockPlayerRow.createdAt ?? null,
                  confirmedBookingsCount: getMockBookingsForUser(playerId).filter(
                    (b) => b.status === "confirmed"
                  ).length,
                }
              : null
          );

          setCourtReviews(getMockReviewsForCourt(mockCourt.id) as any);
          setHostReviews(
            getMockReviewsForTarget(hostId).filter((r: any) => r.targetType === "court_owner")
          );
          const mockAllPlayerReceived = sortReviewsNewestFirst(
            getMockReviewsForTarget(playerId) as ApiReview[]
          );
          setPlayerAllReceivedReviews(mockAllPlayerReceived);
          setPlayerReviews(mockAllPlayerReceived.filter((r: any) => r.targetType === "player"));

          setReviewedBooking(
            getMockReviewsForUser(user.uid).some((r: any) => r.bookingId === mockBooking.id)
          );
          const counterpartyUid = isPlayer ? hostId : playerId;
          setCounterpartyReviewedForThisBooking(
            getMockReviewsForUser(counterpartyUid).some((r: any) => r.bookingId === mockBooking.id)
          );

          return;
        }

        const bookingRef = doc(db, "bookings", bookingId);
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) {
          if (cancelled) return;
          setError("Booking not found.");
          setLoading(false);
          return;
        }

        const bookingData = bookingSnap.data() as any;
        const resolvedBooking: Booking = {
          id: bookingSnap.id,
          ...bookingData,
        };

        const courtRef = doc(db, "courts", resolvedBooking.courtId);
        const courtSnap = await getDoc(courtRef);
        if (!courtSnap.exists()) {
          if (cancelled) return;
          setError("Court unavailable.");
          setLoading(false);
          return;
        }

        const resolvedCourt: Court = {
          id: courtSnap.id,
          ...(courtSnap.data() as any),
        };

        const hostId = resolvedCourt.ownerId;
        const playerId = resolvedBooking.userId;

        const isPlayer = playerId === user.uid;
        const isHost = hostId === user.uid;
        if (!isPlayer && !isHost) {
          if (cancelled) return;
          setError("You don’t have permission to view this booking.");
          setLoading(false);
          return;
        }

        const [hostRes, playerRes, courtReviewsRes] = await Promise.all([
          fetch(`/api/public-profiles/${encodeURIComponent(hostId || "")}`),
          fetch(`/api/public-profiles/${encodeURIComponent(playerId)}`),
          fetch(`/api/reviews?courtId=${encodeURIComponent(resolvedBooking.courtId)}`),
        ]);

        if (cancelled) return;

        const [hostJson, playerJson, courtJson] = await Promise.all([
          hostRes.json().catch(() => ({})),
          playerRes.json().catch(() => ({})),
          courtReviewsRes.json().catch(() => ({})),
        ]);

        if (!hostRes.ok || !playerRes.ok) {
          // Profiles are best-effort; the booking still works.
        }

        setBooking(resolvedBooking);
        setCourt(resolvedCourt);

        setHostProfile(hostRes.ok ? (hostJson.profile as PublicProfile) : null);
        setPlayerProfile(playerRes.ok ? (playerJson.profile as PublicProfile) : null);

        const courtRev: ApiReview[] = courtJson.reviews || [];
        setCourtReviews(courtRev);

        const [hostReviewsRes, playerReviewsRes] = await Promise.all([
          fetch(`/api/reviews?targetUserId=${encodeURIComponent(hostId || "")}`),
          fetch(`/api/reviews?targetUserId=${encodeURIComponent(playerId)}`),
        ]);

        const [hostReviewsJson, playerReviewsJson] = await Promise.all([
          hostReviewsRes.json().catch(() => ({})),
          playerReviewsRes.json().catch(() => ({})),
        ]);

        const allHostReviews: ApiReview[] = hostReviewsJson.reviews || [];
        const allPlayerReviews: ApiReview[] = playerReviewsJson.reviews || [];
        setHostReviews(allHostReviews.filter((r) => r.targetType === "court_owner"));
        setPlayerAllReceivedReviews(sortReviewsNewestFirst(allPlayerReviews));
        setPlayerReviews(allPlayerReviews.filter((r) => r.targetType === "player"));

        // Review-state for this booking (requires auth).
        const idToken = await user.getIdToken();
        const reviewedRes = await fetch(
          `/api/reviews?bookingIds=${encodeURIComponent(resolvedBooking.id)}&withPairedStatus=true`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        const reviewedJson = await reviewedRes.json().catch(() => ({}));
        setReviewedBooking(Boolean((reviewedJson.reviews || []).length > 0));
        setCounterpartyReviewedForThisBooking(
          (reviewedJson.counterpartyReviewedBookingIds || []).includes(resolvedBooking.id)
        );
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Failed to load booking.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, bookingId, user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="rounded-full border-yellow-200 bg-yellow-100 px-4 py-2 text-base font-black text-yellow-700">
            Pending Approval
          </Badge>
        );
      case "confirmed":
        return (
          <Badge className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-base font-black text-white shadow-md">
            Confirmed (Upcoming)
          </Badge>
        );
      case "past_confirmed":
        return (
          <Badge className="rounded-full bg-slate-900 px-4 py-2 text-base font-black text-white">
            Past Booking
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive" className="rounded-full px-4 py-2 text-base font-black">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="rounded-full px-4 py-2 text-base font-black">Cancelled</Badge>;
      case "expired":
        return <Badge variant="outline" className="rounded-full px-4 py-2 text-base font-black">Expired</Badge>;
      case "completed":
        return <Badge className="rounded-full bg-slate-900 px-4 py-2 text-base font-black text-white">Completed</Badge>;
      default:
        return <Badge variant="outline" className="rounded-full px-4 py-2 text-base font-black">{status}</Badge>;
    }
  };

  const now = currentTime;
  const bookingStart = useMemo(() => {
    if (!booking) return null;
    try {
      const value = parseBookingDateTime(booking.date, booking.time);
      return Number.isNaN(value.getTime()) ? null : value;
    } catch {
      return null;
    }
  }, [booking]);
  const bookingIsPast = !!bookingStart && bookingStart.getTime() < now.getTime();
  const displayStatus = useMemo(() => {
    if (!booking) return "";
    if (booking.status === "confirmed" && bookingIsPast) {
      return "past_confirmed";
    }
    return booking.status;
  }, [booking, bookingIsPast]);

  useEffect(() => {
    if (!booking || !court || !viewerRole) return;
    if (!["completed", "past_confirmed"].includes(displayStatus)) return;
    if (reviewedBooking !== false) return;

    const reviewable = isBookingReviewable(booking, new Date());
    if (reviewable) {
      setReviewDialogOpen(true);
    }
  }, [booking, court, displayStatus, reviewedBooking, viewerRole]);

  const pendingTimeRemaining = useMemo(() => {
    if (!booking) return null;
    if (booking.status !== "pending") return null;
    return formatPendingBookingTimeRemaining(booking as any, now);
  }, [booking, now]);

  // Cancel eligibility
  const hoursUntilReservation = useMemo(() => {
    if (!booking) return null;
    try {
      if (!bookingStart) return null;
      return (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    } catch {
      return null;
    }
  }, [booking, bookingStart, now]);

  const isWithin24Hours = hoursUntilReservation != null && hoursUntilReservation < 24;
  const playerCanCancel =
    !bookingIsPast &&
    (booking?.status === "pending" ||
      (booking?.status === "confirmed" && !isWithin24Hours));
  const playerCancelWithin24 =
    !bookingIsPast && booking?.status === "confirmed" && isWithin24Hours;
  const hostCanCancel = !bookingIsPast && booking?.status === "confirmed";

  const otherParticipant = useMemo(() => {
    if (!booking || !court || !viewerRole) return null;

    if (viewerRole === "player") {
      return {
        roleLabel: "Court host",
        profile: hostProfile,
        reviews: hostReviews,
        latestReview: latestHostReview,
        ratingValue: hostProfile?.ownerRating ?? null,
        reviewCount: hostProfile?.ownerReviewCount ?? 0,
      };
    }

    return {
      roleLabel: "Player",
      profile: playerProfile,
      reviews: playerReviews,
      latestReview: latestPlayerReview,
      ratingValue: playerProfile?.playerRating ?? null,
      reviewCount: playerProfile?.playerReviewCount ?? 0,
    };
  }, [booking, court, hostProfile, hostReviews, latestHostReview, latestPlayerReview, playerProfile, playerReviews, viewerRole]);

  const openReviewsDialog = (kind: ReviewsDialogKind) => setReviewsDialogKind(kind);

  const reviewsDialogData = useMemo(() => {
    if (!reviewsDialogKind) return null;
    if (reviewsDialogKind === "court") {
      return { title: "All court reviews", reviews: courtReviews as ReviewsListDialogReview[] };
    }
    if (reviewsDialogKind === "host") {
      return { title: "All host reviews", reviews: hostReviews as ReviewsListDialogReview[] };
    }
    return { title: "All player reviews", reviews: playerReviews as ReviewsListDialogReview[] };
  }, [courtReviews, hostReviews, playerReviews, reviewsDialogKind]);

  /** On completed bookings: the other party’s review for this reservation, gated on mutual review. */
  const otherPartyReviewForThisBooking = useMemo(() => {
    if (
      !booking ||
      !["completed", "past_confirmed"].includes(displayStatus) ||
      !viewerRole ||
      reviewedBooking !== true // only reveal once the viewer has also reviewed
    ) {
      return null;
    }
    if (viewerRole === "player") {
      // Host’s review of the player (targetType="player") — always public but gated above.
      return (
        playerReviews.find(
          (r) => r.bookingId === booking.id && r.reviewerRole === "owner"
        ) || null
      );
    }
    // Player’s review of the host/court (targetType="court_owner") — gated by API + above.
    return (
      courtReviews.find(
        (r) => r.bookingId === booking.id && r.reviewerRole === "player"
      ) ||
      hostReviews.find(
        (r) => r.bookingId === booking.id && r.reviewerRole === "player"
      ) ||
      null
    );
  }, [booking, courtReviews, displayStatus, hostReviews, playerReviews, reviewedBooking, viewerRole]);

  /** Mirrors signed-in profile “About Me” stats (confirmed trips, review count, tenure). */
  const playerAboutMeStats = useMemo(() => {
    if (!booking) return { bookings: 0, reviews: 0, months: 0 };
    const reviewCount =
      typeof playerProfile?.playerReviewCount === "number"
        ? playerProfile.playerReviewCount
        : playerAllReceivedReviews.length;
    let confirmedBookings = 0;
    if (typeof playerProfile?.confirmedBookingsCount === "number") {
      confirmedBookings = playerProfile.confirmedBookingsCount;
    } else if (isMockMode) {
      confirmedBookings = getMockBookingsForUser(booking.userId).filter(
        (b) => b.status === "confirmed"
      ).length;
    }
    const months = getMonthCountFromMemberSince(playerProfile?.memberSince ?? null);
    return {
      bookings: confirmedBookings,
      reviews: reviewCount,
      months,
    };
  }, [booking, playerAllReceivedReviews, playerProfile]);

  const handleAccept = async () => {
    if (!booking || isActioning) return;
    setIsActioning("accepting");
    try {
      if (isMockMode) {
        await updateMockBooking(booking.id, { status: "confirmed" });
        setBooking((prev) => prev ? { ...prev, status: "confirmed" } : null);
      } else {
        const idToken = await user!.getIdToken();
        const res = await fetch("/api/accept-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ bookingId: booking.id }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to accept");
        setBooking((prev) => prev ? { ...prev, status: "confirmed" } : null);
      }
      setAcceptDialogOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to accept booking");
    } finally {
      setIsActioning(null);
    }
  };

  const handleDecline = async (reason: string) => {
    if (!booking || isActioning) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      alert("Please write a reason before declining this booking.");
      return;
    }
    setIsActioning("declining");
    try {
      if (isMockMode) {
        await updateMockBooking(booking.id, {
          status: "rejected",
          declineReason: cleanReason,
        });
        setBooking((prev) =>
          prev ? { ...prev, status: "rejected", declineReason: cleanReason } : null
        );
      } else {
        const idToken = await user!.getIdToken();
        const res = await fetch("/api/reject-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ bookingId: booking.id, declineReason: cleanReason }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to decline");
        setBooking((prev) =>
          prev ? { ...prev, status: "rejected", declineReason: cleanReason } : null
        );
      }
      setDeclineDialogOpen(false);
      setDeclineReason("");
    } catch (e: any) {
      alert(e.message || "Failed to decline booking");
    } finally {
      setIsActioning(null);
    }
  };

  const handleCancel = async () => {
    if (!booking || isActioning) return;
    setIsActioning("cancelling");
    try {
      if (isMockMode) {
        await updateMockBooking(booking.id, { status: "cancelled" });
        setBooking((prev) => prev ? { ...prev, status: "cancelled" } : null);
      } else {
        const idToken = await user!.getIdToken();
        const res = await fetch("/api/cancel-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ bookingId: booking.id }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to cancel");
        setBooking((prev) => prev ? { ...prev, status: "cancelled" } : null);
      }
      setCancelDialogOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to cancel booking");
    } finally {
      setIsActioning(null);
    }
  };

  const handleSubmitReview = async (review: { rating: number; comment: string }) => {
    if (!user || !booking || !court) return;

    if (isMockMode) {
      await createMockReview({
        bookingId: booking.id,
        reviewerId: user.uid,
        rating: review.rating,
        comment: review.comment,
      });
      // Refresh review lists & review state.
      setHostReviews(
        getMockReviewsForTarget(court.ownerId || "").filter((r: any) => r.targetType === "court_owner")
      );
      const refreshedPlayerReceived = sortReviewsNewestFirst(
        getMockReviewsForTarget(booking.userId) as ApiReview[]
      );
      setPlayerAllReceivedReviews(refreshedPlayerReceived);
      setPlayerReviews(
        refreshedPlayerReceived.filter((r: any) => r.targetType === "player")
      );
      setCourtReviews(getMockReviewsForCourt(court.id) as any);
      setReviewedBooking(true);
      setReviewDialogOpen(false);
      return;
    }

    const idToken = await user.getIdToken();
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        bookingId: booking.id,
        rating: review.rating,
        comment: review.comment,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to submit review");

    // Refresh review lists & review state.
    const [courtRev, hostRev, playerRev] = await Promise.all([
      fetch(`/api/reviews?courtId=${encodeURIComponent(court.id)}`).then((r) => r.json().catch(() => ({}))),
      fetch(`/api/reviews?targetUserId=${encodeURIComponent(court.ownerId || "")}`).then((r) => r.json().catch(() => ({}))),
      fetch(`/api/reviews?targetUserId=${encodeURIComponent(booking.userId)}`).then((r) => r.json().catch(() => ({}))),
    ]);

    setCourtReviews((courtRev.reviews || []) as any);
    setHostReviews(((hostRev.reviews || []) as any).filter((r: any) => r.targetType === "court_owner"));
    const nextPlayerAll = sortReviewsNewestFirst((playerRev.reviews || []) as ApiReview[]);
    setPlayerAllReceivedReviews(nextPlayerAll);
    setPlayerReviews(nextPlayerAll.filter((r: any) => r.targetType === "player"));
    setReviewedBooking(true);
    setReviewDialogOpen(false);
  };

  if (loading || authLoading) {
    return (
      <LoadingScreen
        message="Loading Booking Details"
        detail="Opening the reservation, court, reviews, and chat."
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center p-8 bg-white/95 rounded-3xl shadow-2xl border border-white/30">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!booking || !court || !viewerRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center p-8 bg-white/95 rounded-3xl shadow-2xl border border-white/30">
          <p className="text-red-500 font-medium">Booking not found.</p>
        </div>
      </div>
    );
  }

  const participantDisplayName =
    otherParticipant?.profile?.displayName ||
    (viewerRole === "player" ? "Court host" : "Player");
  const participantImageUrl =
    otherParticipant?.profile?.profileImageUrl || undefined;

  const playerNameForBookingCard =
    playerProfile?.displayName || participantDisplayName || "Player";
  const playerRatingSummary =
    playerProfile?.playerRating != null
      ? playerProfile.playerRating.toFixed(1)
      : "New";
  const playerReviewCountForCard = playerProfile?.playerReviewCount ?? 0;
  const canViewPrivateArrivalDetails =
    viewerRole === "player" &&
    ["confirmed", "completed", "past_confirmed"].includes(displayStatus);
  const privateCheckInInstructions =
    court.checkInInstructions || court.accessInstructions || "";
  const fallbackBookingCostCents =
    typeof court.price === "number"
      ? Math.round(court.price * 100 * (booking.duration || 1))
      : null;
  const bookingCost = formatCents(
    booking.totalAmountCents ?? booking.expectedAmountCents ?? fallbackBookingCostCents
  );
  const bookingFinancials = (() => {
    const calculated =
      typeof court.price === "number"
        ? calculateBookingPriceBreakdown(
            court.price,
            booking.durationMinutes ?? Math.round((booking.duration || 1) * 60)
          )
        : null;
    const totalAmountCents =
      booking.totalAmountCents ?? booking.expectedAmountCents ?? calculated?.totalAmountCents;
    if (typeof totalAmountCents !== "number") return null;

    return {
      totalAmountCents,
      courtShareFeeCents:
        booking.courtShareFeeCents ?? calculated?.courtShareFeeCents ?? 0,
      processingFeeCents:
        booking.processingFeeCents ?? calculated?.processingFeeCents ?? 0,
      ownerAmountCents:
        booking.ownerAmountCents ?? calculated?.ownerAmountCents ?? totalAmountCents,
    };
  })();
  const hostName = hostProfile?.displayName?.trim() || "Court host";
  const hostAvatarUrl = hostProfile?.profileImageUrl || undefined;
  const hostRatingSummary =
    hostProfile?.ownerRating != null ? hostProfile.ownerRating.toFixed(1) : "New";
  const hostReviewCountForCard = hostProfile?.ownerReviewCount ?? hostReviews.length;
  const participantRatingSummary =
    otherParticipant?.ratingValue != null ? otherParticipant.ratingValue.toFixed(1) : "New";
  const participantReviewCount = otherParticipant?.reviewCount ?? 0;
  const participantRoleLabel = viewerRole === "player" ? "Host" : "Player";
  const openParticipantProfile = () => {
    if (viewerRole === "player") {
      setHostProfileDialogOpen(true);
    } else {
      setPlayerProfileDialogOpen(true);
    }
  };
  const goToCourtReviews = () => router.push(`/courts/${court.id}#reviews`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Card className="rounded-[36px] border-slate-200 bg-white shadow-elegant">
          <CardContent className="space-y-6 p-5 md:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                CourtShare Booking
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Booking Details
              </h1>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  {booking.status !== "pending" && <div>{statusBadge(displayStatus)}</div>}
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {formatBookingDateLong(booking.date)}
                    </span>
                    <span>
                      {booking.time}
                      {booking.duration ? ` · ${booking.duration}h` : ""}
                      {bookingCost ? ` · ${bookingCost}` : ""}
                    </span>
                  </div>
                  {booking.status === "pending" && (
                    <p className="text-xs text-slate-500">
                      The player&apos;s payment will only be completed if the host accepts this request.
                    </p>
                  )}
                </div>

                {booking.status === "pending" && pendingTimeRemaining && (
                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Clock className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 hover:bg-amber-100">
                            Pending Approval
                          </Badge>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                            Time left
                          </p>
                        </div>
                        <p className="font-mono text-lg font-black tabular-nums text-amber-950">
                          {pendingTimeRemaining}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-yellow-700">
                      {viewerRole === "host"
                        ? "You must accept before this request expires."
                        : "Host must accept before this request expires."}
                    </p>
                  </div>
                )}
              </div>

              {/* Host: accept / decline buttons for pending bookings */}
              {viewerRole === "host" && booking.status === "pending" && (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAcceptDialogOpen(true)}
                    disabled={!!isActioning}
                    className="flex-1 cursor-pointer rounded-2xl bg-[var(--site-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--site-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isActioning === "accepting" ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeclineReason("");
                      setDeclineDialogOpen(true);
                    }}
                    disabled={!!isActioning}
                    className="flex-1 cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isActioning === "declining" ? "Declining…" : "Decline"}
                  </button>
                </div>
              )}

              {/* Host: cancel button for confirmed bookings */}
              {viewerRole === "host" && hostCanCancel && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={!!isActioning}
                    className="w-full cursor-pointer rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isActioning === "cancelling" ? "Cancelling…" : "Cancel Booking"}
                  </button>
                </div>
              )}

              {/* Player: cancel / disabled cancel */}
              {viewerRole === "player" && (playerCanCancel || playerCancelWithin24) && (
                <div className="mt-4 space-y-1.5">
                  {playerCanCancel ? (
                    <button
                      type="button"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={!!isActioning}
                      className="w-full cursor-pointer rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActioning === "cancelling" ? "Cancelling…" : "Cancel Booking"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
                      >
                        Cancel Booking
                      </button>
                      <p className="text-center text-xs text-slate-500">
                        Cannot cancel within 24 hours — contact host directly.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Cancel reason — hide on rejected to avoid showing host's internal reason */}
              {booking.cancelReason && booking.status !== "rejected" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Cancel reason
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatBookingCancelReason(booking.cancelReason)}
                  </p>
                </div>
              )}

              {canViewPrivateArrivalDetails && court.address && (
                <div className="mt-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Exact address
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                      {court.address}
                    </p>
                  </div>
                </div>
              )}

              {viewerRole === "player" && displayStatus === "confirmed" && (
                <details className="group mt-4 rounded-2xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-950">
                    <span>See check-in details</span>
                    <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
                  </summary>
                  <div className="space-y-5 border-t border-slate-200 px-4 py-4">
                    {privateCheckInInstructions && (
                      <section className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                          <KeyRound className="h-4 w-4 text-[var(--site-accent)]" />
                          Check-in instructions
                        </div>
                        <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                          {privateCheckInInstructions}
                        </p>
                      </section>
                    )}

                    {((court.houseRules && court.houseRules.length > 0) || court.additionalRules) && (
                      <section className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                          <ListChecks className="h-4 w-4 text-[var(--site-accent)]" />
                          House rules
                        </div>
                        {court.houseRules && court.houseRules.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {court.houseRules.map((rule) => (
                              <Badge key={rule} variant="outline" className="border-slate-200 text-slate-700">
                                {humanizeSlug(rule)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {court.additionalRules && (
                          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                            {court.additionalRules}
                          </p>
                        )}
                      </section>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Review section — only on completed / past confirmed bookings */}
            {["completed", "past_confirmed"].includes(displayStatus) && viewerRole && (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                  {viewerRole === "player" ? "Host's review of you" : "Player's review of you"}
                </h2>

                {/* Case: viewer reviewed + other party reviewed → show the review */}
                {reviewedBooking === true && otherPartyReviewForThisBooking && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < (otherPartyReviewForThisBooking.rating ?? 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-slate-200 text-slate-200"
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-sm font-bold text-slate-900">
                        {otherPartyReviewForThisBooking.rating}/5
                      </span>
                    </div>
                    {otherPartyReviewForThisBooking.comment ? (
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {otherPartyReviewForThisBooking.comment}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-slate-400">No written comment.</p>
                    )}
                  </div>
                )}

                {/* Case: viewer reviewed + other party hasn't reviewed yet */}
                {reviewedBooking === true && !otherPartyReviewForThisBooking && (
                  <p className="text-sm leading-6 text-slate-500">
                    Waiting for{" "}
                    {viewerRole === "player"
                      ? hostProfile?.displayName?.trim() || "the host"
                      : playerProfile?.displayName?.trim() || "the player"}{" "}
                    to leave a review.
                  </p>
                )}

                {/* Case: other party reviewed + viewer hasn't reviewed → teaser */}
                {reviewedBooking === false && counterpartyReviewedForThisBooking === true && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">
                      {viewerRole === "player"
                        ? hostProfile?.displayName?.trim() || "The host"
                        : playerProfile?.displayName?.trim() || "The player"}{" "}
                      has already reviewed you.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Reviews are only revealed once both parties have shared their thoughts — leave
                      a review to see what they said.
                    </p>
                    <button
                      type="button"
                      onClick={() => setReviewDialogOpen(true)}
                      className="mt-3 cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Leave your review
                    </button>
                  </div>
                )}

                {/* Case: neither party has reviewed yet */}
                {reviewedBooking === false && counterpartyReviewedForThisBooking === false && (
                  booking && isBookingReviewable(booking, new Date()) ? (
                    <button
                      type="button"
                      onClick={() => setReviewDialogOpen(true)}
                      className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Leave a review
                    </button>
                  ) : (
                    <p className="text-sm text-slate-400">The review window for this booking has passed.</p>
                  )
                )}

                {/* Loading state */}
                {(reviewedBooking === null || counterpartyReviewedForThisBooking === null) && (
                  <p className="text-sm text-slate-400">Loading review status…</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div className="space-y-5">
                <CourtListingGalleryCard
                  listingKey={court.id}
                  court={court}
                  onOpenCourtReviews={goToCourtReviews}
                  onTitleClick={() => router.push(`/courts/${court.id}`)}
                  hideDescription
                  hideLatestCourtReview
                  descriptionPreviewCourtId={court.id}
                />

              </div>

              <div className="lg:sticky lg:top-24 lg:self-start">
                <BookingConversationChat
                  conversationId={conversationId}
                  otherParticipantName={participantDisplayName}
                  otherParticipantImageUrl={participantImageUrl}
                  courtName={court.name}
                  otherParticipantRoleLabel={participantRoleLabel}
                  otherParticipantRating={participantRatingSummary}
                  otherParticipantReviewCount={participantReviewCount}
                  onParticipantClick={openParticipantProfile}
                  showBookingMeta={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={playerProfileDialogOpen} onOpenChange={setPlayerProfileDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-slate-200 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold text-slate-950">
              {playerNameForBookingCard}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <Card className="rounded-[32px] border-slate-200 shadow-sm">
              <CardContent className="grid gap-8 p-8 sm:grid-cols-[1fr_170px] sm:p-10">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-md md:h-32 md:w-32">
                    <AvatarImage
                      src={playerProfile?.profileImageUrl || participantImageUrl || undefined}
                      alt={playerNameForBookingCard}
                    />
                    <AvatarFallback className="bg-emerald-100 text-3xl font-bold text-emerald-800">
                      {playerNameForBookingCard.trim().charAt(0).toUpperCase() || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="mt-5 text-2xl font-bold text-slate-950 md:text-3xl">
                    {playerNameForBookingCard}
                  </h2>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">
                      {playerProfile?.isOwner ? "Court host" : "Player"}
                    </Badge>
                    {(playerProfile?.ownerReviewCount ?? 0) > 0 && playerProfile?.ownerRating != null ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Host rating {playerProfile.ownerRating.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                  {playerProfile?.bio ? (
                    <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 md:text-base md:leading-7">
                      {playerProfile.bio}
                    </p>
                  ) : (
                    <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 md:text-base md:leading-7">
                      This member has not added a bio yet.
                    </p>
                  )}
                </div>

                <div className="grid content-center divide-y divide-slate-200">
                  <div className="py-4 first:pt-0">
                    <p className="text-3xl font-black text-slate-950">{playerAboutMeStats.bookings}</p>
                    <p className="text-sm font-semibold text-slate-600">Bookings</p>
                  </div>
                  <div className="py-4">
                    <p className="text-3xl font-black text-slate-950">{playerAboutMeStats.reviews}</p>
                    <p className="text-sm font-semibold text-slate-600">Reviews</p>
                  </div>
                  <div className="py-4">
                    <p className="text-3xl font-black text-slate-950">{playerAboutMeStats.months}</p>
                    <p className="text-sm font-semibold text-slate-600">Months on CourtShare</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-slate-200 shadow-sm">
              <CardHeader>
                <h3 className="text-xl font-bold text-slate-950">Reviews</h3>
                <p className="text-sm text-slate-500">
                  Feedback from completed CourtShare bookings.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {playerAllReceivedReviews.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    No reviews yet.
                  </p>
                ) : (
                  playerAllReceivedReviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-slate-950">{review.rating}/5</span>
                          <Badge variant="outline">
                            {review.targetType === "player"
                              ? "Player review"
                              : "Host and court review"}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatProfileReviewDate(review.createdAt)}
                        </span>
                      </div>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-6 text-slate-700">{review.comment}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <CourtListingHostCard
        hostProfile={hostProfile}
        hostReviews={hostReviews}
        ownerId={court.ownerId}
        avatarImageUrl={hostAvatarUrl}
        triggerVariant="none"
        open={hostProfileDialogOpen}
        onOpenChange={setHostProfileDialogOpen}
      />

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="rounded-3xl border-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold text-slate-950">
              Accept booking request?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Confirming will complete the player&apos;s payment and lock in
              this reservation.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Player pays</span>
                <span className="font-bold text-slate-950">
                  {formatCents(bookingFinancials?.totalAmountCents ?? 0)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-slate-500">CourtShare fee</span>
                <span className="font-medium text-slate-700">
                  -{formatCents(bookingFinancials?.courtShareFeeCents ?? 0)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-slate-500">Card processing</span>
                <span className="font-medium text-slate-700">
                  -{formatCents(bookingFinancials?.processingFeeCents ?? 0)}
                </span>
              </div>
              <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-950">You get paid</span>
                <span className="font-black text-emerald-700">
                  {formatCents(bookingFinancials?.ownerAmountCents ?? 0)}
                </span>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setAcceptDialogOpen(false)}
                disabled={!!isActioning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAccept}
                disabled={!!isActioning}
              >
                {isActioning === "accepting" ? "Accepting..." : "Accept booking"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="rounded-3xl border-slate-200 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold text-slate-950">
              Decline booking request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Please tell the player why this request is being declined. This
              reason will appear in the booking conversation and their email.
            </p>
            <Textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder="Example: I'm sorry—I have a scheduling conflict that day and can't accommodate this booking."
              className="min-h-28 resize-none rounded-2xl border-slate-200"
              maxLength={DECLINE_REASON_MAX_LENGTH}
            />
            <div className="flex justify-end text-xs font-medium text-slate-400">
              {declineReason.length}/{DECLINE_REASON_MAX_LENGTH}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                onClick={() => setDeclineDialogOpen(false)}
                disabled={!!isActioning}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
                  declineReason.trim()
                    ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    : "border border-slate-300 bg-white text-slate-400"
                }`}
                onClick={() => handleDecline(declineReason)}
                disabled={!!isActioning || !declineReason.trim()}
              >
                {isActioning === "declining" ? "Declining..." : "Decline booking"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-slate-200 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-xl font-bold text-slate-950">
              Cancel booking?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6 text-slate-600">
              Are you sure you want to cancel this booking? This will update the
              booking status and handle any payment authorization or refund
              server-side.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-2">
            <AlertDialogCancel disabled={!!isActioning}>
              Keep booking
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleCancel}
              disabled={!!isActioning}
            >
              {isActioning === "cancelling" ? "Cancelling..." : "Yes, cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReviewsListDialog
        open={!!reviewsDialogKind}
        onOpenChange={(open) => {
          if (!open) setReviewsDialogKind(null);
        }}
        title={reviewsDialogData?.title || "All reviews"}
        reviews={reviewsDialogData?.reviews || []}
      />

      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) {
            // If they closed it without submitting, we keep it closed.
          }
        }}
        title={
          viewerRole === "host" ? "Review this player" : "Review your booking"
        }
        description={
          viewerRole === "host"
            ? participantDisplayName
              ? `Rate your experience with ${participantDisplayName}.`
              : "Rate your experience with this player."
            : participantDisplayName
              ? `Rate ${participantDisplayName} and the court.`
              : "Rate your court and host."
        }
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
