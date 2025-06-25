"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Optionally: Call your backend to confirm the booking using sessionId
    // Or rely on Stripe webhooks for full security
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100">
      <h1 className="text-2xl font-bold text-green-600">
        ✅ Payment successful! Booking confirmed.
      </h1>
    </div>
  );
}
