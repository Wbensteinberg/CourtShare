"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import Image from "next/image";
import { useAuth } from "@/src/lib/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";

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
    if (newIsOwner) {
      router.push("/dashboard/owner");
    }
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
    <div className="min-h-screen bg-gradient-to-br from-green-200 via-lime-100 to-green-50 px-4 py-16 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 pointer-events-none select-none opacity-30 z-0"
        aria-hidden
      >
        <svg width="100%" height="100%" className="h-full w-full">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="40" height="40" fill="none" />
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#bbf7d0"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative max-w-6xl mx-auto z-10">
        {/* Login/Signup buttons for unauthenticated users */}
        {!user && (
          <div className="flex justify-end mb-6 gap-4">
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-green-400 text-base"
              onClick={() => router.push("/login")}
            >
              Log In
            </button>
            <button
              className="bg-blue-100 text-blue-800 px-5 py-2 rounded-xl font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              onClick={() => router.push("/signup")}
            >
              Sign Up
            </button>
          </div>
        )}
        {/* Hamburger/Profile menu for logged-in users */}
        {user && (
          <div className="flex justify-end mb-6 gap-4 relative">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full bg-green-200 hover:bg-green-300 shadow-md focus:outline-none"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
            >
              {/* Hamburger icon */}
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <rect x="4" y="7" width="16" height="2" rx="1" fill="#166534" />
                <rect
                  x="4"
                  y="15"
                  width="16"
                  height="2"
                  rx="1"
                  fill="#166534"
                />
              </svg>
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-12 w-48 bg-white rounded-xl shadow-lg border border-green-100 z-50 animate-fade-in"
              >
                <button
                  className="w-full text-left px-5 py-3 hover:bg-green-50 text-green-800 font-semibold rounded-t-xl"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(
                      isOwner ? "/dashboard/owner" : "/dashboard/player"
                    );
                  }}
                >
                  Dashboard
                </button>
                <button
                  className="w-full text-left px-5 py-3 hover:bg-green-50 text-red-700 font-semibold rounded-b-xl border-t border-green-100"
                  onClick={handleLogout}
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <h1 className="text-3xl font-extrabold text-green-900 drop-shadow-sm">
            Browse Courts
          </h1>
          {user && (
            <div className="flex flex-col items-center gap-1">
              <button
                className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold text-sm shadow hover:bg-blue-200 transition"
                onClick={handleToggleRole}
              >
                Switch to {isOwner ? "Player" : "Owner"} Mode
              </button>
              <span className="text-xs text-gray-500">
                Current mode:{" "}
                <span className="font-bold">
                  {isOwner ? "Owner" : "Player"}
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="w-32 h-1 bg-green-400 rounded mx-auto mb-12" />
        {loading && (
          <p className="text-center text-gray-600">Loading courts...</p>
        )}
        {error && <p className="text-center text-red-500">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12">
          {courts.map((court) => (
            <div
              key={court.id}
              className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl p-7 flex flex-col items-center transition-transform hover:-translate-y-2 hover:shadow-green-200 duration-200 border border-green-100 relative"
              style={{
                boxShadow:
                  "0 8px 32px 0 rgba(34,197,94,0.10), 0 1.5px 8px 0 rgba(34,197,94,0.08)",
              }}
            >
              <div className="w-full h-52 relative mb-5 rounded-2xl overflow-hidden shadow-md">
                {court.imageUrl ? (
                  <Image
                    src={court.imageUrl}
                    alt={court.name}
                    fill
                    className="object-cover rounded-2xl"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-2xl">
                    <span className="text-5xl">🎾</span>
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-green-700 mb-1 text-center drop-shadow-sm">
                {court.name}
              </h2>
              <p className="text-gray-600 mb-1 text-center font-medium">
                {court.location}
              </p>
              <p className="text-green-800 font-bold mb-2 text-center text-lg">
                ${court.price} <span className="font-medium">/ hour</span>
              </p>
              <p className="text-gray-500 text-base line-clamp-2 mb-4 text-center">
                {court.description}
              </p>
              <button
                className="mt-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
                onClick={() => router.push(`/courts/${court.id}`)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
        {!loading && courts.length === 0 && !error && (
          <p className="text-center text-gray-500 mt-12">No courts found.</p>
        )}
      </div>
    </div>
  );
}
