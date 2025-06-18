"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/src/lib/firebase"; // adjust path as needed

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Optional: redirect to home page or dashboard
      console.log("Login successful");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100 px-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-6 animate-fade-in"
        >
          {/* Logo or App Name */}
          <div className="flex flex-col items-center mb-2">
            <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mb-2 shadow-md">
              {/* Replace with your logo if available */}
              <span className="text-3xl font-bold text-green-700">🎾</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-1">
              CourtShare
            </h2>
            <p className="text-gray-500 text-sm">Sign in to your account</p>
          </div>
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
          )}
          <button
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  ></path>
                </svg>
                Logging in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          {/* Optional: Add a link to sign up or reset password */}
          <div className="text-center mt-2">
            <a href="#" className="text-green-700 hover:underline text-sm">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
