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
    <div className="min-h-screen flex items-center justify-center bg-[#286a3a]">
      <h1 className="text-2xl font-bold text-[#286a3a] bg-white px-6 py-4 rounded-lg shadow">
        Payment successful! Booking confirmed.
      </h1>
    </div>
  );
}
