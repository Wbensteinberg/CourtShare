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

interface Court {
  id: string;
  name: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
}

export default function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading, isOwner, setIsOwner } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        setError(err.message || "Failed to fetch courts");
      } finally {
        setLoading(false);
      }
    };
    fetchCourts();
  }, []);

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
    <div className="min-h-screen bg-background w-full">
      <AppHeader />
      <div className="w-full flex flex-col items-center">
        <HeroSection />
        <main className="container mx-auto px-4 py-8">
          <SearchSection />
          {loading && (
            <p className="text-center text-gray-600 mt-8">Loading courts...</p>
          )}
          {error && <p className="text-center text-red-500 mt-8">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-8">
            {courts.map((court) => (
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
                }}
                // Optionally, add onClick handlers for View Details/Book Now
              />
            ))}
          </div>
          {!loading && courts.length === 0 && !error && (
            <p className="text-center text-gray-500 mt-12">No courts found.</p>
          )}
        </main>
      </div>
    </div>
  );
}
