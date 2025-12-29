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
} from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  surface?: string;
  indoor?: boolean;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [deletingCourtId, setDeletingCourtId] = useState<string | null>(null);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null
  );

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
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

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
        return <Badge className="bg-green-600 text-white">Confirmed</Badge>;
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
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      {/* Header - Modernized */}
      <div className="glass border-b border-gray-200/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/courts")}
                className="flex items-center text-gray-700 hover:text-emerald-600 transition-all duration-300 hover:cursor-pointer font-semibold group"
              >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Browse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title Section - Modernized */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 bg-clip-text text-transparent tracking-tight">
            Owner Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
            Welcome! Here are your courts and bookings.
          </p>
        </div>

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
            <p className="text-gray-500 text-lg">
              You have no courts listed yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {courts.map((court) => (
              <Card
                key={court.id}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md bg-white"
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
                          <MapPin className="h-4 w-4 mr-2 text-green-600" />
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
                        variant="outline"
                        size="sm"
                        className="gap-1 hover:cursor-pointer border-gray-300 hover:border-green-500 hover:bg-green-50 text-gray-700 hover:text-green-700 px-3 py-1 text-xs"
                        onClick={() => router.push(`/edit-listing/${court.id}`)}
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1 px-3 py-1 text-xs"
                        onClick={() => handleDelete(court.id)}
                        disabled={deletingCourtId === court.id}
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingCourtId === court.id
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-6">
                  {/* Bookings Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 mb-4">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <h4 className="text-lg font-semibold text-gray-900">
                        Bookings
                      </h4>
                      <Badge
                        variant="outline"
                        className="ml-auto text-xs px-2 py-1 border-gray-300"
                      >
                        {bookings.filter((b) => b.courtId === court.id).length}{" "}
                        total
                      </Badge>
                    </div>

                    {bookings.filter((b) => b.courtId === court.id).length ===
                    0 ? (
                      <p className="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg">
                        No bookings for this court yet.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {bookings
                          .filter((b) => b.courtId === court.id)
                          .sort((a, b) =>
                            (a.date + a.time).localeCompare(b.date + b.time)
                          )
                          .map((booking) => (
                            <Card
                              key={booking.id}
                              className="bg-gray-50/80 border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 text-xs">
                                      <Calendar className="h-3 w-3 text-green-600" />
                                      <span className="font-medium text-gray-900">
                                        {booking.date}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs">
                                      <Clock className="h-3 w-3 text-green-600" />
                                      <span className="text-gray-700">
                                        {booking.time} ({booking.duration}h)
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                      <User className="h-3 w-3" />
                                      <span className="font-mono text-xs">
                                        {booking.userId.slice(0, 12)}...
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    {getStatusBadge(booking.status)}
                                    {booking.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-xs cursor-pointer"
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
                                          className="h-7 px-3 text-xs cursor-pointer"
                                          onClick={() =>
                                            handleRejectBooking(booking.id)
                                          }
                                          disabled={
                                            updatingBookingId === booking.id
                                          }
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Reject
                                        </Button>
                                      </>
                                    )}
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
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white">
            <div className="text-4xl font-bold text-green-600 mb-3">
              {courts.length}
            </div>
            <div className="text-gray-600 text-lg">Active Courts</div>
          </Card>
          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white">
            <div className="text-4xl font-bold text-green-600 mb-3">
              {bookings.length}
            </div>
            <div className="text-gray-600 text-lg">Total Bookings</div>
          </Card>
          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white">
            <div className="text-4xl font-bold text-green-600 mb-3">
              {bookings.filter((b) => b.status === "pending").length}
            </div>
            <div className="text-gray-600 text-lg">Pending Requests</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
