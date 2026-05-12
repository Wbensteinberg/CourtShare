"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CourtCard from "@/components/CourtCard";
import SearchSection from "@/components/SearchSection";
import { useAuth } from "@/lib/AuthContext";
import { type Coordinates } from "@/lib/geolocation";
import {
  type CourtBooking,
  type CourtListing,
  toCourtCardModel,
  useCourtBookings,
  useCourtListings,
  useFilteredCourtListings,
} from "@/lib/useCourtListings";

type MapLoadState = "idle" | "ready" | "failed";
const ACTIVE_SEARCH_STATUSES = new Set(["pending", "confirmed"]);

/** Hide Maps default InfoWindow close so we only use our in-content × (same row as title). */
function hideDefaultInfoWindowCloseButtons(mapRoot: HTMLElement | null) {
  if (!mapRoot) return;
  mapRoot
    .querySelectorAll<HTMLButtonElement>(
      ".gm-style-iw button:not(.courtshare-iw-close)"
    )
    .forEach((btn) => {
      btn.style.display = "none";
    });
}

function buildCourtInfoWindowElement(
  court: CourtListing,
  onClose: () => void
): HTMLElement {
  const imageUrl =
    court.imageUrl || "https://placehold.co/400x240?text=Tennis+Court";
  const courtHref = `/courts/${encodeURIComponent(court.id)}`;

  const root = document.createElement("div");
  root.style.cssText =
    "width:200px;overflow:hidden;border-radius:0;font-family:Arial,sans-serif;box-sizing:border-box;";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 4px 0;";

  const link = document.createElement("a");
  link.href = courtHref;
  link.textContent = court.name;
  link.style.cssText =
    "flex:1;min-width:0;margin:0;color:#0f172a;font-size:17px;font-weight:800;line-height:1.2;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "courtshare-iw-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.cssText =
    "flex-shrink:0;border:none;background:transparent;padding:0 2px;margin:0;font-size:22px;line-height:1;color:#64748b;cursor:pointer;";
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  });

  header.appendChild(link);
  header.appendChild(closeBtn);

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = court.name;
  img.style.cssText =
    "width:240px;height:128px;object-fit:cover;display:block;";

  const footer = document.createElement("div");
  footer.style.cssText =
    "padding:6px 4px 2px;display:flex;align-items:center;justify-content:space-between;gap:12px;";

  const loc = document.createElement("div");
  loc.textContent = court.location || "";
  loc.style.cssText =
    "color:#64748b;font-size:13px;line-height:1.35;flex:1;min-width:0;";

  const price = document.createElement("div");
  price.textContent = `$${court.price}/hr`;
  price.style.cssText =
    "color:#008665;font-size:15px;font-weight:800;flex-shrink:0;white-space:nowrap;";

  footer.appendChild(loc);
  footer.appendChild(price);

  root.appendChild(header);
  root.appendChild(img);
  root.appendChild(footer);

  return root;
}

function toDateParam(value: string | null) {
  if (!value) return "";
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? "" : value;
}

function toTwentyFourHourTime(time: string) {
  const normalized = time.trim();
  if (/^\d{2}:\d{2}$/.test(normalized)) return normalized;

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return "";

  let hour = Number(match[1]);
  const minute = match[2] || "00";
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minute}`;
}

function getSearchTimeSlots(timeParam: string | null) {
  const time = timeParam || "anytime";
  const ranges: Record<string, [number, number]> = {
    morning: [6, 11],
    afternoon: [12, 17],
    evening: [18, 21],
  };

  if (ranges[time]) {
    const [start, end] = ranges[time];
    return Array.from({ length: end - start + 1 }, (_, index) => {
      const hour = start + index;
      return `${hour.toString().padStart(2, "0")}:00`;
    });
  }

  const exactTime = toTwentyFourHourTime(time);
  return exactTime ? [exactTime] : [];
}

function addBlockedSlot(
  blockedCounts: Map<string, number>,
  slot: string,
  count: number
) {
  blockedCounts.set(slot, Math.max(blockedCounts.get(slot) || 0, count));
}

function addBookingSlots(
  blockedCounts: Map<string, number>,
  booking: CourtBooking
) {
  const startTime = toTwentyFourHourTime(booking.time);
  const [startHour] = startTime.split(":").map(Number);
  if (!Number.isFinite(startHour)) return;

  const durationMinutes =
    booking.durationMinutes || Math.round((booking.duration || 1) * 60);
  const durationHours = Math.max(1, Math.ceil(durationMinutes / 60));

  for (let offset = 0; offset < durationHours; offset += 1) {
    const hour = startHour + offset;
    addBlockedSlot(
      blockedCounts,
      `${hour.toString().padStart(2, "0")}:00`,
      (blockedCounts.get(`${hour.toString().padStart(2, "0")}:00`) || 0) + 1
    );
  }
}

function courtMatchesDateAndTime(
  court: CourtListing,
  bookings: CourtBooking[],
  dateParam: string,
  timeParam: string | null
) {
  if (!dateParam) return true;
  if (court.blockedDates?.includes(dateParam)) return false;

  const slots = getSearchTimeSlots(timeParam);
  if (slots.length === 0) return true;

  const date = new Date(`${dateParam}T00:00:00`);
  const dayOfWeek = date.getDay();
  const capacity = Math.max(1, court.numberOfCourts || 1);
  const blockedCounts = new Map<string, number>();
  const blockAll = (slot: string) => addBlockedSlot(blockedCounts, slot, capacity);

  (court.blockedTimes?.[dateParam] || []).forEach(blockAll);
  (court.alwaysBlockedTimes || []).forEach(blockAll);
  (court.alwaysBlockedTimesByDay?.[dayOfWeek] || []).forEach(blockAll);

  bookings
    .filter(
      (booking) =>
        booking.courtId === court.id &&
        booking.date === dateParam &&
        ACTIVE_SEARCH_STATUSES.has(booking.status)
    )
    .forEach((booking) => addBookingSlots(blockedCounts, booking));

  return slots.some((slot) => (blockedCounts.get(slot) || 0) < capacity);
}

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
  const activeInfoWindowRef = useRef<any>(null);
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

    activeInfoWindowRef.current?.close();
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
          fontSize: "10px",
          fontWeight: "700",
        },
      });
      const infoWindow = new google.maps.InfoWindow();
      google.maps.event.addListener(infoWindow, "domready", () => {
        hideDefaultInfoWindowCloseButtons(mapRef.current);
      });
      marker.addListener("click", () => {
        activeInfoWindowRef.current?.close();
        infoWindow.setContent(
          buildCourtInfoWindowElement(court, () => {
            infoWindow.close();
          })
        );
        infoWindow.open(mapInstanceRef.current, marker);
        activeInfoWindowRef.current = infoWindow;
      });
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
  const { bookings } = useCourtBookings(authLoading);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const initialCoordinates = useMemo<Coordinates | null>(() => {
    const latitude = Number(latParam);
    const longitude = Number(lngParam);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  }, [latParam, lngParam]);
  const [userLocation, setUserLocation] =
    useState<Coordinates | null>(initialCoordinates);
  const [maxDistance, setMaxDistance] = useState<number | null>(
    searchParams.get("distance") && searchParams.get("distance") !== "any"
      ? Number(searchParams.get("distance"))
      : null
  );
  const locationQuery = searchParams.get("location") || "";
  const dateQuery = toDateParam(searchParams.get("date"));
  const timeQuery = searchParams.get("time") || "anytime";

  useEffect(() => {
    setUserLocation(initialCoordinates);
  }, [initialCoordinates]);

  useEffect(() => {
    const nextDistance =
      searchParams.get("distance") && searchParams.get("distance") !== "any"
        ? Number(searchParams.get("distance"))
        : null;
    setMaxDistance(Number.isFinite(nextDistance) ? nextDistance : null);
  }, [searchParams]);

  const distanceFilteredCourts = useFilteredCourtListings(
    courts,
    userLocation,
    maxDistance
  );
  const filteredCourts = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    let nextCourts = distanceFilteredCourts;

    if (query && query !== "current location" && !userLocation) {
      nextCourts = nextCourts.filter((court) =>
        `${court.name} ${court.location} ${court.address || ""}`
          .toLowerCase()
          .includes(query)
      );
    }

    return nextCourts.filter((court) =>
      courtMatchesDateAndTime(court, bookings, dateQuery, timeQuery)
    );
  }, [bookings, dateQuery, distanceFilteredCourts, locationQuery, timeQuery, userLocation]);
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
            initialLatitude={latParam || undefined}
            initialLongitude={lngParam || undefined}
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
