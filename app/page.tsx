"use client";

import { useAuth } from "@/src/lib/AuthContext";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-6 animate-fade-in">
        <div className="flex flex-col items-center mb-2">
          <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mb-2 shadow-md">
            <span className="text-3xl font-bold text-green-700">🎾</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-1">
            CourtShare
          </h1>
        </div>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : user ? (
          <>
            <p className="text-green-700 text-lg font-semibold text-center mb-2">
              Welcome, <span className="font-mono">{user.email}</span>!
            </p>
            <p className="text-gray-600 text-center">
              You are logged in. Refresh the page to test persistent auth state.
            </p>
            <button
              className="mt-4 bg-green-600 text-white py-2 px-6 rounded-lg font-semibold shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-600 text-center mb-2">
              You are not logged in.
            </p>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="text-green-700 hover:underline font-semibold"
              >
                Log In
              </Link>
              <span className="text-gray-400">|</span>
              <Link
                href="/signup"
                className="text-green-700 hover:underline font-semibold"
              >
                Sign Up
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
