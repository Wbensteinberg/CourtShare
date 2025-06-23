"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/src/lib/AuthContext";

interface Court {
  name: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
}

export default function CourtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  // Booking state
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    const fetchCourt = async () => {
      try {
        const docRef = doc(db, "courts", id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setCourt(snapshot.data() as Court);
        } else {
          setCourt(null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch court");
      } finally {
        setLoading(false);
      }
    };
    fetchCourt();
  }, [id]);

  const handleBooking = async () => {
    if (!user) return;
    if (!date || !time || !duration) {
      alert("Please fill out all fields.");
      return;
    }
    setBookingStatus("loading");
    try {
      await addDoc(collection(db, "bookings"), {
        userId: user.uid,
        courtId: id,
        date,
        time,
        duration,
        status: "pending",
        createdAt: Timestamp.now(),
      });
      setBookingStatus("success");
    } catch (err) {
      setBookingStatus("error");
    }
  };

  if (loading) {
    return <p className="text-center mt-10 text-gray-600">Loading court...</p>;
  }
  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }
  if (!court) {
    return <p className="text-center mt-10 text-red-500">Court not found</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-200 via-lime-100 to-green-50 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 mx-auto">
        <div className="w-full h-72 relative mb-6 rounded-2xl overflow-hidden shadow-md">
          {court.imageUrl ? (
            <Image
              src={court.imageUrl}
              alt={court.name}
              fill
              className="object-cover rounded-2xl"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-2xl">
              <span className="text-6xl">🎾</span>
            </div>
          )}
        </div>
        <h2 className="text-3xl font-extrabold text-green-900 mb-2 text-center drop-shadow-sm">
          {court.name}
        </h2>
        <p className="text-gray-600 text-center mb-1 text-lg">
          {court.location}
        </p>
        <p className="text-green-800 font-bold text-center text-xl mb-4">
          ${court.price} <span className="font-medium">/ hour</span>
        </p>
        <p className="text-gray-700 text-base mb-6 text-center whitespace-pre-line">
          {court.description}
        </p>
        {/* Booking UI */}
        {user ? (
          <div className="bg-white p-6 rounded-2xl shadow-md max-w-md mx-auto mt-4 mb-8 space-y-4 border border-green-100">
            <h3 className="text-xl font-bold text-green-800 mb-2 text-center">
              Book This Court
            </h3>
            <label className="block">
              <span className="text-gray-700">Date</span>
              <input
                type="date"
                className="mt-1 block w-full rounded border-gray-300"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Time</span>
              <input
                type="time"
                className="mt-1 block w-full rounded border-gray-300"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Duration (hours)</span>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 block w-full rounded border-gray-300"
              >
                {[1, 2, 3].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={handleBooking}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-semibold text-lg mt-2"
              disabled={bookingStatus === "loading"}
            >
              {bookingStatus === "loading" ? "Booking..." : "Book Court"}
            </button>
            {bookingStatus === "success" && (
              <p className="text-green-600 text-center">Booking submitted!</p>
            )}
            {bookingStatus === "error" && (
              <p className="text-red-600 text-center">
                Booking failed. Try again.
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 mb-8">
            Log in to book this court.
          </p>
        )}
        <div className="flex justify-center mt-6">
          <button
            className="text-green-700 hover:underline text-sm font-semibold"
            onClick={() => router.back()}
          >
            ← Back to Browse
          </button>
        </div>
      </div>
    </div>
  );
}
