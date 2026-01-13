"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import GoogleMapsLink from "@/components/GoogleMapsLink";

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

interface Court {
  id: string;
  name: string;
  location: string;
  address?: string;
  imageUrl: string;
  surface?: string;
  indoor?: boolean;
}

export default function PlayerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Record<string, Court>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showPastBookings, setShowPastBookings] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // Fetch bookings for this user
      console.log("[PLAYER DASHBOARD] Fetching bookings for user:", user.uid);
      const bookingsSnap = await getDocs(
        query(collection(db, "bookings"), where("userId", "==", user.uid))
      );
      console.log(
        "[PLAYER DASHBOARD] Found",
        bookingsSnap.docs.length,
        "bookings"
      );
      const bookingsData: Booking[] = bookingsSnap.docs.map((doc) => {
        const data = doc.data();
        console.log(
          "[PLAYER DASHBOARD] Booking:",
          doc.id,
          "userId:",
          data.userId,
          "status:",
          data.status
        );
        return {
          id: doc.id,
          ...data,
        };
      }) as Booking[];
      setBookings(bookingsData);
      // Fetch all courts for these bookings
      const courtIds = Array.from(new Set(bookingsData.map((b) => b.courtId)));
      const courtsMap: Record<string, Court> = {};
      await Promise.all(
        courtIds.map(async (courtId) => {
          const courtDoc = await getDoc(doc(db, "courts", courtId));
          if (courtDoc.exists()) {
            courtsMap[courtId] = { id: courtId, ...courtDoc.data() } as Court;
          }
        })
      );
      setCourts(courtsMap);
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
    if (!window.confirm("Are you sure you want to cancel this booking?"))
      return;
    setCancelling(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "cancelled" });
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper function to parse date and time (handles "1:00 PM" format)
  const parseBookingDateTime = (dateStr: string, timeStr: string): Date => {
    // Parse time string like "1:00 PM" to 24-hour format
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let hour24 = hours;
    if (period === "PM" && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === "AM" && hours === 12) {
      hour24 = 0;
    }
    // Create date string in ISO format
    const dateTimeStr = `${dateStr}T${hour24
      .toString()
      .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
    return new Date(dateTimeStr);
  };

  // Split bookings into upcoming and past
  const now = new Date();
  const upcoming = bookings.filter((b) => {
    try {
      const bookingDate = parseBookingDateTime(b.date, b.time);
      return (
        bookingDate >= now &&
        b.status !== "cancelled" &&
        b.status !== "rejected"
      );
    } catch (e) {
      console.error(
        "[PLAYER DASHBOARD] Error parsing booking date:",
        b.date,
        b.time,
        e
      );
      return false;
    }
  });
  const past = bookings.filter((b) => {
    try {
      const bookingDate = parseBookingDateTime(b.date, b.time);
      return (
        bookingDate < now || b.status === "cancelled" || b.status === "rejected"
      );
    } catch (e) {
      console.error(
        "[PLAYER DASHBOARD] Error parsing booking date:",
        b.date,
        b.time,
        e
      );
      return true; // If we can't parse, treat as past
    }
  });

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
              Player Dashboard
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">
              Welcome! Here are your court bookings.
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
          {/* Upcoming Bookings Section */}
          <div className="space-y-6 mb-12">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-3 shadow-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                Upcoming Bookings
              </h2>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchBookings()}
                  className="hover:cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors duration-200"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-1 border-emerald-300 bg-emerald-50 text-emerald-700"
                >
                  {upcoming.length} total
                </Badge>
              </div>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-28 h-28 mx-auto mb-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center shadow-xl">
                  <Calendar className="h-14 w-14 text-emerald-600" />
                </div>
                <p className="text-slate-600 text-xl mb-6 font-semibold">
                  No upcoming bookings
                </p>
                <Button
                  onClick={() => router.push("/courts")}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-4 px-8 rounded-2xl shadow-xl hover:shadow-glow-hover transition-all duration-300 transform hover:scale-105 hover:cursor-pointer text-lg"
                >
                  Browse Courts
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {upcoming.map((booking) => {
                  const court = courts[booking.courtId];
                  return (
                    <Card
                      key={booking.id}
                      className="overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 border-0 shadow-xl rounded-3xl bg-white/95 backdrop-blur-sm border border-slate-200/60 transform hover:-translate-y-1 border-l-4 border-l-emerald-500"
                    >
                      <CardHeader className="pb-3 px-6 pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden shadow-md">
                              {court?.imageUrl ? (
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
                                {court ? court.name : booking.courtId}
                              </h3>
                              <div className="flex items-center text-gray-600 mb-2">
                                <MapPin className="h-4 w-4 mr-2 text-emerald-600" />
                                <span className="text-sm">
                                  @{court ? court.location : "Unknown Location"}
                                </span>
                              </div>
                              {court?.surface && (
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
                              variant="outline"
                              size="sm"
                              className="gap-1 hover:cursor-pointer border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 px-3 py-1 text-xs"
                              onClick={() =>
                                router.push(`/booking/${booking.id}`)
                              }
                            >
                              <User className="h-3 w-3" />
                              View Details
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1 px-3 py-1 text-xs"
                              onClick={() => handleCancel(booking.id)}
                              disabled={cancelling === booking.id}
                            >
                              <X className="h-3 w-3" />
                              {cancelling === booking.id
                                ? "Cancelling..."
                                : "Cancel"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="px-6 pb-6">
                        {/* Booking Details */}
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 mb-4">
                            <Calendar className="h-5 w-5 text-emerald-400" />
                            <h4 className="text-lg font-semibold text-gray-900">
                              Booking Details
                            </h4>
                          </div>

                          <Card className="bg-gray-50 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                            <CardContent className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-emerald-600" />
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Date
                                    </p>
                                    <p className="font-medium text-gray-900">
                                      {booking.date}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-emerald-600" />
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Time & Duration
                                    </p>
                                    <p className="font-medium text-gray-900">
                                      {booking.time} ({booking.duration}h)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="h-4 w-4 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Status
                                    </p>
                                    <div className="flex items-center">
                                      {getStatusBadge(booking.status)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Address */}
                              {court?.address && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center space-x-2">
                                    <MapPin className="h-4 w-4 text-green-600" />
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-500">
                                        Address
                                      </p>
                                      <GoogleMapsLink
                                        address={court.address}
                                        variant="link"
                                        className="text-sm font-medium"
                                      >
                                        📍 {court.address}
                                      </GoogleMapsLink>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Bookings Section */}
          {past.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowPastBookings(!showPastBookings)}
                  className="flex items-center text-2xl font-bold text-slate-800 hover:text-emerald-600 transition-colors hover:cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mr-3 shadow-lg opacity-75">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  Past Bookings
                  <span
                    className={`ml-3 transform transition-transform ${
                      showPastBookings ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-1 border-emerald-300 bg-emerald-50 text-emerald-700"
                >
                  {past.length} total
                </Badge>
              </div>

              {showPastBookings && (
                <div className="grid gap-6">
                  {past.map((booking) => {
                    const court = courts[booking.courtId];
                    return (
                      <Card
                        key={booking.id}
                        className="overflow-hidden border-0 shadow-md bg-white/80 backdrop-blur-sm border border-slate-200/40 opacity-75"
                      >
                        <CardHeader className="pb-3 px-6 pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden shadow-md">
                                {court?.imageUrl ? (
                                  <Image
                                    src={court.imageUrl}
                                    alt={court.name}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                    <span className="text-3xl">🎾</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-600/20 to-gray-600/20"></div>
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">
                                  {court ? court.name : booking.courtId}
                                </h3>
                                <div className="flex items-center text-gray-600 mb-2">
                                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                  <span className="text-sm">
                                    @
                                    {court
                                      ? court.location
                                      : "Unknown Location"}
                                  </span>
                                </div>
                                {court?.surface && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-2 py-1 border-gray-300 text-gray-600"
                                  >
                                    {court.surface}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 hover:cursor-pointer border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 hover:text-gray-900 px-3 py-1 text-xs"
                                onClick={() =>
                                  router.push(`/booking/${booking.id}`)
                                }
                              >
                                <User className="h-3 w-3" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="px-6 pb-6">
                          <Card className="bg-gray-50/80 border border-gray-200">
                            <CardContent className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-gray-500" />
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Date
                                    </p>
                                    <p className="font-medium text-gray-900">
                                      {booking.date}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Time & Duration
                                    </p>
                                    <p className="font-medium text-gray-900">
                                      {booking.time} ({booking.duration}h)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="h-4 w-4 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Status
                                    </p>
                                    <div className="flex items-center">
                                      {getStatusBadge(booking.status)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Address */}
                              {court?.address && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center space-x-2">
                                    <MapPin className="h-4 w-4 text-gray-500" />
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-500">
                                        Address
                                      </p>
                                      <GoogleMapsLink
                                        address={court.address}
                                        variant="link"
                                        className="text-sm font-medium"
                                      >
                                        📍 {court.address}
                                      </GoogleMapsLink>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
