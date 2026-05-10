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
  Clock,
  MapPin,
  MessageCircle,
  Star,
  User,
  X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
  isActiveFutureBooking,
  isBookingCancellable,
  isBookingReviewable,
  isPendingBookingExpired,
  isPastOrInactiveBooking,
} from "@/lib/bookingDates";

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  conversationId?: string;
  durationMinutes?: number;
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
  const [showPastBookings, setShowPastBookings] = useState(false);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(
    new Set()
  );
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

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
              updateMockBooking(booking.id, { status: "expired" })
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
            ? { ...booking, status: "expired" }
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
            ownersMap[ownerId] = getMockUserDisplayName(ownerId) || "Court owner";
            return;
          }

          const ownerDoc = await getDoc(doc(db, "users", ownerId));
          ownersMap[ownerId] = ownerDoc.exists()
            ? getProfileDisplayName(ownerDoc.data(), "Court owner")
            : "Court owner";
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
        "Are you sure you want to cancel this booking? If payment has not been captured yet, the card authorization will be released."
      )
    ) {
      return;
    }
    setCancelling(bookingId);
    try {
      if (isMockMode) {
        await updateMockBooking(bookingId, { status: "cancelled" });
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
          b.id === bookingId ? { ...b, status: "cancelled" } : b
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

  const getCourtOwnerName = (booking: Booking) => {
    const ownerId = courts[booking.courtId]?.ownerId;
    return ownerId ? courtOwners[ownerId] || "Court owner" : "Court owner";
  };

  const openBookingConversation = (booking: Booking) => {
    const conversationId = booking.conversationId || `booking_${booking.id}`;
    router.push(`/messages?conversationId=${encodeURIComponent(conversationId)}`);
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
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Split bookings into upcoming and past
  const now = new Date();
  const upcoming = bookings.filter((booking) =>
    isActiveFutureBooking(booking, now)
  );
  const past = bookings.filter((booking) =>
    isPastOrInactiveBooking(booking, now)
  );
  const upcomingConfirmedCount = upcoming.filter(
    (b) => b.status === "confirmed"
  ).length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your bookings...</p>
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

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <AppHeader />
      <main className="w-full">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-3xl font-bold text-slate-950">
              Player Dashboard
            </h1>
            <section className="grid grid-cols-3 gap-2">
              {[
                { label: "Upcoming", value: upcomingConfirmedCount },
                { label: "Pending", value: pendingCount },
                { label: "Past", value: past.length },
              ].map(({ label, value }) => (
                <Card
                  key={label}
                  className="min-w-24 rounded-[32px] border-slate-200 bg-white shadow-sm"
                >
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>

          <section className="mt-6 space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Upcoming bookings
                    </h2>
                    <p className="text-sm text-slate-500">
                      Active reservations and requests that still need attention.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="w-fit rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {upcoming.length} active
                  </Badge>
                </div>

                {upcoming.length === 0 ? (
                  <div className="p-10 text-center">
                    <Calendar className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                      No upcoming bookings
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Start a search to find an available court.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {upcoming.map((booking) => {
                      const court = courts[booking.courtId];
                      const courtName = getCourtName(booking);
                      return (
                        <div
                          key={booking.id}
                          className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="flex min-w-0 gap-4">
                            <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-[24px] bg-slate-100">
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
                                <h3 className="truncate text-base font-semibold text-slate-950">
                                  {courtName}
                                </h3>
                                {getStatusBadge(booking.status)}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                <span className="inline-flex items-center">
                                  <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                                  {formatBookingDateWithDay(booking.date)}
                                </span>
                                <span className="inline-flex items-center">
                                  <Clock className="mr-1.5 h-4 w-4 text-slate-400" />
                                  {booking.time} for {booking.duration}h
                                </span>
                                <span className="inline-flex items-center">
                                  <MapPin className="mr-1.5 h-4 w-4 text-slate-400" />
                                  {court ? court.location : "Unknown location"}
                                </span>
                                <span className="inline-flex items-center">
                                  <User className="mr-1.5 h-4 w-4 text-slate-400" />
                                  Hosted by {getCourtOwnerName(booking)}
                                </span>
                              </div>
                              {court?.address && booking.status === "confirmed" && (
                                <div className="mt-2 text-sm">
                                  <GoogleMapsLink
                                    address={court.address}
                                    variant="link"
                                    className="font-medium text-emerald-700"
                                  >
                                    {court.address}
                                  </GoogleMapsLink>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 lg:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-slate-300"
                              onClick={() => openBookingConversation(booking)}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Message
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-slate-300"
                              onClick={() => router.push(`/booking/${booking.id}`)}
                            >
                              <User className="mr-2 h-4 w-4" />
                              Details
                            </Button>
                            {canCancelBooking(booking) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => handleCancel(booking.id)}
                                disabled={cancelling === booking.id}
                              >
                                <X className="mr-2 h-4 w-4" />
                                {cancelling === booking.id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex w-full items-center justify-between p-5 text-left">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        Past Bookings
                      </h2>
                      <p className="text-sm text-slate-500">
                        Cancelled, rejected, and completed reservations.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-md border-slate-300 bg-slate-50 text-slate-700"
                    >
                      {past.length} records
                    </Badge>
                  </div>

                  {past.length === 0 ? (
                    <div className="border-t border-slate-200 p-8 text-center text-sm text-slate-500">
                      No past bookings yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 border-t border-slate-200">
                      {past.map((booking) => {
                        const court = courts[booking.courtId];
                        const courtName = getCourtName(booking);
                        return (
                          <div
                            key={booking.id}
                            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-slate-950">
                                  {courtName}
                                </h3>
                                {getStatusBadge(booking.status)}
                              </div>
                              <p className="mt-1 text-sm text-slate-600">
                                {formatBookingDateWithDay(booking.date)} at {booking.time}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Hosted by {getCourtOwnerName(booking)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canReviewBooking(booking) && court && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit rounded-lg border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  onClick={() => setReviewingBooking(booking)}
                                >
                                  <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
                                  Review
                                </Button>
                              )}
                              {reviewedBookingIds.has(booking.id) && (
                                <Badge
                                  variant="outline"
                                  className="w-fit rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
                                >
                                  Reviewed
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit rounded-lg border-slate-300"
                                onClick={() => openBookingConversation(booking)}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Message
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit rounded-lg border-slate-300"
                                onClick={() => router.push(`/booking/${booking.id}`)}
                              >
                                <User className="mr-2 h-4 w-4" />
                                Details
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
