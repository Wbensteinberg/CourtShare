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
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  MessageCircle,
  Star,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import InlineWeeklyCalendar from "@/components/InlineWeeklyCalendar";
import ReviewDialog from "@/components/ReviewDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createMockReview,
  deleteMockCourt,
  getMockBookingsForOwner,
  getMockCourts,
  getMockProfile,
  getMockReviewsForTarget,
  getMockReviewsForUser,
  getMockUserDisplayName,
  updateMockBooking,
  updateMockCourt,
} from "@/lib/mockData";
import {
  formatBookingDateWithDay,
  formatPendingBookingTimeRemaining,
  isPastOrInactiveBooking,
  isActionablePendingBooking,
  isBookingReviewable,
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
  cancelReason?: string;
  courtNumber?: number;
  createdAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  expiresAt?: Date | string | number | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  conversationId?: string;
  totalAmountCents?: number;
  ownerAmountCents?: number;
  durationMinutes?: number;
}

interface PublicReview {
  id: string;
  bookingId: string;
  courtId: string;
  reviewerRole?: string;
  targetType?: string;
  rating: number;
  comment: string;
  createdAt?: string | null;
}

type EarningsRange = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

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

const formatReviewDate = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const earningsRangeLabels: Record<EarningsRange, string> = {
  "1w": "1w",
  "1m": "1m",
  "3m": "3m",
  "6m": "6m",
  "1y": "1y",
  all: "All",
};

type BookingUserSummary = {
  displayName: string;
  profileImageUrl?: string;
};

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingUsers, setBookingUsers] = useState<Record<string, BookingUserSummary>>({});
  const [clockNow, setClockNow] = useState(() => new Date());
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(
    new Set()
  );
  const [receivedReviews, setReceivedReviews] = useState<PublicReview[]>([]);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
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
    mode?: "test" | "live";
    requirementsCurrentlyDue?: string[];
    requirementsPastDue?: string[];
    requirementsEventuallyDue?: string[];
    disabledReason?: string | null;
  } | null>(null);
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null);
  const [earningsRange, setEarningsRange] = useState<EarningsRange>("3m");
  const [showAddCourtDialog, setShowAddCourtDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "upcoming"
    | "courts"
    | "earnings"
    | "reviews"
    | "completed"
    | "cancelled"
  >("upcoming");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "courts") {
      setActiveTab("courts");
    }
    if (params.get("addCourt") === "1") {
      setActiveTab("courts");
      setShowAddCourtDialog(true);
    }
  }, []);

  const openAddCourtDialog = () => {
    setActiveTab("courts");
    setShowAddCourtDialog(true);
  };

  const closeAddCourtDialog = () => {
    setShowAddCourtDialog(false);
    router.replace("/host?tab=courts", { scroll: false });
  };

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
      console.warn("[OWNER DASHBOARD] Unable to load review state:", err);
    }
  };

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
                "[OWNER DASHBOARD] Failed to expire stale pending bookings",
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
        if (isMockMode) {
          setReceivedReviews(
            getMockReviewsForTarget(user.uid)
              .filter((review) => review.reviewerRole === "player")
              .map((review) => ({
                id: review.id,
                bookingId: review.bookingId,
                courtId: review.courtId,
                reviewerRole: review.reviewerRole,
                targetType: review.targetType,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
              }))
          );
        } else {
          const reviewsRes = await fetch(
            `/api/reviews?targetUserId=${encodeURIComponent(user.uid)}`
          );
          const reviewsData = await reviewsRes.json().catch(() => ({}));
          setReceivedReviews(
            reviewsRes.ok
              ? (reviewsData.reviews || []).filter(
                  (review: PublicReview) => review.reviewerRole === "player"
                )
              : []
          );
        }

        const uniqueUserIds = Array.from(
          new Set(bookingsData.map((booking) => booking.userId).filter(Boolean))
        );
        if (uniqueUserIds.length > 0) {
          try {
            if (isMockMode) {
              setBookingUsers(
                Object.fromEntries(
                  uniqueUserIds.map((userId) => {
                    const profile = getMockProfile(userId);
                    return [
                      userId,
                      {
                        displayName:
                          getProfileDisplayName(profile || undefined, "Player") ||
                          getMockUserDisplayName(userId) ||
                          "Player",
                        profileImageUrl: profile?.profileImageUrl,
                      },
                    ];
                  })
                )
              );
            } else {
              const userEntries = await Promise.allSettled<readonly [string, BookingUserSummary]>(
                uniqueUserIds.map(async (userId) => {
                  const res = await fetch(
                    `/api/public-profiles/${encodeURIComponent(userId)}`
                  );
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(data.error || "Failed to load player");
                  }
                  const displayName = getProfileDisplayName(data.profile, "Player");
                  return [
                    userId,
                    {
                      displayName,
                      profileImageUrl: data.profile?.profileImageUrl,
                    },
                  ] as const;
                })
              );
              const resolvedEntries = userEntries
                .filter((entry) => entry.status === "fulfilled")
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
        requirementsCurrentlyDue: [],
        requirementsPastDue: [],
        requirementsEventuallyDue: [],
        disabledReason: null,
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
          // Still show Connect flow so hosts aren't stuck with no payout UI (e.g. transient errors).
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
        requirementsCurrentlyDue: [],
        requirementsPastDue: [],
        requirementsEventuallyDue: [],
        disabledReason: null,
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
          await updateMockBooking(bookingId, {
            status: "expired",
            cancelReason: "host_acceptance_window_expired",
          });
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
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status: "expired",
                  cancelReason: "host_acceptance_window_expired",
                }
              : b
          )
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
        await updateMockBooking(bookingId, {
          status: "rejected",
          cancelReason: "host_rejection",
        });
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
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "rejected", cancelReason: "host_rejection" }
            : b
        )
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
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBookingPlayerName = (booking: Booking) =>
    bookingUsers[booking.userId]?.displayName || "Player";

  const getBookingPlayerImage = (booking: Booking) =>
    bookingUsers[booking.userId]?.profileImageUrl || "";

  const getBookingPlayerInitial = (booking: Booking) =>
    getBookingPlayerName(booking).trim().charAt(0).toUpperCase() || "P";

  const getBookingCourtName = (booking: Booking) =>
    courtsById[booking.courtId]?.name || "Court unavailable";

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

  if (loading) {
    return (
      <LoadingScreen
        message="Loading Host Dashboard"
        detail="Syncing your courts, reservations, payouts, and reviews."
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
  const estimatedEarnings = bookings
    .filter((booking) => booking.status === "confirmed")
    .reduce((sum, booking) => {
      const court = courtsById[booking.courtId];
      return (
        sum +
        (typeof booking.ownerAmountCents === "number"
          ? booking.ownerAmountCents / 100
          : (court?.price || 0) * booking.duration)
      );
    }, 0);
  const pendingPayments = pendingBookings.reduce((sum, booking) => {
    const court = courtsById[booking.courtId];
    return (
      sum +
      (typeof booking.ownerAmountCents === "number"
        ? booking.ownerAmountCents / 100
        : (court?.price || 0) * booking.duration)
    );
  }, 0);
  const bookingUserNames = Object.fromEntries(
    Object.entries(bookingUsers).map(([userId, profile]) => [
      userId,
      profile.displayName,
    ])
  );
  const earningsBookings = bookings
    .filter((booking) => ["confirmed", "completed"].includes(booking.status))
    .map((booking) => {
      const date = parseBookingDateTime(booking.date, booking.time);
      const court = courtsById[booking.courtId];
      const earnings =
        typeof booking.ownerAmountCents === "number"
          ? booking.ownerAmountCents / 100
          : (court?.price || 0) * booking.duration;
      return { date, earnings };
    })
    .filter((item) => !Number.isNaN(item.date.getTime()));
  const earningsCutoff = (() => {
    if (earningsRange === "all") return null;
    const cutoff = new Date();
    const daysByRange: Record<Exclude<EarningsRange, "all">, number> = {
      "1w": 7,
      "1m": 30,
      "3m": 90,
      "6m": 180,
      "1y": 365,
    };
    cutoff.setDate(cutoff.getDate() - daysByRange[earningsRange]);
    return cutoff;
  })();
  const filteredEarningsBookings = earningsCutoff
    ? earningsBookings.filter((item) => item.date >= earningsCutoff)
    : earningsBookings;
  const earningsByDate = filteredEarningsBookings
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .reduce<Record<string, number>>((acc, item) => {
      const key = item.date.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + item.earnings;
      return acc;
    }, {});
  const earningsChartData = Object.entries(earningsByDate).map(
    ([date, earnings]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      earnings: Math.round(earnings * 100) / 100,
    })
  );
  const chartEarningsTotal = earningsChartData.reduce(
    (sum, item) => sum + item.earnings,
    0
  );
  const payoutStatusLabel = checkingStripe
    ? "Checking"
    : !stripeAccountStatus?.hasAccount
      ? "Not connected"
      : stripeAccountStatus.status === "active" ||
          stripeAccountStatus.status === "mock_active"
        ? "Active"
        : stripeAccountStatus.status === "pending"
          ? "Setup incomplete"
          : "Restricted";
  const payoutSetupIncomplete =
    !checkingStripe && payoutStatusLabel !== "Active";
  const payoutStatusTone =
    payoutStatusLabel === "Active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const payoutActionLabel = !stripeAccountStatus?.hasAccount
    ? "Set up payouts"
    : stripeAccountStatus.status === "active" ||
        stripeAccountStatus.status === "mock_active"
      ? "Manage payout account"
      : "Finish setup";
  const payoutAction = !stripeAccountStatus?.hasAccount
    ? handleConnectStripe
    : stripeAccountStatus.status === "active" ||
        stripeAccountStatus.status === "mock_active"
      ? handleUpdateStripeAccount
      : handleConnectStripe;
  const payoutRequirements = [
    ...(stripeAccountStatus?.requirementsPastDue || []),
    ...(stripeAccountStatus?.requirementsCurrentlyDue || []),
  ];
  const payoutRequirementCount = new Set(payoutRequirements).size;
  const payoutStatusDescription =
    payoutStatusLabel === "Active"
      ? "Your Stripe Express account is ready to receive payouts."
      : !stripeAccountStatus?.hasAccount
        ? "Connect Stripe Express before accepting paid booking requests."
        : payoutRequirementCount > 0
          ? `Stripe still needs ${payoutRequirementCount} ${
              payoutRequirementCount === 1 ? "item" : "items"
            } before payouts are active.`
          : "You started setup, but Stripe has not marked payouts active yet.";

  const upcomingReservations = [...pendingBookings, ...upcomingBookings].sort(
    sortBookingsAscending
  );
  const completedReservations = pastBookings.filter((booking) =>
    ["confirmed", "completed"].includes(booking.status)
  );
  const cancelledReservations = bookings
    .filter((booking) =>
      ["cancelled", "expired", "rejected"].includes(booking.status)
    )
    .sort(sortBookingsDescending);
  const reviewReservations = completedReservations.filter(
    (booking) => canReviewBooking(booking) || reviewedBookingIds.has(booking.id)
  );
  const hostTabs = [
    {
      id: "upcoming" as const,
      label: "Upcoming Reservations",
      count: upcomingReservations.length,
      Icon: Calendar,
    },
    {
      id: "courts" as const,
      label: "Your Courts",
      count: courts.length,
      Icon: Building2,
    },
    {
      id: "earnings" as const,
      label: "Earnings",
      count: `$${estimatedEarnings.toFixed(0)}`,
      Icon: Banknote,
    },
    {
      id: "reviews" as const,
      label: "Reviews",
      count: receivedReviews.length,
      Icon: Star,
    },
    {
      id: "completed" as const,
      label: "Completed Reservations",
      count: completedReservations.length,
      Icon: ListChecks,
    },
    {
      id: "cancelled" as const,
      label: "Cancelled Reservations",
      count: cancelledReservations.length,
      Icon: X,
    },
  ];

  const renderReservationList = (
    reservations: Booking[],
    emptyMessage: string,
    options: { pendingActions?: boolean; reviewActions?: boolean } = {}
  ) => {
    if (reservations.length === 0) {
      return (
        <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-slate-600">{emptyMessage}</CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {reservations.map((booking) => {
          const court = courtsById[booking.courtId];
          const courtName = getBookingCourtName(booking);
          const amount =
            typeof booking.ownerAmountCents === "number"
              ? booking.ownerAmountCents / 100
              : (court?.price || 0) * booking.duration;

          return (
            <div
              key={booking.id}
              className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-5 text-left shadow-sm sm:grid-cols-[144px_minmax(0,1fr)]"
            >
              <div className="relative h-28 overflow-hidden rounded-[24px] bg-slate-100">
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
                  <h3 className="truncate text-xl font-black text-slate-950">
                    {courtName}
                  </h3>
                  <Badge variant="outline" className="rounded-md">
                    Court {booking.courtNumber || 1}
                  </Badge>
                  {getStatusBadge(booking.status)}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
                  <span className="inline-flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                    {formatBookingDateWithDay(booking.date)}
                  </span>
                  <span className="inline-flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-slate-400" />
                    {booking.time} for {booking.duration}h
                  </span>
                  <span className="inline-flex items-center">
                    <User className="mr-2 h-4 w-4 text-slate-400" />
                    {getBookingPlayerName(booking)}
                  </span>
                  <span className="inline-flex items-center font-semibold text-emerald-700">
                    <Banknote className="mr-2 h-4 w-4" />${amount.toFixed(2)}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg border-slate-300"
                    onClick={() => router.push(`/booking/${booking.id}`)}
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg border-slate-300"
                    onClick={() => openBookingConversation(booking)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Message
                  </Button>
                  {options.pendingActions && booking.status === "pending" && (
                    <>
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
                    </>
                  )}
                  {options.reviewActions && canReviewBooking(booking) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      onClick={() => setReviewingBooking(booking)}
                    >
                      <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
                      Review player
                    </Button>
                  )}
                  {options.reviewActions && reviewedBookingIds.has(booking.id) && (
                    <Badge
                      variant="outline"
                      className="rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
                    >
                      Reviewed
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 w-full">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
            <h1 className="shrink-0 text-4xl font-black tracking-tight text-slate-950">
              Host Dashboard
            </h1>
            {payoutSetupIncomplete && (
              <button
                type="button"
                onClick={() => setActiveTab("earnings")}
                className="inline-flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm transition-colors hover:bg-amber-100 sm:ml-auto sm:w-auto sm:min-w-[28rem] sm:max-w-2xl"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-bold text-amber-900">
                    Payout setup incomplete
                  </p>
                  <p className="mt-0.5 leading-5 text-amber-700">
                    Complete the Stripe setup in the Earnings tab to start
                    accepting reservations.
                  </p>
                </div>
              </button>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-3">
              {hostTabs.map(({ Icon, ...tab }) => (
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
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 text-pink-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    {tab.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                    {tab.count}
                  </span>
                </button>
              ))}
            </aside>

            <section className="space-y-6">
              {activeTab === "upcoming" && (
                <>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Upcoming Reservations
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Pending requests and confirmed reservations that still need attention.
                    </p>
                  </div>
                  {renderReservationList(
                    upcomingReservations,
                    "No upcoming reservations right now.",
                    { pendingActions: true }
                  )}
                </>
              )}

              {activeTab === "courts" && (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight text-slate-950">
                        Your Courts
                      </h2>
                      <p className="mt-2 text-slate-500">
                        Manage listings and edit calendar availability.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-fit rounded-2xl border-black bg-white text-black hover:bg-slate-100 hover:text-black"
                      onClick={openAddCourtDialog}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Listing
                    </Button>
                  </div>

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
                              Edit Listing
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
                              Weekly Availability
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
                                        bookingUsers={bookingUserNames}
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
                                  bookingUsers={bookingUserNames}
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
                </>
              )}

              {activeTab === "earnings" && (
                <>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Earnings
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Track estimated host earnings and manage payout setup.
                    </p>
                  </div>
                  <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                    <CardContent className="grid gap-4 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="flex gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-950">
                              Payout settings
                            </h3>
                            <Badge
                              variant="outline"
                              className={`rounded-md ${payoutStatusTone}`}
                            >
                              {payoutStatusLabel}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            Manage payout details, balances, and timing in Stripe Express.
                          </p>
                          {stripeAccountStatus?.hasAccount && (
                            <p className="mt-1 text-sm text-slate-600">
                              {stripeAccountStatus.payoutsEnabled
                                ? `Stripe Express is connected${
                                    stripeAccountStatus.mode === "test"
                                      ? " in test mode"
                                      : ""
                                  } and can receive payouts.`
                                : `Stripe Express is connected${
                                    stripeAccountStatus.mode === "test"
                                      ? " in test mode"
                                      : ""
                                  }, but still needs payout setup.`}
                            </p>
                          )}
                          {(!stripeAccountStatus?.hasAccount ||
                            !stripeAccountStatus.payoutsEnabled) && (
                            <p className="mt-1 text-sm text-slate-600">
                              {payoutStatusDescription}
                            </p>
                          )}
                          {stripeAccountStatus?.disabledReason && (
                            <p className="mt-1 text-xs text-amber-700">
                              Stripe status: {stripeAccountStatus.disabledReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={payoutAction}
                        disabled={checkingStripe || connectingStripe}
                      >
                        {payoutStatusLabel === "Active" ? (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        ) : (
                          <Settings className="mr-2 h-4 w-4" />
                        )}
                        {connectingStripe ? "Opening..." : payoutActionLabel}
                      </Button>
                    </CardContent>
                  </Card>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-6">
                        <p className="text-sm font-semibold text-slate-500">
                          Host earnings
                        </p>
                        <p className="mt-2 text-3xl font-black text-slate-950">
                          ${estimatedEarnings.toFixed(0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-6">
                        <p className="text-sm font-semibold text-slate-500">
                          Authorized requests
                        </p>
                        <p className="mt-2 text-3xl font-black text-slate-950">
                          ${pendingPayments.toFixed(0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black text-slate-950">
                            Earnings over time
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            ${chartEarningsTotal.toFixed(0)} in selected range
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(earningsRangeLabels) as EarningsRange[]).map(
                            (range) => (
                              <button
                                key={range}
                                type="button"
                                onClick={() => setEarningsRange(range)}
                                className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                                  earningsRange === range
                                    ? "bg-[var(--site-accent)] text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {earningsRangeLabels[range]}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <div className="mt-6 h-72">
                        {earningsChartData.length === 0 ? (
                          <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 text-sm text-slate-500">
                            No earnings in this range yet.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={earningsChartData}
                              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e2e8f0"
                              />
                              <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#64748b", fontSize: 12 }}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#64748b", fontSize: 12 }}
                                tickFormatter={(value) => `$${value}`}
                              />
                              <Tooltip
                                formatter={(value) => [
                                  `$${Number(value).toFixed(2)}`,
                                  "Earnings",
                                ]}
                                labelFormatter={(_, payload) =>
                                  payload?.[0]?.payload?.date || ""
                                }
                              />
                              <Line
                                type="monotone"
                                dataKey="earnings"
                                stroke="var(--site-accent)"
                                strokeWidth={3}
                                dot={{ r: 4, fill: "var(--site-accent)" }}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {activeTab === "reviews" && (
                <>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Reviews
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Reviews from players about you as a host and your courts.
                    </p>
                  </div>
                  {receivedReviews.length === 0 ? (
                    <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-8 text-slate-600">
                        Player reviews for you and your courts will appear here after completed reservations.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-8 md:grid-cols-2">
                      {receivedReviews.map((review) => {
                        const court = courtsById[review.courtId];
                        return (
                          <article
                            key={review.id}
                            className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-lg font-black text-slate-950">
                                  {court?.name || "Court review"}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {formatReviewDate(review.createdAt)}
                                </p>
                              </div>
                              <div className="flex gap-0.5 text-amber-400">
                                {Array.from({ length: 5 }).map((_, star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star < review.rating
                                        ? "fill-amber-400"
                                        : "text-slate-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="mt-5 text-lg leading-8 text-slate-900">
                              {review.comment || "No written review provided."}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === "completed" && (
                <>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Completed Reservations
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Completed and past confirmed reservations.
                    </p>
                  </div>
                  {renderReservationList(
                    completedReservations,
                    "No completed reservations yet.",
                    { reviewActions: true }
                  )}
                </>
              )}

              {activeTab === "cancelled" && (
                <>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      Cancelled Reservations
                    </h2>
                    <p className="mt-2 text-slate-500">
                      Expired, rejected, and cancelled reservations.
                    </p>
                  </div>
                  {renderReservationList(
                    cancelledReservations,
                    "No cancelled reservations yet."
                  )}
                </>
              )}
            </section>
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
                  <span className="font-medium">
                    {formatBookingDateWithDay(acceptBookingConfirm.booking.date)}
                  </span>
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
                    {getBookingPlayerName(acceptBookingConfirm.booking)}
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
      <Dialog
        open={showAddCourtDialog}
        onOpenChange={(open) => {
          if (!open) closeAddCourtDialog();
        }}
      >
        <DialogContent className="rounded-[32px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Create a court listing
            </DialogTitle>
            <DialogDescription className="text-base leading-7">
              Add your court details, photos, pricing, access instructions, and availability. You can save the listing first, then connect Stripe before it becomes bookable.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[24px] bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p className="font-bold text-slate-950">
              Before publishing, you will need:
            </p>
            <p className="mt-2">
              Court details, at least one clear photo, availability rules,
              booking access instructions, and a ready Stripe payout account.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={closeAddCourtDialog}
            >
              Maybe later
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-[var(--site-accent)] text-white hover:bg-[var(--site-accent-hover)]"
              onClick={() => router.push("/create-listing")}
            >
              Start Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReviewDialog
        open={!!reviewingBooking}
        onOpenChange={(open) => !open && setReviewingBooking(null)}
        title="Review this player"
        description={
          reviewingBooking
            ? `Rate your experience with ${getBookingPlayerName(reviewingBooking)}.`
            : "Rate your experience with this player."
        }
        submitting={submittingReview}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
