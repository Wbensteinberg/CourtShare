"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState(
    "Authorizing your card and creating your booking request..."
  );

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || authLoading) return;

    if (!user) {
      router.push("/");
      return;
    }

    let cancelled = false;

    const finalizeBooking = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/finalize-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Failed to create booking");
        }

        if (cancelled) return;
        setStatus("ready");
        setMessage("Booking request created. Taking you to your dashboard...");
        setTimeout(() => router.push("/upcoming"), 900);
      } catch (err: any) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err.message ||
            "Your card authorization succeeded, but we could not create the booking yet."
        );
      }
    };

    finalizeBooking();

    return () => {
      cancelled = true;
    };
  }, [authLoading, router, searchParams, user]);

  const isError = status === "error";

  if (!isError) {
    return (
      <LoadingScreen
        message={
          status === "ready"
            ? "Booking Request Created"
            : "Submitting Booking Request"
        }
        detail={
          status === "ready"
            ? "Taking you to your upcoming bookings."
            : "Authorizing your card and sending the request to the host."
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />
      <div className="relative min-h-[calc(100vh-80px)] px-4 py-12 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" />
          <div
            className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-elegant p-10 mx-auto text-center relative z-10 border border-white/30">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl glass-dark flex items-center justify-center shadow-glow">
            <AlertCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent tracking-tight">
            Booking Needs Attention
          </h1>
          <p className="text-gray-600 mb-8 text-lg font-medium leading-relaxed">
            {message}
          </p>
          <Button
            onClick={() => router.push("/upcoming")}
            className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-glow-hover transition-all"
          >
            Go to dashboard now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen
          message="Finalizing booking"
          detail="Confirming your request and preparing the next step."
        />
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
