"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db, isMockMode } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Calendar,
  User,
  Clock,
  MapPin,
  Check,
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Settings,
  ExternalLink,
  Plus,
  ListChecks,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import InlineWeeklyCalendar from "@/components/InlineWeeklyCalendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteMockCourt,
  getMockBookingsForOwner,
  getMockCourts,
  getMockUserDisplayName,
  updateMockBooking,
  updateMockCourt,
} from "@/lib/mockData";
import {
  isPastOrInactiveBooking,
  isActionablePendingBooking,
  isPendingBookingExpired,
  parseBookingDateTime,
  sortBookingsAscending,
  sortBookingsDescending,
} from "@/lib/bookingDates";

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  price?: number;
  surface?: string;
  indoor?: boolean;
  numberOfCourts?: number;
  blockedTimes?: { [date: string]: string[] };
  blockedDates?: string[];
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: { [dayOfWeek: number]: string[] };
  courtSpecificAlwaysBlockedTimes?: { [courtNum: string]: string[] };
  courtSpecificAlwaysBlockedTimesByDay?: { [courtNum: string]: { [dayOfWeek: string]: string[] } };
  maxAdvanceBookingDays?: number | null;
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  courtNumber?: number;
  createdAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  expiresAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
}

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingUsers, setBookingUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [deletingCourtId, setDeletingCourtId] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null
  );
  const [acceptBookingConfirm, setAcceptBookingConfirm] = useState<{
    booking: Booking;
    court: Court;
  } | null>(null);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<{
    hasAccount: boolean;
    status: string;
    onboardingUrl?: string;
    accountId?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
  } | null>(null);
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    const fetchData = async () => {
      try {
        const courtsData: Court[] = isMockMode
          ? (getMockCourts().filter((court) => court.ownerId === user.uid) as Court[])
          : ((await getDocs(
              query(collection(db, "courts"), where("ownerId", "==", user.uid))
            )).docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Court[]);
        setCourts(courtsData);
        const courtIds = courtsData.map((c) => c.id);
        let bookingsData: Booking[] = [];
        if (courtIds.length > 0) {
          bookingsData = isMockMode
            ? (getMockBookingsForOwner(user.uid) as Booking[])
            : ((await getDocs(
                query(collection(db, "bookings"), where("courtId", "in", courtIds))
              )).docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Booking[]);
        }

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
                "[OWNER DASHBOARD] Failed to expire stale pending bookings",
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

        const uniqueUserIds = Array.from(
          new Set(bookingsData.map((booking) => booking.userId).filter(Boolean))
        );
        if (uniqueUserIds.length > 0) {
          try {
            if (isMockMode) {
              setBookingUsers(
                Object.fromEntries(
                  uniqueUserIds.map((userId) => [userId, getMockUserDisplayName(userId)])
                )
              );
            } else {
              const userEntries = await Promise.allSettled(
                uniqueUserIds.map(async (userId) => {
                  const userDoc = await getDoc(doc(db, "users", userId));
                  const userData = userDoc.data();
                  const displayName =
                    userData?.displayName ||
                    userData?.name ||
                    userData?.email ||
                    userId;
                  return [userId, displayName] as const;
                })
              );
              const resolvedEntries = userEntries
                .filter(
                  (entry): entry is PromiseFulfilledResult<readonly [string, string]> =>
                    entry.status === "fulfilled"
                )
                .map((entry) => entry.value);
              setBookingUsers(Object.fromEntries(resolvedEntries));
            }
          } catch (err) {
            console.warn(
              "[OWNER DASHBOARD] Unable to load booking user names:",
              err
            );
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Check Stripe Connect account status
  useEffect(() => {
    if (!user) return;

    if (isMockMode) {
      setStripeAccountStatus({
        hasAccount: true,
        status: "mock_active",
        accountId: "acct_mock",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
      return;
    }

    const checkStripeAccount = async () => {
      if (!user) return;
      setCheckingStripe(true);
      try {
        // SECURITY: Get Firebase ID token and send in Authorization header
        const idToken = await user.getIdToken();

        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const res = await fetch("/api/stripe/check-account-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorData = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.error(
            "[OWNER DASHBOARD] Stripe account check failed:",
            errorData
          );
          // Still show Connect flow so owners aren't stuck with no payout UI (e.g. transient errors).
          if (res.status !== 401) {
            setStripeAccountStatus({
              hasAccount: false,
              status: "check_failed",
            });
          }
          return;
        }

        const data = await res.json();
        setStripeAccountStatus(data);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn("[OWNER DASHBOARD] Stripe account check timed out");
        } else {
          console.error(
            "[OWNER DASHBOARD] Error checking Stripe account:",
            err
          );
        }
        setStripeAccountStatus({
          hasAccount: false,
          status: "check_failed",
        });
      } finally {
        setCheckingStripe(false);
      }
    };

    checkStripeAccount();
  }, [user]);

  const handleConnectStripe = async () => {
    if (!user) return;

    if (isMockMode) {
      setStripeAccountStatus({
        hasAccount: true,
        status: "mock_active",
        accountId: "acct_mock",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
      return;
    }

    setConnectingStripe(true);
    try {
      // SECURITY: Get Firebase ID token and send in Authorization header
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/create-connect-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        // Show the actual error message from the API
        const errorMsg =
          data.error || data.details || "Failed to create Stripe account";
        console.error("[OWNER DASHBOARD] Stripe Connect error:", data);
        setError(errorMsg);
        return;
      }

      if (data.onboardingUrl) {
        // Redirect to Stripe onboarding
        window.location.href = data.onboardingUrl;
      } else if (data.accountId && data.status === "active") {
        // Account already exists and is active
        console.log(
          "[OWNER DASHBOARD] Account already active:",
          data.accountId
        );
        setStripeAccountStatus(data);
        // Refresh the page to update UI
        window.location.reload();
      } else {
        setError(
          "Failed to create Stripe account. Please check console for details."
        );
        console.error("[OWNER DASHBOARD] Unexpected response:", data);
      }
    } catch (err) {
      console.error("Error connecting Stripe:", err);
      setError("Failed to connect Stripe account");
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleUpdateStripeAccount = async () => {
    if (!user) return;

    if (isMockMode) {
      return;
    }

    setConnectingStripe(true);
    try {
      // SECURITY: Get Firebase ID token and send in Authorization header
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/create-connect-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ update: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Failed to create update link";
        console.error("[OWNER DASHBOARD] Stripe update error:", data);
        setError(errorMsg);
        return;
      }

      if (data.updateUrl) {
        // Open Stripe Express Dashboard in new tab
        window.open(data.updateUrl, "_blank", "noopener,noreferrer");
      } else {
        setError("Failed to create update link");
        console.error("[OWNER DASHBOARD] Unexpected response:", data);
      }
    } catch (err) {
      console.error("Error updating Stripe account:", err);
      setError("Failed to update Stripe account");
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleDelete = async (courtId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this court? This cannot be undone."
      )
    )
      return;
    setDeletingCourtId(courtId);
    try {
      if (isMockMode) {
        await deleteMockCourt(courtId);
      } else {
        await deleteDoc(doc(db, "courts", courtId));
      }
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    } catch (err: any) {
      alert(err.message || "Failed to delete court");
    } finally {
      setDeletingCourtId(null);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setAcceptBookingConfirm(null);
    setUpdatingBookingId(bookingId);
    try {
      const bookingToAccept = bookings.find((booking) => booking.id === bookingId);
      if (!bookingToAccept || !isActionablePendingBooking(bookingToAccept)) {
        if (isMockMode) {
          await updateMockBooking(bookingId, { status: "expired" });
        } else {
          const idToken = await user?.getIdToken();
          await fetch("/api/expire-pending-bookings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify({ bookingIds: [bookingId] }),
          });
        }
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: "expired" } : b))
        );
        alert("This booking request has expired.");
        return;
      }

      if (isMockMode) {
        await updateMockBooking(bookingId, { status: "confirmed" });
      } else {
        const idToken = await user?.getIdToken();
        const res = await fetch("/api/accept-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ bookingId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to accept booking");
        }
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "confirmed" } : b
        )
      );

    } catch (err: any) {
      alert(err.message || "Failed to accept booking");
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to reject this booking? The card authorization will be released."
      )
    ) {
      return;
    }
    if (!user) {
      alert("You must be logged in to reject bookings");
      return;
    }
    setUpdatingBookingId(bookingId);
    try {
      if (isMockMode) {
        await updateMockBooking(bookingId, { status: "rejected" });
      } else {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/reject-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to reject booking");
        }
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "rejected" } : b))
      );
    } catch (err: any) {
      alert(err.message || "Failed to reject booking");
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleBlockedTimesUpdate = async (
    courtId: string,
    blockedTimes: { [date: string]: string[] }
  ) => {
    try {
      if (isMockMode) {
        await updateMockCourt(courtId, { blockedTimes });
      } else {
        await updateDoc(doc(db, "courts", courtId), { blockedTimes });
      }
      // Update local state
      setCourts((prev) =>
        prev.map((court) =>
          court.id === courtId ? { ...court, blockedTimes } : court
        )
      );
    } catch (err: any) {
      console.error("Error updating blocked times:", err);
      alert(err.message || "Failed to update blocked times");
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
            Pending
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading courts and bookings...
          </p>
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

  const courtsById = Object.fromEntries(courts.map((court) => [court.id, court]));
  const now = new Date();
  const activeBookings = bookings.filter(
    (booking) =>
      booking.status === "confirmed" || isActionablePendingBooking(booking, now)
  );
  const pendingBookings = activeBookings
    .filter((booking) => isActionablePendingBooking(booking, now))
    .sort(sortBookingsAscending);
  const upcomingBookings = activeBookings
    .filter(
      (booking) =>
        booking.status === "confirmed" &&
        parseBookingDateTime(booking.date, booking.time) >= new Date()
    )
    .sort(sortBookingsAscending);
  const pastBookings = bookings
    .filter((booking) => isPastOrInactiveBooking(booking))
    .sort(sortBookingsDescending);
  const estimatedRevenue = bookings
    .filter((booking) => booking.status === "confirmed")
    .reduce((sum, booking) => {
      const court = courtsById[booking.courtId];
      return sum + (court?.price || 0) * booking.duration;
    }, 0);
  const pendingPayments = pendingBookings.reduce((sum, booking) => {
    const court = courtsById[booking.courtId];
    return sum + (court?.price || 0) * booking.duration;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <AppHeader />

      <main className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-center xl:justify-between">
            <h1 className="text-3xl font-bold text-slate-950">
              Owner Dashboard
            </h1>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Upcoming bookings", value: upcomingBookings.length },
                { label: "Pending requests", value: pendingBookings.length },
                { label: "Past bookings", value: pastBookings.length },
                { label: "Total Revenue", value: `$${estimatedRevenue.toFixed(0)}` },
                { label: "Pending Payments", value: `$${pendingPayments.toFixed(0)}` },
              ].map(({ label, value }) => (
                <Card
                  key={label}
                  className="min-w-28 rounded-[32px] border-slate-200 bg-white shadow-sm"
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

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <aside>
              <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Your courts
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg border-black bg-white text-black hover:bg-slate-100 hover:text-black"
                    onClick={() => router.push("/create-listing")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Listing
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 p-5">

              {courts.length === 0 ? (
                <div className="rounded-[32px] border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  You have no courts listed yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {courts.map((court) => {
                    const courtBookings = activeBookings.filter(
                      (booking) => booking.courtId === court.id
                    );
                    const courtPendingBookings = pendingBookings.filter(
                      (booking) => booking.courtId === court.id
                    );

                    return (
                      <Card
                        key={court.id}
                        className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm"
                      >
                        <CardHeader className="p-4">
                          <div className="flex gap-3">
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[24px] bg-slate-100">
                              {court.imageUrl ? (
                                <Image
                                  src={court.imageUrl}
                                  alt={court.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                                  Court
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-base font-semibold text-slate-950">
                                {court.name}
                              </h3>
                              <p className="mt-1 flex items-center text-sm text-slate-600">
                                <MapPin className="mr-1.5 h-4 w-4 text-slate-400" />
                                {court.location}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-md">
                                  ${court.price || 0}/hr
                                </Badge>
                                {court.surface && (
                                  <Badge variant="outline" className="rounded-md">
                                    {court.surface}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="rounded-md">
                                  {courtPendingBookings.length} pending
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 border-t border-slate-100 p-4">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() =>
                                router.push(`/edit-listing/${court.id}`)
                              }
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit listing
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-slate-300"
                              onClick={() =>
                                setExpandedCourtId(
                                  expandedCourtId === court.id ? null : court.id
                                )
                              }
                            >
                              {expandedCourtId === court.id ? (
                                <ChevronUp className="mr-2 h-4 w-4" />
                              ) : (
                                <ChevronDown className="mr-2 h-4 w-4" />
                              )}
                              Availability
                            </Button>
                          </div>

                          {expandedCourtId === court.id && (
                            <div className="border-t border-slate-200 pt-4">
                              {(court.numberOfCourts || 1) > 1 ? (
                                <div className="space-y-2">
                                  {Array.from(
                                    { length: court.numberOfCourts || 1 },
                                    (_, i) => i + 1
                                  ).map((courtNum) => {
                                    const mergedAlwaysBlocked = [
                                      ...(court.alwaysBlockedTimes || []),
                                      ...((court.courtSpecificAlwaysBlockedTimes || {})[
                                        String(courtNum)
                                      ] || []),
                                    ];
                                    const mergedByDay: {
                                      [dayOfWeek: number]: string[];
                                    } = { ...(court.alwaysBlockedTimesByDay || {}) };
                                    const courtSpecificByDay =
                                      (court.courtSpecificAlwaysBlockedTimesByDay || {})[
                                        String(courtNum)
                                      ] || {};
                                    Object.entries(courtSpecificByDay).forEach(
                                      ([dayKey, times]) => {
                                        const dayNum = Number(dayKey);
                                        mergedByDay[dayNum] = [
                                          ...new Set([
                                            ...(mergedByDay[dayNum] || []),
                                            ...times,
                                          ]),
                                        ].sort();
                                      }
                                    );
                                    return (
                                      <InlineWeeklyCalendar
                                        key={courtNum}
                                        courtId={court.id}
                                        courtNumber={courtNum}
                                        courtLabel={`Court ${courtNum}`}
                                        blockedTimes={court.blockedTimes}
                                        blockedDates={court.blockedDates}
                                        alwaysBlockedTimes={mergedAlwaysBlocked}
                                        alwaysBlockedTimesByDay={mergedByDay}
                                        maxAdvanceBookingDays={
                                          court.maxAdvanceBookingDays
                                        }
                                        bookings={courtBookings}
                                        bookingUsers={bookingUsers}
                                        onBlockedTimesUpdate={(blockedTimes) =>
                                          handleBlockedTimesUpdate(
                                            court.id,
                                            blockedTimes
                                          )
                                        }
                                        onBookingUpdate={async (
                                          bookingId,
                                          status,
                                          bookingFromModal
                                        ) => {
                                          if (status === "confirmed") {
                                            if (bookingFromModal) {
                                              setAcceptBookingConfirm({
                                                booking: {
                                                  ...bookingFromModal,
                                                  courtId: court.id,
                                                },
                                                court,
                                              });
                                            } else {
                                              await handleAcceptBooking(bookingId);
                                            }
                                          } else if (status === "rejected") {
                                            await handleRejectBooking(bookingId);
                                          }
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              ) : (
                                <InlineWeeklyCalendar
                                  courtId={court.id}
                                  blockedTimes={court.blockedTimes}
                                  blockedDates={court.blockedDates}
                                  alwaysBlockedTimes={court.alwaysBlockedTimes}
                                  alwaysBlockedTimesByDay={
                                    court.alwaysBlockedTimesByDay
                                  }
                                  maxAdvanceBookingDays={
                                    court.maxAdvanceBookingDays
                                  }
                                  bookings={courtBookings}
                                  bookingUsers={bookingUsers}
                                  onBlockedTimesUpdate={(blockedTimes) =>
                                    handleBlockedTimesUpdate(court.id, blockedTimes)
                                  }
                                  onBookingUpdate={async (
                                    bookingId,
                                    status,
                                    bookingFromModal
                                  ) => {
                                    if (status === "confirmed") {
                                      if (bookingFromModal) {
                                        setAcceptBookingConfirm({
                                          booking: {
                                            ...bookingFromModal,
                                            courtId: court.id,
                                          },
                                          court,
                                        });
                                      } else {
                                        await handleAcceptBooking(bookingId);
                                      }
                                    } else if (status === "rejected") {
                                      await handleRejectBooking(bookingId);
                                    }
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
                </CardContent>
              </Card>
            </aside>

            <section>
              <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                <CardHeader className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Bookings
                  </h2>
                </CardHeader>
                <CardContent className="space-y-3 p-5">

          <details open className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-200 p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">
                  Pending Requests
                </h2>
                <Badge
                  variant="outline"
                  className="rounded-md border-amber-200 bg-amber-50 text-amber-700"
                >
                  {pendingBookings.length} pending
                </Badge>
              </div>
              <ChevronDown className="h-5 w-5 text-slate-500 group-open:hidden" />
              <ChevronUp className="hidden h-5 w-5 text-slate-500 group-open:block" />
            </summary>

            {pendingBookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No pending booking requests right now.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {pendingBookings.map((booking) => {
                  const court = courtsById[booking.courtId];
                  return (
                    <div
                      key={booking.id}
                      className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                    >
                      <div className="min-w-0">
                        <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
                          <h3 className="font-semibold text-slate-950">
                            {court?.name || booking.courtId}
                          </h3>
                          <Badge variant="outline" className="rounded-md">
                            Court {booking.courtNumber || 1}
                          </Badge>
                          {getStatusBadge(booking.status)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="inline-flex items-center">
                            <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                            {booking.date}
                          </span>
                          <span className="inline-flex items-center">
                            <Clock className="mr-1.5 h-4 w-4 text-slate-400" />
                            {booking.time} for {booking.duration}h
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="inline-flex items-center">
                            <User className="mr-1.5 h-4 w-4 text-slate-400" />
                            {bookingUsers[booking.userId] ||
                              `${booking.userId.slice(0, 12)}...`}
                          </span>
                          <span className="inline-flex items-center font-semibold text-emerald-700">
                            <Banknote className="mr-1.5 h-4 w-4" />
                            ${((court?.price || 0) * booking.duration).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:justify-end lg:self-end">
                        <Button
                          size="sm"
                          className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() =>
                            court && setAcceptBookingConfirm({ booking, court })
                          }
                          disabled={updatingBookingId === booking.id || !court}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-black text-black hover:bg-slate-100 hover:text-black"
                          onClick={() => handleRejectBooking(booking.id)}
                          disabled={updatingBookingId === booking.id}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </details>

              <details open className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Upcoming
                    </h2>
                    <Badge variant="outline" className="rounded-md">
                      {upcomingBookings.length} upcoming
                    </Badge>
                  </div>
                  <ChevronDown className="h-5 w-5 text-slate-500 group-open:hidden" />
                  <ChevronUp className="hidden h-5 w-5 text-slate-500 group-open:block" />
                </summary>
                {upcomingBookings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No upcoming bookings.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {upcomingBookings.map((booking) => {
                      const court = courtsById[booking.courtId];
                      return (
                        <div
                          key={booking.id}
                          className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-950">
                                {court?.name || booking.courtId}
                              </h3>
                              {getStatusBadge(booking.status)}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {booking.date} at {booking.time} for{" "}
                              {booking.duration}h
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">
                            ${((court?.price || 0) * booking.duration).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>

              <details className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-200 p-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Past
                    </h2>
                    <Badge variant="outline" className="rounded-md">
                      {pastBookings.length} past
                    </Badge>
                  </div>
                  <ChevronDown className="h-5 w-5 text-slate-500 group-open:hidden" />
                  <ChevronUp className="hidden h-5 w-5 text-slate-500 group-open:block" />
                </summary>
                {pastBookings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No past bookings yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {pastBookings.map((booking) => {
                      const court = courtsById[booking.courtId];
                      return (
                        <div
                          key={booking.id}
                          className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-950">
                                {court?.name || booking.courtId}
                              </h3>
                              {getStatusBadge(booking.status)}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {booking.date} at {booking.time}
                            </p>
                          </div>
                          <span className="text-sm text-slate-500">
                            {booking.duration}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>

      {/* Accept Booking Confirmation Modal */}
      <Dialog
        open={!!acceptBookingConfirm}
        onOpenChange={(open) => !open && setAcceptBookingConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Accept Booking</DialogTitle>
            <DialogDescription>
              Accept this booking request? The guest will be notified and the time slot will be reserved.
            </DialogDescription>
          </DialogHeader>
          {acceptBookingConfirm && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Court</span>
                  <span className="font-medium">{acceptBookingConfirm.court.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{acceptBookingConfirm.booking.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">
                    {acceptBookingConfirm.booking.time} ({acceptBookingConfirm.booking.duration}h)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Guest</span>
                  <span className="font-medium">
                    {bookingUsers[acceptBookingConfirm.booking.userId] ||
                      `${acceptBookingConfirm.booking.userId.slice(0, 12)}...`}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">You will receive</span>
                  <span className="font-bold text-emerald-600">
                    ${((acceptBookingConfirm.court.price || 0) * acceptBookingConfirm.booking.duration).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAcceptBookingConfirm(null)}
              disabled={updatingBookingId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                acceptBookingConfirm && handleAcceptBooking(acceptBookingConfirm.booking.id)
              }
              disabled={updatingBookingId !== null}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {updatingBookingId === acceptBookingConfirm?.booking.id ? (
                "Accepting..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Accept
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
