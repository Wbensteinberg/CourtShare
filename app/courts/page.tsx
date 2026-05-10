"use client";

import { useEffect, useState, useRef, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { db, isMockMode } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AppHeader from "@/components/AppHeader";
import HeroSection from "@/components/HeroSection";
import SearchSection from "@/components/SearchSection";
import CourtCard from "@/components/CourtCard";
import { CalendarCheck, Search } from "lucide-react";
import {
  calculateDistance,
  formatDistance,
  type Coordinates,
} from "@/lib/geolocation";
import { getMockCourts, setMockUserRole } from "@/lib/mockData";

interface Court {
  id: string;
  name: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  distance?: number; // Will be calculated and added
}

function TennisRacketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <ellipse cx="9" cy="8" rx="5" ry="6" strokeWidth="2" />
      <path d="M12.5 12.5 21 21" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 5h6M5 8h8M6 11h6M9 2v12" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [filteredCourts, setFilteredCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading, isOwner, setIsOwner } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  useEffect(() => {
    // Remove redirect to /login for unauthenticated users
    // Anyone can view courts now
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchCourts = async () => {
      setLoading(true);
      setError("");
      try {
        const courtsData: Court[] = isMockMode
          ? (getMockCourts() as Court[])
          : ((await getDocs(collection(db, "courts"))).docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Court[]);
        setCourts(courtsData);
      } catch (err: any) {
        console.error("Error fetching courts:", err);
        setError("Failed to fetch courts. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    // Only fetch courts if user is authenticated or if we're not in loading state
    if (!authLoading) {
      fetchCourts();
    }
  }, [authLoading]);

  // Function to filter courts by distance
  const filterCourtsByDistance = (
    courts: Court[],
    userCoords: Coordinates,
    maxDist: number
  ) => {
    console.log("Filtering courts by distance:", {
      userCoords,
      maxDist,
      totalCourts: courts.length,
    });

    return courts
      .map((court) => {
        if (court.latitude && court.longitude) {
          const distance = calculateDistance(userCoords, {
            latitude: court.latitude,
            longitude: court.longitude,
          });
          console.log(`Court ${court.name}: ${distance} miles away`);
          return { ...court, distance };
        }
        console.log(`Court ${court.name}: No coordinates available`);
        return court;
      })
      .filter((court) => {
        // Only show courts that have coordinates AND are within the distance limit
        // Courts without coordinates are hidden when distance filtering is active
        const hasCoordinates = court.latitude && court.longitude;
        const withinDistance = court.distance && court.distance <= maxDist;
        const shouldShow = hasCoordinates && withinDistance;

        console.log(
          `Court ${court.name}: hasCoordinates=${hasCoordinates}, withinDistance=${withinDistance}, shouldShow=${shouldShow}`
        );
        return shouldShow;
      })
      .sort((a, b) => {
        // Sort by distance
        if (a.distance && b.distance) {
          return a.distance - b.distance;
        }
        return 0;
      });
  };

  // Initialize filtered courts with all courts
  useEffect(() => {
    setFilteredCourts(courts);
  }, [courts]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleToggleRole = async () => {
    if (!user) return;
    const newIsOwner = !isOwner;
    if (isMockMode) {
      setMockUserRole(user.uid, newIsOwner);
    } else {
      await updateDoc(doc(db, "users", user.uid), { isOwner: newIsOwner });
    }
    setIsOwner(newIsOwner);
    // Do not route anywhere after toggling mode
  };

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-white w-full">
      <AppHeader />
      <div className="w-full bg-primary flex flex-col items-center">
        <HeroSection />
      </div>
      <main className="w-full bg-white">
        <div className="container mx-auto px-4 py-8">
          <SearchSection
            onLocationChange={(location, coords) => {
              setUserLocation(coords);
            }}
            onDistanceChange={(distance) => {
              setMaxDistance(distance);
            }}
          />
          {loading && (
            <p className="text-center text-gray-600 mt-8">Loading courts...</p>
          )}
          {error && <p className="text-center text-red-500 mt-8">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-8">
            {filteredCourts.map((court) => (
              <CourtCard
                key={court.id}
                court={{
                  id: court.id,
                  name: court.name,
                  location: court.location,
                  price: court.price,
                  rating: 4.8,
                  reviewCount: 42,
                  image:
                    court.imageUrl ||
                    "https://placehold.co/400x300?text=Tennis+Court",
                  surface: "Hard Court",
                  indoor: false,
                  amenities: ["Parking", "WiFi"],
                  availability: "Available",
                  distance: court.distance,
                }}
              />
            ))}
          </div>
          {!loading && filteredCourts.length === 0 && !error && (
            <p className="text-center text-gray-500 mt-12">No courts found.</p>
          )}
        </div>
      </main>

      {/* How It Works Section */}
      <section className="py-24 bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-gray-900 tracking-tight">
              How It Works
            </h2>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2">
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
                  For Owners
                </h3>
                <p className="mt-6 max-w-md text-lg font-medium leading-8 text-white/82">
                  Have a court? List it now to start earning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(user ? "/create-listing" : "/login")}
                className="mt-10 w-fit cursor-pointer rounded-full border border-white bg-white px-7 py-3 text-sm font-extrabold text-[var(--site-accent)] transition-colors hover:bg-slate-100"
              >
                Create a Listing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Modernized */}
      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-16 border-t border-gray-700/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-5">
              <h3 className="font-black text-2xl bg-gradient-to-r from-[#00d49e] to-[#00b88a] bg-clip-text text-transparent">
                CourtShare
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                The leading platform for tennis court bookings across the
                nation.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">For Players</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Find Courts
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Mobile App
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">For Court Owners</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <button
                    onClick={async () => {
                      if (!user) {
                        router.push("/signup");
                        return;
                      }
                      router.push("/create-listing");
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    List Your Court
                  </button>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Resources
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-white/80">
            <p>&copy; 2025 CourtShare. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
