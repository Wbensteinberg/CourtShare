"use client";

import { useRef, useState, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import HeroSection from "@/components/HeroSection";
import SearchSection from "@/components/SearchSection";
import CourtCard from "@/components/CourtCard";
import { CalendarCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { type Coordinates } from "@/lib/geolocation";
import { useAuth } from "@/lib/AuthContext";
import {
  toCourtCardModel,
  useCourtListings,
  useFilteredCourtListings,
} from "@/lib/useCourtListings";

function TennisRacketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <ellipse cx="9" cy="8" rx="5" ry="6" strokeWidth="2" />
      <path d="M12.5 12.5 21 21" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 5h6M5 8h8M6 11h6M9 2v12"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { courts, loading, error } = useCourtListings(authLoading);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [activeCourtIndex, setActiveCourtIndex] = useState(0);
  const filteredCourts = useFilteredCourtListings(courts, userLocation, maxDistance);

  const scrollGalleryTo = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, filteredCourts.length - 1));
    const gallery = galleryRef.current;
    const target = gallery?.children.item(boundedIndex) as HTMLElement | null;

    target?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveCourtIndex(boundedIndex);
  };

  const updateActiveGalleryDot = () => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const children = Array.from(gallery.children) as HTMLElement[];
    const nearestIndex = children.reduce(
      (nearest, child, index) => {
        const distance = Math.abs(child.offsetLeft - gallery.scrollLeft);
        return distance < nearest.distance ? { index, distance } : nearest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY }
    ).index;

    setActiveCourtIndex(nearestIndex);
  };

  return (
    <div className="min-h-screen bg-white w-full">
      <AppHeader />
      <div className="w-full bg-primary flex flex-col items-center">
        <HeroSection />
      </div>
      <main className="w-full bg-white">
        <div ref={searchRef} className="mx-auto w-full max-w-7xl px-4 py-8">
          <SearchSection
            onLocationChange={(_, coords) => setUserLocation(coords)}
            onDistanceChange={setMaxDistance}
          />
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pb-0">
          {loading && (
            <p className="text-center text-gray-600 mt-8">Loading courts...</p>
          )}
          {error && <p className="text-center text-red-500 mt-8">{error}</p>}
          <section className="mt-8 mb-8">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => scrollGalleryTo(activeCourtIndex - 1)}
                disabled={activeCourtIndex === 0 || filteredCourts.length === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[var(--site-accent)] hover:text-[var(--site-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous featured court"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-center text-4xl font-black tracking-tight text-gray-900">
                Featured Courts
              </h2>
              <button
                type="button"
                onClick={() => scrollGalleryTo(activeCourtIndex + 1)}
                disabled={
                  filteredCourts.length === 0 ||
                  activeCourtIndex >= filteredCourts.length - 1
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[var(--site-accent)] hover:text-[var(--site-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next featured court"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div
              ref={galleryRef}
              onScroll={updateActiveGalleryDot}
              className="mt-8 flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-smooth pb-4"
            >
              {filteredCourts.map((court, index) => (
                <div
                  key={court.id}
                  className="w-[min(86vw,360px)] shrink-0 snap-start md:w-[380px]"
                  aria-label={`Featured court ${index + 1} of ${filteredCourts.length}`}
                >
                  <CourtCard court={toCourtCardModel(court)} />
                </div>
              ))}
            </div>
            {filteredCourts.length > 0 && (
              <div className="mt-4 flex justify-center gap-2">
                {filteredCourts.map((court, index) => (
                  <button
                    key={court.id}
                    type="button"
                    onClick={() => scrollGalleryTo(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeCourtIndex
                        ? "w-8 bg-[var(--site-accent)]"
                        : "w-2.5 bg-slate-300 hover:bg-slate-400"
                    }`}
                    aria-label={`Show featured court ${index + 1}`}
                    aria-current={index === activeCourtIndex ? "true" : undefined}
                  />
                ))}
              </div>
            )}
          </section>
          {!loading && filteredCourts.length === 0 && !error && (
            <p className="text-center text-gray-500 mt-12">No courts found.</p>
          )}
        </div>
      </main>

      {!user && (
        <section
          id="how-it-works"
          className="pb-16 pt-20 bg-gradient-to-b from-white via-slate-50 to-white"
        >
          <div className="mx-auto w-full max-w-7xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-6 text-gray-900 tracking-tight">
                How It Works
              </h2>
            </div>

            <div className="mx-auto grid grid-cols-1 gap-12 lg:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
                <h3 className="text-3xl font-black tracking-tight text-[var(--site-accent)]">
                  For Players
                </h3>
                <div className="mt-8 space-y-6">
                  {[
                    {
                      icon: Search,
                      text: "Find courts near you easily that work with your availability.",
                    },
                    {
                      icon: CalendarCheck,
                      text: "Select your preferred time slot and book instantly.",
                    },
                    {
                      icon: TennisRacketIcon,
                      text: "Check-in at the court seamlessly and start playing!",
                    },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--site-accent)] text-white shadow-lg">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="pt-2 text-base font-medium leading-7 text-slate-700">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex min-h-[360px] flex-col justify-between rounded-[32px] bg-[var(--site-accent)] p-8 text-white shadow-[0_20px_70px_rgba(15,23,42,0.16)]">
                <div>
                  <h3 className="text-3xl font-black tracking-tight">
                    For Hosts
                  </h3>
                  <p className="mt-6 max-w-md text-lg font-medium leading-8 text-white/82">
                    Have a court? List it now to start earning.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/sign-up")}
                  className="mt-10 w-fit cursor-pointer rounded-full border border-white bg-white px-7 py-3 text-sm font-extrabold text-[var(--site-accent)] transition-colors hover:bg-slate-100"
                >
                  Create a Listing
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
