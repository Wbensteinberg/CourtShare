"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Sparkles } from "lucide-react";

const manualButtonClassName =
  "w-full mt-6 h-12 text-sm font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl inline-flex items-center justify-center";

type BookingSuccessScreenProps = {
  /** 0–100 for determinate bar; `null` for loading / indeterminate */
  progress: number | null;
  title: string;
  subtitle: string;
  barLabel: string;
  manualCta?: string;
  /** Prefer `href` for Suspense fallback (no router). */
  manualHref?: string;
  onManualNavigate?: () => void;
};

/**
 * Post-checkout success layout — matches login/courts (white + emerald gradient strip + overlapping card).
 */
export function BookingSuccessScreen({
  progress,
  title,
  subtitle,
  barLabel,
  manualCta = "Go to dashboard now",
  manualHref,
  onManualNavigate,
}: BookingSuccessScreenProps) {
  const determinate = progress !== null;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />

      <div className="w-full bg-gradient-tennis py-12 md:py-14 px-4 flex flex-col items-center text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-5 shadow-glow ring-2 ring-white/20">
            <CheckCircle className="h-9 w-9 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sparkles className="h-5 w-5 text-amber-200/90" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              Payment received
            </span>
            <Sparkles className="h-5 w-5 text-amber-200/90" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight max-w-xl">
            {title}
          </h1>
          <p className="text-white/85 mt-3 text-sm md:text-base font-medium max-w-lg leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex justify-center px-4 -mt-10 pb-16 relative z-10">
        <Card className="w-full max-w-md shadow-elegant rounded-3xl border border-gray-100 overflow-hidden bg-white">
          <CardContent className="p-8 pt-10">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              {barLabel}
            </p>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden border border-gray-100/80 shadow-inner">
              {determinate ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 shadow-sm transition-[width] ease-out"
                  style={{
                    width: `${progress}%`,
                    transitionDuration:
                      "var(--booking-progress-duration, 3000ms)",
                  }}
                />
              ) : (
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  <div className="booking-progress-indeterminate absolute h-full w-[45%] rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 shadow-sm" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center leading-relaxed">
              {determinate
                ? "Hang tight — we’re opening your player dashboard."
                : "Confirming your booking…"}
            </p>
            {(manualHref || onManualNavigate) &&
              (manualHref ? (
                <Link href={manualHref} className={manualButtonClassName}>
                  {manualCta}
                </Link>
              ) : (
                <Button
                  type="button"
                  onClick={onManualNavigate}
                  className={manualButtonClassName}
                >
                  {manualCta}
                </Button>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
