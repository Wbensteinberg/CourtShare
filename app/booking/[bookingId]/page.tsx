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
import { MapPin, ArrowLeft, X } from "lucide-react";
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

  const isConfirmed = booking.status === "confirmed";
  const isPending = booking.status === "pending";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      {/* Hero - status-aware, compact, title centered */}
      <section className="relative py-12 md:py-16 bg-gradient-tennis overflow-hidden flex items-center justify-center min-h-[180px] md:min-h-[200px]">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" />
          <div
            className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              {isConfirmed && "You're all set"}
              {isPending && "Booking requested"}
              {booking.status === "rejected" && "Booking declined"}
              {booking.status === "cancelled" && "Booking cancelled"}
              {!["confirmed", "pending", "rejected", "cancelled"].includes(booking.status) && "Booking details"}
            </h1>
            <p className="text-base md:text-lg text-white/90 max-w-xl mx-auto font-medium mt-2">
              {isConfirmed && "Court address and instructions are below. See you on the court."}
              {isPending && "The court owner will confirm your request soon. We'll notify you."}
              {booking.status === "rejected" && "The owner was unable to accommodate this time."}
              {booking.status === "cancelled" && "This booking is no longer active."}
              {!["confirmed", "pending", "rejected", "cancelled"].includes(booking.status) && "View your booking information below."}
            </p>
          </div>
        </div>
      </section>

      {/* Main card - more space below header */}
      <section className="pt-16 pb-10 relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-elegant border-0 rounded-3xl overflow-hidden bg-white/95 backdrop-blur-xl">
            {/* Court image + name block */}
            <div className="relative">
              <div className="aspect-[21/9] w-full relative bg-gradient-to-br from-emerald-100 to-teal-100">
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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-7xl">🎾</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                    {court.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-white/95 text-sm font-medium">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{court.location}</span>
                  </div>
                  {court.surface && (
                    <Badge className="mt-2 bg-white/20 text-white border-0 backdrop-blur-sm">
                      {court.surface}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <CardContent className="p-6 md:p-8 space-y-8">
              {/* Booking details grid */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Booking
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-xs font-medium text-gray-500">Date</p>
                    <p className="font-semibold text-gray-900 truncate mt-0.5">
                      {formatDate(booking.date)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-xs font-medium text-gray-500">Time</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {formatTime(booking.time)} · {booking.duration}h
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-xs font-medium text-gray-500">Status</p>
                    <div className="mt-0.5">{getStatusBadge(booking.status)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-xs font-medium text-gray-500">Total</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      ${(court.price * booking.duration).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address - only when confirmed */}
              {court.address && booking.status === "confirmed" && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Court address
                  </h3>
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{court.address}</p>
                        <GoogleMapsLink
                          address={court.address}
                          variant="link"
                          className="text-emerald-600 font-semibold text-sm mt-2 inline-flex items-center gap-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Access instructions - only when confirmed */}
              {court.accessInstructions && booking.status === "confirmed" && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Access instructions
                  </h3>
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-gray-900 whitespace-pre-line leading-relaxed text-sm">
                      {court.accessInstructions}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  onClick={() => router.push("/dashboard/player")}
                  variant="outline"
                  className="flex-1 h-12 font-semibold rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to dashboard
                </Button>
                {booking.status !== "cancelled" && (
                  <Button
                    onClick={handleCancel}
                    variant="destructive"
                    className="flex-1 h-12 font-semibold rounded-xl"
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Cancelling...
                      </span>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancel booking
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer - match /courts */}
      <footer className="bg-slate-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} CourtShare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
