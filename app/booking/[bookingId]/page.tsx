"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import GoogleMapsLink from "@/components/GoogleMapsLink";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  ArrowLeft,
  X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  createdAt: any;
  sessionId: string;
}

interface Court {
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  surface?: string;
  indoor?: boolean;
}

export default function BookingDetailsPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!bookingId || !user) return;

    const fetchBooking = async () => {
      setLoading(true);
      setError("");

      try {
        // Fetch booking details
        const bookingRef = doc(db, "bookings", bookingId as string);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
          setError("Booking not found");
          setLoading(false);
          return;
        }

        const bookingData = {
          id: bookingSnap.id,
          ...bookingSnap.data(),
        } as Booking;

        // Check if this booking belongs to the current user
        if (bookingData.userId !== user.uid) {
          setError("You don't have permission to view this booking");
          setLoading(false);
          return;
        }

        setBooking(bookingData);

        // Fetch court details
        const courtRef = doc(db, "courts", bookingData.courtId);
        const courtSnap = await getDoc(courtRef);

        if (courtSnap.exists()) {
          setCourt(courtSnap.data() as Court);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch booking details");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, user]);

  const handleCancel = async () => {
    if (!booking) return;

    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? This action cannot be undone."
      )
    ) {
      return;
    }

    setCancelling(true);
    try {
      await updateDoc(doc(db, "bookings", booking.id), { status: "cancelled" });
      // Redirect to dashboard after successful cancellation
      router.push("/dashboard/player");
    } catch (err: any) {
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Parse date string (format: "YYYY-MM-DD") as local date to avoid timezone issues
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
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
            Loading booking details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-auto text-center border border-white/30">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => router.push("/dashboard/player")}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-4 px-8 rounded-2xl shadow-xl hover:shadow-glow-hover transition-all duration-300 transform hover:scale-105 hover:cursor-pointer"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!booking || !court) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-auto text-center border border-white/30">
          <div className="text-6xl mb-4">❓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Booking Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The booking you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => router.push("/dashboard/player")}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-4 px-8 rounded-2xl shadow-xl hover:shadow-glow-hover transition-all duration-300 transform hover:scale-105 hover:cursor-pointer"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      {/* Hero Section - Modernized */}
      <section className="relative py-24 bg-gradient-tennis overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div
            className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center text-white relative z-10">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center shadow-glow">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
              Booking Confirmed!
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">
              Your court booking is confirmed and ready to go
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 -mt-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-elegant border-0 rounded-3xl glass backdrop-blur-xl">
              <CardHeader className="space-y-2 pb-10 pt-10">
                <CardTitle className="text-3xl md:text-4xl font-black text-center tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Booking Details
                </CardTitle>
                <CardDescription className="text-center text-gray-600 font-medium text-lg">
                  Here are the details of your confirmed booking
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* Court Information */}
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">
                      Court Information
                    </h3>
                  </div>

                  {/* Court Image */}
                  <div className="w-full h-64 relative rounded-2xl overflow-hidden shadow-lg">
                    {court.imageUrl ? (
                      <Image
                        src={court.imageUrl}
                        alt={court.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
                        <span className="text-6xl">🎾</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-blue-600/20"></div>
                  </div>

                  {/* Court Details */}
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {court.name}
                    </h2>
                    <div className="flex items-center justify-center text-gray-600 mb-2">
                      <MapPin className="h-4 w-4 mr-2 text-green-600" />
                      <span>@{court.location}</span>
                    </div>
                    {court.surface && (
                      <Badge
                        variant="outline"
                        className="text-sm px-3 py-1 border-green-200 text-green-700"
                      >
                        {court.surface}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Booking Information */}
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">
                      Booking Information
                    </h3>
                  </div>

                  <Card className="border-gray-200">
                    <CardContent className="pt-7 pb-6 px-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <Calendar className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date</p>
                              <p className="font-semibold text-gray-900">
                                {formatDate(booking.date)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">
                                Time & Duration
                              </p>
                              <p className="font-semibold text-gray-900">
                                {formatTime(booking.time)} ({booking.duration}{" "}
                                hour{booking.duration > 1 ? "s" : ""})
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Status</p>
                              <div className="flex items-center">
                                {getStatusBadge(booking.status)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-600"></div>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">
                                Total Cost
                              </p>
                              <p className="font-semibold text-gray-900">
                                ${(court.price * booking.duration).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Address - only show once owner has confirmed */}
                {court.address && booking.status === "confirmed" && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-4">
                        Court Address
                      </h3>
                    </div>
                    <Card className="border-gray-200">
                      <CardContent className="pt-7 pb-6 px-6">
                        <div className="text-center space-y-4">
                          <div className="flex items-center justify-center space-x-2">
                            <MapPin className="h-5 w-5 text-green-600" />
                            <p className="text-gray-900 font-medium">
                              {court.address}
                            </p>
                          </div>
                          <GoogleMapsLink
                            address={court.address}
                            variant="button"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Access Instructions */}
                {court.accessInstructions && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-4">
                        Access Instructions
                      </h3>
                    </div>
                    <Card className="border-gray-200">
                      <CardContent className="pt-7 pb-6 px-6">
                        <div className="text-center">
                          <p className="text-gray-900 whitespace-pre-line leading-relaxed">
                            {court.accessInstructions}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-6 flex gap-4">
                  <Button
                    onClick={() => router.push("/dashboard/player")}
                    className="flex-1 h-14 text-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back to Dashboard
                  </Button>
                  {booking.status !== "cancelled" && (
                    <Button
                      onClick={handleCancel}
                      className="flex-1 h-14 text-lg font-semibold bg-red-600 hover:bg-red-700 transition-colors text-white"
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8z"
                            ></path>
                          </svg>
                          Cancelling...
                        </span>
                      ) : (
                        <>
                          <X className="h-5 w-5 mr-2" />
                          Cancel Booking
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
