"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AppHeader from "@/components/AppHeader";
import HeroSection from "@/components/HeroSection";
import SearchSection from "@/components/SearchSection";
import CourtCard from "@/components/CourtCard";
import { calculateDistance, formatDistance, type Coordinates } from "@/lib/geolocation";

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
        const querySnapshot = await getDocs(collection(db, "courts"));
        const courtsData: Court[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Court[];
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
  const filterCourtsByDistance = (courts: Court[], userCoords: Coordinates, maxDist: number) => {
    return courts
      .map(court => {
        if (court.latitude && court.longitude) {
          const distance = calculateDistance(userCoords, {
            latitude: court.latitude,
            longitude: court.longitude
          });
          return { ...court, distance };
        }
        return court;
      })
      .filter(court => !court.latitude || !court.longitude || (court.distance && court.distance <= maxDist))
      .sort((a, b) => {
        // Sort by distance if both have coordinates, otherwise keep original order
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
    await updateDoc(doc(db, "users", user.uid), { isOwner: newIsOwner });
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
      <div className="w-full bg-[#286a3a] flex flex-col items-center">
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
          {isOwner ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="text-6xl mb-4">🏢</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Owner Mode Active
                </h2>
                <p className="text-gray-600 mb-6">
                  You're currently in owner mode. Switch to player mode to view and book courts.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleToggleRole}
                    className="w-full bg-green-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-800 transition hover:cursor-pointer"
                  >
                    Switch to Player Mode
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/owner")}
                    className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition hover:cursor-pointer"
                  >
                    Go to Owner Dashboard
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                      rating: 4.8, // Default or fetch if available
                      reviewCount: 42, // Default or fetch if available
                      image:
                        court.imageUrl ||
                        "https://placehold.co/400x300?text=Tennis+Court",
                      surface: "Hard Court", // Default or fetch if available
                      indoor: false, // Default or fetch if available
                      amenities: ["Parking", "WiFi"], // Default or fetch if available
                      availability: "Available", // Default or fetch if available
                      distance: court.distance, // Pass calculated distance
                    }}
                    // Optionally, add onClick handlers for View Details/Book Now
                  />
                ))}
              </div>
              {!loading && filteredCourts.length === 0 && !error && (
                <p className="text-center text-gray-500 mt-12">No courts found.</p>
              )}
            </>
          )}
        </div>
      </main>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Booking your perfect tennis court is simple and hassle-free
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Search & Browse</h3>
              <p className="text-gray-600">
                Find courts near you with our advanced search filters. Browse by location, price and availability.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Book Instantly</h3>
              <p className="text-gray-600">
                Select your preferred time slot and book instantly. Real-time availability ensures you get the court you want.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Play & Enjoy</h3>
              <p className="text-gray-600">
                Show up and play! All bookings come with confirmation details and easy check-in process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-green-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Book Your Court?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto text-white/90">
            Join thousands of tennis players who trust CourtShare for their court reservations
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!user && (
              <button 
                onClick={() => router.push("/signup")}
                className="bg-white text-green-700 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Sign Up Free
              </button>
            )}
            <button 
              onClick={() => {
                const searchSection = document.querySelector('[data-search-section]');
                if (searchSection) {
                  searchSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="border border-white/30 text-white hover:bg-white/10 px-8 py-3 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Browse Courts
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-green-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold text-lg">CourtShare</h3>
              <p className="text-sm text-white/80">
                The leading platform for tennis court bookings across the nation.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">For Players</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Find Courts</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">How It Works</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Mobile App</a></li>
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
                      if (!isOwner) {
                        await handleToggleRole();
                      }
                      router.push("/create-listing");
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    List Your Court
                  </button>
                </li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Resources</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Support</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors cursor-pointer">Terms</a></li>
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
