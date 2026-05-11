"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CourtCard from "@/components/CourtCard";
import SearchSection from "@/components/SearchSection";
import { useAuth } from "@/lib/AuthContext";
import { type Coordinates } from "@/lib/geolocation";
import {
  toCourtCardModel,
  useCourtListings,
  useFilteredCourtListings,
} from "@/lib/useCourtListings";

type MapLoadState = "idle" | "ready" | "failed";

function CourtResultsMap({
  courts,
  fallbackQuery,
}: {
  courts: ReturnType<typeof useCourtListings>["courts"];
  fallbackQuery: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapState, setMapState] = useState<MapLoadState>("idle");
  const courtsWithCoordinates = useMemo(
    () =>
      courts.filter(
        (court) =>
          typeof court.latitude === "number" &&
          typeof court.longitude === "number"
      ),
    [courts]
  );

  useEffect(() => {
    if (courtsWithCoordinates.length === 0) return;

    const existingGoogle = (window as any).google;
    if (existingGoogle?.maps) {
      setMapState("ready");
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapState("failed");
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => setMapState("ready"), {
        once: true,
      });
      existingScript.addEventListener("error", () => setMapState("failed"), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapState("ready");
    script.onerror = () => setMapState("failed");
    document.head.appendChild(script);
  }, [courtsWithCoordinates.length]);

  useEffect(() => {
    const google = (window as any).google;
    if (mapState !== "ready" || !google?.maps || !mapRef.current) return;
    if (courtsWithCoordinates.length === 0) return;

    const firstCourt = courtsWithCoordinates[0];
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: {
          lat: firstCourt.latitude,
          lng: firstCourt.longitude,
        },
        zoom: courtsWithCoordinates.length > 1 ? 11 : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    courtsWithCoordinates.forEach((court) => {
      const position = {
        lat: court.latitude,
        lng: court.longitude,
      };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: court.name,
        label: {
          text: `$${court.price}`,
          color: "#ffffff",
          fontWeight: "700",
        },
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<strong>${court.name}</strong><br/>${court.location}<br/>$${court.price}/hr`,
      });
      marker.addListener("click", () => infoWindow.open(mapInstanceRef.current, marker));
      markersRef.current.push(marker);
    });

    if (courtsWithCoordinates.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 64);
    } else {
      mapInstanceRef.current.setCenter({
        lat: firstCourt.latitude,
        lng: firstCourt.longitude,
      });
      mapInstanceRef.current.setZoom(13);
    }
  }, [courtsWithCoordinates, mapState]);

  if (courtsWithCoordinates.length > 0 && mapState !== "failed") {
    return <div ref={mapRef} className="h-full w-full" />;
  }

  return (
    <iframe
      title="Court search map"
      src={`https://www.google.com/maps?q=${encodeURIComponent(
        fallbackQuery
      )}&output=embed`}
      className="h-full w-full"
      loading="lazy"
    />
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const { loading: authLoading } = useAuth();
  const { courts, loading, error } = useCourtListings(authLoading);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(
    searchParams.get("distance") && searchParams.get("distance") !== "any"
      ? Number(searchParams.get("distance"))
      : null
  );
  const locationQuery = searchParams.get("location") || "";
  const distanceFilteredCourts = useFilteredCourtListings(
    courts,
    userLocation,
    maxDistance
  );
  const filteredCourts = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query || query === "current location" || userLocation) {
      return distanceFilteredCourts;
    }

    const locationMatches = distanceFilteredCourts.filter((court) =>
      `${court.name} ${court.location}`.toLowerCase().includes(query)
    );

    return locationMatches.length > 0 ? locationMatches : distanceFilteredCourts;
  }, [distanceFilteredCourts, locationQuery, userLocation]);
  const mapQuery =
    locationQuery ||
    filteredCourts[0]?.location ||
    "tennis courts near me";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="w-full pb-10 pt-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchSection
            overlapHero={false}
            initialLocation={locationQuery}
            initialDistance={searchParams.get("distance") || "10"}
            initialDate={searchParams.get("date") || undefined}
            initialTime={searchParams.get("time") || "anytime"}
            onLocationChange={(_, coords) => setUserLocation(coords)}
            onDistanceChange={setMaxDistance}
          />
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)] lg:px-8">
          <section className="space-y-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                Search Results
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {filteredCourts.length} courts found
                {locationQuery ? ` near "${locationQuery}"` : ""}
              </p>
            </div>

            {loading && <p className="text-slate-600">Loading courts...</p>}
            {error && <p className="text-red-500">{error}</p>}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {filteredCourts.map((court) => (
                <CourtCard key={court.id} court={toCourtCardModel(court)} />
              ))}
            </div>
            {!loading && filteredCourts.length === 0 && !error && (
              <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No courts found. Try widening your search.
              </p>
            )}
          </section>

          <aside className="lg:sticky lg:top-24 lg:mt-14 lg:h-[calc(100vh-10.5rem)]">
            <div className="h-[420px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] lg:h-full">
              <CourtResultsMap courts={filteredCourts} fallbackQuery={mapQuery} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
