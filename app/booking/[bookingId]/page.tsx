"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import GoogleMapsLink from "@/components/GoogleMapsLink";

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
}

export default function BookingDetailsPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
        
        const bookingData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
        
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
    // TODO: Implement cancellation logic
    alert("Cancellation feature coming soon!");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-auto text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard/player")}
            className="bg-[#286a3a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!booking || !court) {
    return (
      <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-auto text-center">
          <div className="text-6xl mb-4">❓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">The booking you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push("/dashboard/player")}
            className="bg-[#286a3a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-[#286a3a] mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600">Your court booking is confirmed and ready.</p>
        </div>

        {/* Court Image */}
        <div className="w-full h-64 relative mb-6 rounded-2xl overflow-hidden shadow-md">
          {court.imageUrl ? (
            <Image
              src={court.imageUrl}
              alt={court.name}
              fill
              className="object-cover rounded-2xl"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-2xl">
              <span className="text-6xl">🎾</span>
            </div>
          )}
        </div>

        {/* Court Details */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#286a3a] mb-4 text-center">
            {court.name}
          </h2>
          <p className="text-gray-600 text-center mb-2">
            {court.location}
          </p>
        </div>

        {/* Booking Details */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="text-xl font-semibold text-[#286a3a] mb-4 text-center">
            Booking Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Date:</span>
              <span className="text-gray-900">{formatDate(booking.date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Time:</span>
              <span className="text-gray-900">{formatTime(booking.time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Duration:</span>
              <span className="text-gray-900">{booking.duration} hour{booking.duration > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Status:</span>
              <span className="text-green-600 font-semibold capitalize">{booking.status}</span>
            </div>
          </div>
        </div>

        {/* Address */}
        {court.address && (
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-[#286a3a] mb-3 text-center">
              Address
            </h3>
            <div className="bg-gray-50 rounded-2xl p-6">
              <p className="text-gray-900 text-center mb-4">{court.address}</p>
              <div className="text-center">
                <GoogleMapsLink address={court.address} variant="button" />
              </div>
            </div>
          </div>
        )}

        {/* Access Instructions */}
        {court.accessInstructions && (
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-[#286a3a] mb-3 text-center">
              Access Instructions
            </h3>
            <div className="bg-gray-50 rounded-2xl p-6">
              <p className="text-gray-900 text-center whitespace-pre-line">
                {court.accessInstructions}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => router.push("/dashboard/player")}
            className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition hover:cursor-pointer"
          >
            Back to Dashboard
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-red-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-600 transition hover:cursor-pointer"
          >
            Cancel Booking
          </button>
        </div>
      </div>
    </div>
  );
} 