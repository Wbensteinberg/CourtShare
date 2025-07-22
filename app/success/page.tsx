"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function SuccessPage() {
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Get session_id from URL params
    const sessionId = searchParams.get("session_id");
    
    if (!sessionId) {
      // No session ID, redirect to dashboard
      router.push("/dashboard/player");
      return;
    }

    // For now, we'll redirect to dashboard
    // In a real implementation, you'd fetch the booking by session ID
    // and then redirect to the booking details page
    setTimeout(() => {
      router.push("/dashboard/player");
    }, 3000);
  }, [user, router, searchParams]);

  return (
    <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-auto text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-[#286a3a] mb-4">Booking Confirmed!</h1>
        <p className="text-gray-600 mb-6">
          Your payment was successful and your booking has been confirmed.
        </p>
        <div className="animate-pulse">
          <p className="text-sm text-gray-500">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}
