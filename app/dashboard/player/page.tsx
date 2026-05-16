"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db, isMockMode } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  MapPin,
  MessageCircle,
  Star,
  User,
  X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import GoogleMapsLink from "@/components/GoogleMapsLink";
import ReviewDialog from "@/components/ReviewDialog";
import {
  createMockReview,
  getMockBookingsForUser,
  getMockCourtById,
  getMockReviewsForUser,
  getMockUserDisplayName,
  updateMockBooking,
} from "@/lib/mockData";
import {
  formatBookingDateWithDay,
  formatPendingBookingTimeRemaining,
  isActiveFutureBooking,
  isBookingCancellable,
  isBookingReviewable,
  isPastOrInactiveBooking,
  isPendingBookingExpired,
  sortBookingsAscending,
  sortBookingsDescending,
} from "@/lib/bookingDates";

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  cancelReason?: string;
  conversationId?: string;
  durationMinutes?: number;
  totalAmountCents?: number;
  expectedAmountCents?: number;
  createdAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  expiresAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
}

interface Court {
  id: string;
  name: string;
  location: string;
  address?: string;
  imageUrl: string;
  price?: number;
  surface?: string;
  indoor?: boolean;
  ownerId?: string;
}

const getProfileDisplayName = (
  profile: Record<string, any> | undefined,
  fallback: string
) => {
  const displayName =
    typeof profile?.displayName === "string" ? profile.displayName.trim() : "";
  const name = typeof profile?.name === "string" ? profile.name.trim() : "";
  const emailPrefix =
    typeof profile?.email === "string" ? profile.email.split("@")[0].trim() : "";

  return displayName || name || emailPrefix || fallback;
};

export default function PlayerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Record<string, Court>>({});
  const [courtOwners, setCourtOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "cancelled" | "completed">(
    "upcoming"
  );
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(
    new Set()
  );
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const loadReviewedBookings = async (bookingsData: Booking[]) => {
    if (!user || bookingsData.length === 0) {
      setReviewedBookingIds(new Set());
      return;
    }

    try {
      if (isMockMode) {
        setReviewedBookingIds(
          new Set(getMockReviewsForUser(user.uid).map((review) => review.bookingId))
        );
        return;
      }

      const idToken = await user.getIdToken();
      const bookingIds = bookingsData.map((booking) => booking.id).join(",");
      const res = await fetch(
        `/api/reviews?bookingIds=${encodeURIComponent(bookingIds)}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load reviews");
      }

      setReviewedBookingIds(
        new Set(
          (data.reviews || []).map((review: { bookingId: string }) => review.bookingId)
        )
      );
    } catch (err) {
      console.warn("[PLAYER DASHBOARD] Unable to load review state:", err);
    }
  };

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      let bookingsData: Booking[] = isMockMode
        ? (getMockBookingsForUser(user.uid) as Booking[])
        : ((await getDocs(
            query(collection(db, "bookings"), where("userId", "==", user.uid))
          )).docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Booking[]);

      const expiredPendingBookings = bookingsData.filter((booking) =>
        isPendingBookingExpired(booking)
      );
      if (expiredPendingBookings.length > 0) {
        if (isMockMode) {
          await Promise.allSettled(
            expiredPendingBookings.map((booking) =>
              updateMockBooking(booking.id, {
                status: "expired",
                cancelReason: "host_acceptance_window_expired",
              })
            )
          );
        } else {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/expire-pending-bookings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              bookingIds: expiredPendingBookings.map((booking) => booking.id),
            }),
          });
          if (!res.ok) {
            console.warn(
              "[PLAYER DASHBOARD] Failed to expire stale pending bookings",
              await res.json().catch(() => ({}))
            );
          }
        }

        bookingsData = bookingsData.map((booking) =>
          expiredPendingBookings.some((expired) => expired.id === booking.id)
            ? {
                ...booking,
                status: "expired",
                cancelReason: "host_acceptance_window_expired",
              }
            : booking
        );
      }

      setBookings(bookingsData);
      await loadReviewedBookings(bookingsData);
      const courtIds = Array.from(new Set(bookingsData.map((b) => b.courtId)));
      const courtsMap: Record<string, Court> = {};
      await Promise.all(
        courtIds.map(async (courtId) => {
          if (isMockMode) {
            const court = getMockCourtById(courtId);
            if (court) courtsMap[courtId] = court as Court;
            return;
          }

          const courtDoc = await getDoc(doc(db, "courts", courtId));
          if (courtDoc.exists()) {
            courtsMap[courtId] = { id: courtId, ...courtDoc.data() } as Court;
          }
        })
      );
      setCourts(courtsMap);

      const ownerIds = Array.from(
        new Set(
          Object.values(courtsMap)
            .map((court) => court.ownerId)
            .filter((ownerId): ownerId is string => !!ownerId)
        )
      );
      const ownersMap: Record<string, string> = {};
      await Promise.all(
        ownerIds.map(async (ownerId) => {
          if (isMockMode) {
            ownersMap[ownerId] = getMockUserDisplayName(ownerId) || "Court host";
            return;
          }

          const res = await fetch(
            `/api/public-profiles/${encodeURIComponent(ownerId)}`
          );
          const data = await res.json().catch(() => ({}));
          ownersMap[ownerId] =
            res.ok && data.profile
              ? getProfileDisplayName(data.profile, "Court host")
              : "Court host";
        })
      );
      setCourtOwners(ownersMap);
    } catch (err: any) {
      setError(err.message || "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const handleCancel = async (bookingId: string) => {
    if (!user) return;
    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? If payment has not been completed yet, the card authorization will be released."
      )
    ) {
      return;
    }
    setCancelling(bookingId);
    try {
      if (isMockMode) {
        await updateMockBooking(bookingId, {
          status: "cancelled",
          cancelReason: "player_cancellation",
        });
      } else {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/cancel-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to cancel booking");
        }
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "cancelled", cancelReason: "player_cancellation" }
            : b
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancelling(null);
    }
  };

  // Booking can be cancelled only if it's more than 1 hour in the future
  const canCancelBooking = (booking: Booking): boolean => {
    return isBookingCancellable(booking);
  };

  const getCourtName = (booking: Booking) =>
    courts[booking.courtId]?.name || "Court unavailable";

  const getBookingPrice = (booking: Booking) => {
    const cents = booking.totalAmountCents || booking.expectedAmountCents;
    if (cents) return `$${(cents / 100).toFixed(2)}`;

    const court = courts[booking.courtId];
    const duration =
      booking.durationMinutes !== undefined
        ? booking.durationMinutes / 60
        : booking.duration;
    return court?.price && duration ? `$${(court.price * duration).toFixed(2)}` : "";
  };

  const getCourtOwnerName = (booking: Booking) => {
    const ownerId = courts[booking.courtId]?.ownerId;
    return ownerId ? courtOwners[ownerId] || "Court host" : "Court host";
  };

  const openBookingConversation = (booking: Booking) => {
    const conversationId = booking.conversationId || `booking_${booking.id}`;
    router.push(
      `/messages?conversationId=${encodeURIComponent(
        conversationId
      )}&bookingId=${encodeURIComponent(booking.id)}`
    );
  };

  const canReviewBooking = (booking: Booking) =>
    isBookingReviewable(booking) && !reviewedBookingIds.has(booking.id);

  const handleSubmitReview = async ({
    rating,
    comment,
  }: {
    rating: number;
    comment: string;
  }) => {
    if (!user || !reviewingBooking) return;

    setSubmittingReview(true);
    try {
      if (isMockMode) {
        await createMockReview({
          bookingId: reviewingBooking.id,
          reviewerId: user.uid,
          rating,
          comment,
        });
      } else {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            bookingId: reviewingBooking.id,
            rating,
            comment,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to submit review");
        }
      }

      setReviewedBookingIds((current) => new Set(current).add(reviewingBooking.id));
      setReviewingBooking(null);
    } catch (err: any) {
      alert(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-700 border-yellow-200"
          >
            Pending Approval
          </Badge>
        );
      case "confirmed":
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
            Confirmed
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
            Completed
          </Badge>
        );
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const now = new Date();
  const upcomingBookings = bookings
    .filter(
      (booking) =>
        (booking.status === "confirmed" || booking.status === "pending") &&
        isActiveFutureBooking(booking, now)
    )
    .sort(sortBookingsAscending);
  const cancelledRequests = bookings
    .filter((booking) =>
      ["cancelled", "expired", "rejected"].includes(booking.status)
    )
    .sort(sortBookingsDescending);
  const completedBookings = bookings
    .filter(
      (booking) =>
        booking.status === "completed" ||
        (booking.status === "confirmed" && isPastOrInactiveBooking(booking, now))
    )
    .sort(sortBookingsDescending);
  const visibleBookings =
    activeTab === "upcoming"
      ? upcomingBookings
      : activeTab === "cancelled"
        ? cancelledRequests
        : completedBookings;
  const pendingReviewCount = completedBookings.filter(canReviewBooking).length;
  const tabs = [
    {
      id: "upcoming" as const,
      label: "Upcoming Bookings",
      count: upcomingBookings.length,
      pendingCount: 0,
      Icon: Calendar,
    },
    {
      id: "completed" as const,
      label: "Completed",
      count: completedBookings.length,
      pendingCount: pendingReviewCount,
      Icon: CheckCircle,
    },
    {
      id: "cancelled" as const,
      label: "Cancelled Requests",
      count: cancelledRequests.length,
      pendingCount: 0,
      Icon: X,
    },
  ];

  if (loading) {
    return (
      <LoadingScreen
        message="Loading Your Bookings"
        detail="Checking your reservations, requests, and messages."
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

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-4xl font-black tracking-tight text-slate-950">
            Upcoming Bookings
          </h1>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Desktop sidebar — hidden on mobile */}
          <aside className="hidden space-y-6 lg:block">
            <nav className="space-y-3">
              {tabs.map(({ Icon, ...tab }) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-between rounded-[32px] px-6 py-5 text-left text-base font-bold transition ${
                    activeTab === tab.id
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-100"
                      : "text-slate-600 hover:bg-white/70"
                  }`}
                >
                  <span className="flex items-center gap-5">
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-pink-700">
                      <Icon className="h-5 w-5" />
                      {tab.pendingCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">
                          {tab.pendingCount}
                        </span>
                      )}
                    </span>
                    {tab.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            {/* Mobile tab dropdown — hidden on desktop */}
            {(() => {
              const activeTabData = tabs.find((t) => t.id === activeTab);
              const ActiveIcon = activeTabData?.Icon;
              return (
                <div className="relative lg:hidden">
                  <button
                    type="button"
                    onClick={() => setTabMenuOpen((p) => !p)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm"
                  >
                    <span className="flex items-center gap-3 font-bold text-slate-950">
                      {ActiveIcon && <ActiveIcon className="h-5 w-5 text-pink-700" />}
                      {activeTabData?.label}
                      {(activeTabData?.count ?? 0) > 0 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-600">
                          {activeTabData?.count}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-400 transition-transform ${tabMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {tabMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {tabs.map(({ Icon, ...tab }) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setActiveTab(tab.id); setTabMenuOpen(false); }}
                          className={`flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold transition-colors hover:bg-slate-50 ${activeTab === tab.id ? "bg-slate-50 text-slate-950" : "text-slate-700"}`}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-pink-600" />
                            {tab.label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="hidden lg:block">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">
                {activeTab === "upcoming"
                  ? "Upcoming Bookings"
                  : activeTab === "completed"
                    ? "Completed Bookings"
                    : "Cancelled Requests"}
              </h2>
              <p className="mt-2 text-slate-500">
                {activeTab === "upcoming"
                  ? "Confirmed reservations and pending requests that still need attention."
                  : activeTab === "completed"
                    ? "Your past court visits. Leave a review for bookings you haven't rated yet."
                    : "Expired, rejected, and cancelled booking requests."}
              </p>
            </div>

            {visibleBookings.length === 0 ? (
              <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                <CardContent className="p-10 text-center">
                  {activeTab === "completed" ? (
                    <CheckCircle className="mx-auto h-10 w-10 text-slate-300" />
                  ) : (
                    <Calendar className="mx-auto h-10 w-10 text-slate-300" />
                  )}
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {activeTab === "upcoming"
                      ? "No upcoming bookings"
                      : activeTab === "completed"
                        ? "No completed bookings yet"
                        : "No cancelled requests"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTab === "upcoming"
                      ? "Start a search to find an available court."
                      : activeTab === "completed"
                        ? "Your completed court visits will appear here."
                        : "Cancelled, expired, or rejected requests will appear here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {visibleBookings.map((booking) => {
                  const court = courts[booking.courtId];
                  const courtName = getCourtName(booking);
                  return (
                    <div
                      key={booking.id}
                      className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-5 text-left shadow-sm sm:grid-cols-[120px_minmax(0,1fr)]"
                    >
                      <div className="relative h-24 overflow-hidden rounded-[24px] bg-slate-100">
                        {court?.imageUrl ? (
                          <Image
                            src={court.imageUrl}
                            alt={courtName}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                            Court
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black text-slate-950">
                            {courtName}
                          </h3>
                          {getStatusBadge(activeTab === "completed" ? "completed" : booking.status)}
                          {getBookingPrice(booking) && (
                            <span className="text-sm font-extrabold text-[var(--site-accent)]">
                              {getBookingPrice(booking)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-500">
                          <span className="inline-flex items-center">
                            <User className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                            Hosted by {getCourtOwnerName(booking)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
                            <span className="inline-flex items-center">
                              <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                              {formatBookingDateWithDay(booking.date)}
                            </span>
                            <span className="inline-flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-slate-400" />
                              {booking.time} for {booking.duration}h
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeTab === "completed" && canReviewBooking(booking) && (
                              <Button
                                size="sm"
                                className="w-fit rounded-lg bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                                onClick={() => setReviewingBooking(booking)}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                Review
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit rounded-lg border-slate-300 px-4"
                              onClick={() => router.push(`/booking/${booking.id}`)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <ReviewDialog
        open={!!reviewingBooking}
        onOpenChange={(open) => !open && setReviewingBooking(null)}
        title="Review your booking"
        description={
          reviewingBooking
            ? `Rate ${getCourtName(reviewingBooking)} and your host.`
            : "Rate your court and host."
        }
        submitting={submittingReview}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
