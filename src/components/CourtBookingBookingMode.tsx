"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { db, isMockMode } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, KeyRound, MapPin, Star } from "lucide-react";
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
  isBookingReviewable,
} from "@/lib/bookingDates";
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
} from "@/lib/mockData";

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
  if (!iso) return 0;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth()
  );
};

export default function CourtBookingBookingMode({ bookingId }: { bookingId: string }) {
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

  const [reviewedBooking, setReviewedBooking] = useState(false);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewsDialogKind, setReviewsDialogKind] = useState<ReviewsDialogKind | null>(null);
  const [playerProfileDialogOpen, setPlayerProfileDialogOpen] = useState(false);

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

  const latestCourtReview = courtReviews[0];
  const latestHostReview = hostReviews[0];
  const latestPlayerReview = playerReviews[0];

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) return;
      if (!user) {
        setError("Please sign in to view this booking.");
        setLoading(false);
        return;
      }
      if (!bookingId) return;

      setLoading(true);
      setError("");

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
          `/api/reviews?bookingIds=${encodeURIComponent(resolvedBooking.id)}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        const reviewedJson = await reviewedRes.json().catch(() => ({}));
        setReviewedBooking(Boolean((reviewedJson.reviews || []).length > 0));
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
    if (!booking || !court || !viewerRole) return;
    if (booking.status !== "completed") return;

    const reviewable = isBookingReviewable(booking, new Date()) && booking.status === "completed";
    if (reviewable && !reviewedBooking) {
      setReviewDialogOpen(true);
    }
  }, [booking, court, reviewedBooking, viewerRole]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
            Pending Approval
          </Badge>
        );
      case "confirmed":
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
            Confirmed (Upcoming)
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      case "completed":
        return <Badge className="bg-slate-900 text-white">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const now = useMemo(() => new Date(), [bookingId, loading]);
  const pendingTimeRemaining = useMemo(() => {
    if (!booking) return null;
    if (booking.status !== "pending") return null;
    return formatPendingBookingTimeRemaining(booking as any, now);
  }, [booking, now]);

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

  /** On completed bookings: the other party’s review for this specific reservation. */
  const otherPartyReviewForThisBooking = useMemo(() => {
    if (!booking || booking.status !== "completed" || !viewerRole) return null;
    if (viewerRole === "player") {
      return (
        playerReviews.find(
          (r) => r.bookingId === booking.id && r.reviewerRole === "owner"
        ) || null
      );
    }
    return (
      courtReviews.find(
        (r) => r.bookingId === booking.id && r.reviewerRole === "player"
      ) ||
      hostReviews.find(
        (r) => r.bookingId === booking.id && r.reviewerRole === "player"
      ) ||
      null
    );
  }, [booking, courtReviews, hostReviews, playerReviews, viewerRole]);

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
  const canViewPrivateArrivalDetails = ["confirmed", "completed"].includes(booking.status);
  const privateCheckInInstructions =
    court.checkInInstructions || court.accessInstructions || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6">
        <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
          Booking Details
        </h1>

        <Card className="mb-6 border-0 shadow-elegant rounded-3xl">
          <CardContent className="flex flex-col items-start gap-3 p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">{statusBadge(booking.status)}</div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {formatBookingDateLong(booking.date)}
              </span>
              <span>
                {booking.time}
                {booking.duration ? ` · ${booking.duration}h` : ""}
              </span>
            </div>

            {booking.status === "pending" && pendingTimeRemaining && (
              <div className="w-full max-w-md rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-yellow-800">
                  <Clock className="h-4 w-4 shrink-0" />
                  {pendingTimeRemaining}
                </div>
                <p className="mt-1 text-xs text-yellow-700">
                  Host must accept before this request expires.
                </p>
              </div>
            )}

            {booking.cancelReason && (
              <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Cancel reason
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{booking.cancelReason}</p>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Payment capture is tied to host acceptance.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {/* Column 1: court gallery + description / reviews (single card) */}
          <CourtListingGalleryCard
            listingKey={court.id}
            court={court}
            latestCourtReview={latestCourtReview}
            onOpenCourtReviews={() => openReviewsDialog("court")}
          />

          {/* Column 2: this-booking review (completed) + host / player profile */}
          <div className="flex flex-col gap-6">
            {canViewPrivateArrivalDetails && (court.address || privateCheckInInstructions) && (
              <Card className="border-0 shadow-elegant rounded-3xl">
                <CardContent className="space-y-5 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Arrival Details
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      Address and check-in
                    </h2>
                  </div>
                  {court.address && (
                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                  {privateCheckInInstructions && (
                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Check-in instructions
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm font-medium leading-6 text-slate-900">
                          {privateCheckInInstructions}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {booking.status === "completed" && otherPartyReviewForThisBooking && (
              <Card className="border-0 shadow-elegant rounded-3xl">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {viewerRole === "player" ? "Host review for this booking" : "Player review for this booking"}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold text-slate-900">
                      {otherPartyReviewForThisBooking.rating}/5
                    </span>
                  </div>
                  {otherPartyReviewForThisBooking.comment ? (
                    <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-line">
                      {otherPartyReviewForThisBooking.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No written notes.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {viewerRole === "host" ? (
              <Card className="border-0 shadow-elegant rounded-3xl">
                <CardContent className="p-6">
                  <button
                    type="button"
                    onClick={() => setPlayerProfileDialogOpen(true)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    aria-label={`View profile for ${playerNameForBookingCard}`}
                  >
                    <Avatar className="h-14 w-14 shrink-0">
                      <AvatarImage
                        src={participantImageUrl}
                        alt={playerNameForBookingCard}
                      />
                      <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-800">
                        {playerNameForBookingCard.trim().charAt(0).toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug text-slate-900">
                      <span className="font-semibold text-slate-700">Booking Request From</span>
                      <span className="font-bold text-slate-950">{playerNameForBookingCard}</span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                        {playerRatingSummary}
                      </span>
                      <span className="text-slate-600">
                        (
                        {playerReviewCountForCard}{" "}
                        {playerReviewCountForCard === 1 ? "review" : "reviews"})
                      </span>
                    </div>
                  </button>
                </CardContent>
              </Card>
            ) : (
              <CourtListingHostCard
                hostProfile={hostProfile}
                hostReviews={hostReviews}
                ownerId={court.ownerId}
                avatarImageUrl={participantImageUrl}
              />
            )}
          </div>

          {/* Column 3: messages */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <BookingConversationChat
              conversationId={conversationId}
              otherParticipantName={participantDisplayName}
              otherParticipantImageUrl={participantImageUrl}
              courtName={court.name}
            />
          </div>
        </div>
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
