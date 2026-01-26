"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
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
  ArrowLeft,
  Plus,
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
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import InlineWeeklyCalendar from "@/components/InlineWeeklyCalendar";

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  surface?: string;
  indoor?: boolean;
  blockedTimes?: { [date: string]: string[] };
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
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
        // Fetch courts owned by this user (assuming you store ownerId on court)
        const courtsSnap = await getDocs(
          query(collection(db, "courts"), where("ownerId", "==", user.uid))
        );
        const courtsData: Court[] = courtsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Court[];
        setCourts(courtsData);
        // Fetch bookings for these courts
        const courtIds = courtsData.map((c) => c.id);
        let bookingsData: Booking[] = [];
        if (courtIds.length > 0) {
          const bookingsSnap = await getDocs(
            query(collection(db, "bookings"), where("courtId", "in", courtIds))
          );
          bookingsData = bookingsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Booking[];
        }
        setBookings(bookingsData);

        const uniqueUserIds = Array.from(
          new Set(bookingsData.map((booking) => booking.userId).filter(Boolean))
        );
        if (uniqueUserIds.length > 0) {
          try {
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
          // Don't set error state - just log it, allow UI to show default state
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
        // Don't set error state - allow UI to show default state
      } finally {
        setCheckingStripe(false);
      }
    };

    checkStripeAccount();
  }, [user]);

  const handleConnectStripe = async () => {
    if (!user) return;

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
      await deleteDoc(doc(db, "courts", courtId));
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    } catch (err: any) {
      alert(err.message || "Failed to delete court");
    } finally {
      setDeletingCourtId(null);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setUpdatingBookingId(bookingId);
    try {
      // Update booking status
      await updateDoc(doc(db, "bookings", bookingId), { status: "confirmed" });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "confirmed" } : b
        )
      );

      // Send confirmation email to player
      try {
        const response = await fetch("/api/send-booking-confirmation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookingId }),
        });

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.error(
            "[OWNER DASHBOARD] Failed to send confirmation email:",
            error
          );
          console.error(
            "[OWNER DASHBOARD] Response status:",
            response.status,
            response.statusText
          );
          // Don't show error to user - booking is still accepted
        } else {
          console.log("[OWNER DASHBOARD] ✅ Confirmation email sent to player");
        }
      } catch (emailError: any) {
        console.error(
          "[OWNER DASHBOARD] Error sending confirmation email:",
          emailError
        );
        // Don't fail the booking acceptance if email fails
      }
    } catch (err: any) {
      alert(err.message || "Failed to accept booking");
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to reject this booking? The payment will be refunded."
      )
    ) {
      return;
    }
    setUpdatingBookingId(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "rejected" });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "rejected" } : b))
      );
      // TODO: Process refund via Stripe
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
      await updateDoc(doc(db, "courts", courtId), { blockedTimes });
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

  return (
    <div className="min-h-screen bg-white w-full">
      <AppHeader />

      {/* Hero Section - Same as /courts page */}
      <section className="relative overflow-hidden w-full bg-gradient-tennis text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 opacity-20 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-br from-white/8 to-emerald-300/5 rounded-full blur-3xl animate-float"></div>
          <div
            className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-gradient-to-br from-cyan-400/8 to-teal-300/5 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-emerald-400/6 to-cyan-300/4 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "4s" }}
          ></div>
        </div>
        <div className="relative w-full flex flex-col items-center py-20 md:py-28 px-4 z-10">
          <div className="max-w-6xl w-full mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white drop-shadow-2xl leading-[1.1]">
              Owner Dashboard
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">
              Welcome! Here are your courts and bookings.
            </p>
          </div>
        </div>
        <div className="absolute left-0 bottom-[-1px] w-full z-10">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-12 md:h-16"
            preserveAspectRatio="none"
          >
            <path
              fill="#ffffff"
              d="M0,96L48,90.7C96,85,192,75,288,70C384,65,480,65,576,70C672,75,768,85,864,90C960,95,1056,95,1152,90C1248,85,1344,75,1392,70L1440,65L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
              className="animate-pulse"
              style={{ animationDuration: "3s" }}
            />
          </svg>
        </div>
      </section>

      {/* Main Content */}
      <main className="w-full bg-gradient-to-b from-white via-slate-100 to-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Stripe Connect Status Card */}
          {stripeAccountStatus && !stripeAccountStatus.hasAccount && (
            <Card className="mb-8 border-2 border-amber-200 bg-amber-50/50">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <AlertCircle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-amber-900 mb-2">
                      Connect Your Bank Account
                    </h3>
                    <p className="text-amber-800 mb-4">
                      To receive payments from bookings, you need to connect
                      your bank account. This is secure and handled by Stripe.
                    </p>
                    <div className="bg-white/60 rounded-lg p-4 mb-4 border border-amber-200">
                      <p className="text-sm font-semibold text-amber-900 mb-2">
                        What you'll need:
                      </p>
                      <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                        <li>
                          <strong>Industry:</strong> Select "Property rentals"
                        </li>
                        <li>
                          <strong>Website:</strong> Use{" "}
                          <code className="bg-amber-100 px-1 rounded">
                            courtshare.com
                          </code>{" "}
                          or click "Add product description instead" and
                          describe your court
                        </li>
                        <li>
                          <strong>Personal info:</strong> Your legal name, date
                          of birth, address, and SSN (for tax purposes)
                        </li>
                        <li>
                          <strong>Bank account:</strong> For test mode, Stripe
                          will provide test account numbers
                        </li>
                      </ul>
                    </div>
                    <Button
                      onClick={handleConnectStripe}
                      disabled={connectingStripe}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {connectingStripe
                        ? "Connecting..."
                        : "Connect Bank Account"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stripeAccountStatus?.hasAccount &&
            stripeAccountStatus.status === "pending" && (
              <Card className="mb-8 border-2 border-blue-200 bg-blue-50/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <AlertCircle className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 mb-2">
                        Complete Your Bank Account Setup
                      </h3>
                      <p className="text-blue-800 mb-4">
                        Your Stripe account is being set up. Please complete the
                        onboarding process to start receiving payments.
                      </p>
                      <div className="bg-white/60 rounded-lg p-4 mb-4 border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                          Quick guide for Stripe forms:
                        </p>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                          <li>
                            <strong>Industry:</strong> Select "Recreation and
                            sports" or "Rental and leasing services"
                          </li>
                          <li>
                            <strong>Website:</strong> Use{" "}
                            <code className="bg-blue-100 px-1 rounded">
                              courtshare.com
                            </code>{" "}
                            or click "Add product description instead"
                          </li>
                          <li>
                            <strong>All other fields:</strong> Use your real
                            information (or test data if in test mode)
                          </li>
                        </ul>
                      </div>
                      <Button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {connectingStripe ? "Loading..." : "Complete Setup"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Success: Account is Active */}
          {stripeAccountStatus?.hasAccount &&
            stripeAccountStatus.status === "active" && (
              <Card className="mb-8 border-2 border-emerald-200 bg-emerald-50/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-emerald-900 flex items-center mb-1">
                          <Banknote className="h-5 w-5 mr-2" />
                          Bank Account Connected
                        </h3>
                        <p className="text-emerald-800 text-sm">
                          Your Stripe account is fully set up and verified.
                          You're ready to receive payments from bookings!
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleUpdateStripeAccount}
                      disabled={connectingStripe}
                      variant="outline"
                      size="sm"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:cursor-pointer"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {connectingStripe ? "Loading..." : "Edit Account"}
                    </Button>
                  </div>
                  <div className="pt-4 border-t border-emerald-200">
                    <a
                      href={`https://dashboard.stripe.com/connect/accounts/${stripeAccountStatus.accountId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-700 hover:text-emerald-900 flex items-center gap-2 hover:cursor-pointer"
                    >
                      View payments, balance, and transaction history in Stripe
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Restricted: Account needs attention */}
          {stripeAccountStatus?.hasAccount &&
            stripeAccountStatus.status === "restricted" && (
              <Card className="mb-8 border-2 border-amber-200 bg-amber-50/50">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <AlertCircle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-amber-900 mb-2">
                        Account Setup Incomplete
                      </h3>
                      <p className="text-amber-800 mb-4">
                        Your Stripe account needs additional information to
                        enable payouts. Please complete the setup process.
                      </p>
                      <Button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {connectingStripe ? "Loading..." : "Complete Setup"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Add New Court Button - Modernized */}
          <div className="flex justify-center mb-12">
            <Button
              onClick={() => router.push("/create-listing")}
              className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white font-extrabold py-5 px-10 rounded-2xl shadow-xl hover:shadow-glow-hover transition-all duration-300 transform hover:scale-105 hover:cursor-pointer text-lg"
              size="lg"
            >
              <Plus className="h-6 w-6 mr-3" />
              Add New Court
            </Button>
          </div>

          {/* Courts Section */}
          {courts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 text-lg font-medium">
                You have no courts listed yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {courts.map((court) => {
                const courtBookings = bookings.filter(
                  (booking) => booking.courtId === court.id
                );
                const now = new Date();
                
                // Helper to convert 12-hour time to 24-hour format
                const convertTo24Hour = (time12: string): string => {
                  if (/^\d{2}:\d{2}$/.test(time12)) {
                    return time12; // Already in 24-hour format
                  }
                  const [timePart, period] = time12.split(" ");
                  const [hours, minutes] = timePart.split(":").map(Number);
                  let hours24 = hours;
                  if (period === "PM" && hours !== 12) {
                    hours24 = hours + 12;
                  } else if (period === "AM" && hours === 12) {
                    hours24 = 0;
                  }
                  return `${hours24.toString().padStart(2, "0")}:${(minutes || 0).toString().padStart(2, "0")}`;
                };
                
                // Filter pending bookings that haven't passed yet
                const pendingBookings = courtBookings.filter((booking) => {
                  if (booking.status !== "pending") return false;
                  
                  // Parse booking date and time
                  const bookingDate = new Date(booking.date);
                  if (Number.isNaN(bookingDate.getTime())) return false;
                  
                  // Get booking time in 24-hour format
                  const time24 = convertTo24Hour(booking.time);
                  const [hours, minutes] = time24.split(":").map(Number);
                  
                  // Create a Date object for the booking date/time
                  const bookingDateTime = new Date(bookingDate);
                  bookingDateTime.setHours(hours, minutes, 0, 0);
                  
                  // Only include if booking date/time is in the future
                  return bookingDateTime > now;
                });

                return (
                  <Card
                    key={court.id}
                    className="overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 border-0 shadow-xl bg-white/95 backdrop-blur-sm border border-slate-200/60 border-l-4 border-l-emerald-500 rounded-3xl transform hover:-translate-y-1"
                  >
                  <CardHeader className="pb-3 px-6 pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden shadow-md">
                          {court.imageUrl ? (
                            <Image
                              src={court.imageUrl}
                              alt={court.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
                              <span className="text-3xl">🎾</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-blue-600/20"></div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {court.name}
                          </h3>
                          <div className="flex items-center text-gray-600 mb-2">
                            <MapPin className="h-4 w-4 mr-2 text-emerald-600" />
                            <span className="text-sm">@{court.location}</span>
                          </div>
                          {court.surface && (
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-1 border-green-200 text-green-700"
                            >
                              {court.surface}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          className="gap-1 hover:cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                          onClick={() =>
                            router.push(`/edit-listing/${court.id}`)
                          }
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-6 pb-6">
                    {/* Weekly Calendar View */}
                    <InlineWeeklyCalendar
                      courtId={court.id}
                      blockedTimes={court.blockedTimes}
                      bookings={courtBookings}
                      bookingUsers={bookingUsers}
                      onBlockedTimesUpdate={(blockedTimes) =>
                        handleBlockedTimesUpdate(court.id, blockedTimes)
                      }
                      onBookingUpdate={async (bookingId, status) => {
                        if (status === "confirmed") {
                          await handleAcceptBooking(bookingId);
                        } else if (status === "rejected") {
                          await handleRejectBooking(bookingId);
                        }
                      }}
                    />

                    {/* Pending Bookings Section */}
                    <div className="space-y-3 mt-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                          <Clock className="h-4 w-4 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          Pending Bookings
                        </h4>
                        <Badge
                          variant="outline"
                          className="ml-auto text-xs px-2 py-1 border-amber-300 bg-amber-50 text-amber-700"
                        >
                          {pendingBookings.length} pending
                        </Badge>
                      </div>

                      {pendingBookings.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                          No pending bookings for this court.
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {pendingBookings
                            .sort((a, b) =>
                              (a.date + a.time).localeCompare(b.date + b.time)
                            )
                            .map((booking) => (
                              <Card
                                key={booking.id}
                                className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 hover:border-amber-300 hover:bg-amber-50/40 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md"
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      <div className="flex items-center space-x-2 text-xs">
                                        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
                                          <Calendar className="h-3 w-3 text-white" />
                                        </div>
                                        <span className="font-medium text-gray-900">
                                          {booking.date}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2 text-xs">
                                        <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center">
                                          <Clock className="h-3 w-3 text-white" />
                                        </div>
                                        <span className="text-gray-700">
                                          {booking.time} ({booking.duration}h)
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2 text-xs text-slate-400">
                                        <div className="w-5 h-5 rounded bg-slate-600 flex items-center justify-center">
                                          <User className="h-3 w-3 text-slate-300" />
                                        </div>
                                        <span className="text-xs text-slate-300">
                                          {bookingUsers[booking.userId] ||
                                            `${booking.userId.slice(0, 12)}...`}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <Button
                                        size="sm"
                                        className="h-7 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs cursor-pointer shadow-md hover:shadow-lg transition-all duration-300"
                                        onClick={() =>
                                          handleAcceptBooking(booking.id)
                                        }
                                        disabled={
                                          updatingBookingId === booking.id
                                        }
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-3 text-xs cursor-pointer shadow-md hover:shadow-lg transition-all duration-300"
                                        onClick={() =>
                                          handleRejectBooking(booking.id)
                                        }
                                        disabled={
                                          updatingBookingId === booking.id
                                        }
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Decline
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-sm border border-slate-200/50">
              <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">
                {courts.length}
              </div>
              <div className="text-slate-700 text-lg font-medium">
                Active Courts
              </div>
            </Card>
            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-sm border border-slate-200/50">
              <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">
                {bookings.length}
              </div>
              <div className="text-slate-700 text-lg font-medium">
                Total Bookings
              </div>
            </Card>
            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-sm border border-slate-200/50">
              <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">
                {bookings.filter((b) => b.status === "pending").length}
              </div>
              <div className="text-slate-700 text-lg font-medium">
                Pending Requests
              </div>
            </Card>
          </div>
        </div>
      </main>

    </div>
  );
}
