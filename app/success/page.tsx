"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function SuccessContent() {
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    // Get session_id from URL params
    const sessionId = searchParams.get("session_id");

    // Immediately redirect to dashboard (no delay, no flash)
    // The booking will show up once the webhook processes it
    router.push("/dashboard/player");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-tennis px-4 py-12 flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 mx-auto text-center relative z-10 border border-white/30">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-glow animate-pulse-glow">
          <span className="text-5xl">✅</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent tracking-tight">
          Booking Confirmed!
        </h1>
        <p className="text-gray-600 mb-8 text-lg font-medium leading-relaxed">
          Your payment was successful and your booking has been confirmed.
        </p>
        <div className="animate-pulse">
          <p className="text-sm text-gray-500 font-semibold">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-tennis px-4 py-12 flex items-center justify-center">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mx-auto text-center border border-white/30">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
