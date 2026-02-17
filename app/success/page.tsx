"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useAuth();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    const timeoutId = setTimeout(() => {
      router.push("/dashboard/player");
    }, 2200);
    return () => clearTimeout(timeoutId);
  }, [router, searchParams]);

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
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent tracking-tight">
            Booking Confirmed!
          </h1>
          <p className="text-gray-600 mb-8 text-lg font-medium leading-relaxed">
            Your payment was successful and your booking has been confirmed.
          </p>
          <p className="text-sm text-gray-500 font-semibold animate-pulse">
            Taking you to your dashboard...
          </p>
          <Button
            onClick={() => router.push("/dashboard/player")}
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
