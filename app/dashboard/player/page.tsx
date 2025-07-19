"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
}

export default function PlayerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<Record<string, Court>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    const fetchBookings = async () => {
      try {
        // Fetch bookings for this user
        const bookingsSnap = await getDocs(
          query(collection(db, "bookings"), where("userId", "==", user.uid))
        );
        const bookingsData: Booking[] = bookingsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];
        setBookings(bookingsData);
        // Fetch all courts for these bookings
        const courtIds = Array.from(
          new Set(bookingsData.map((b) => b.courtId))
        );
        const courtsMap: Record<string, Court> = {};
        await Promise.all(
          courtIds.map(async (courtId) => {
            const courtDoc = await getDoc(doc(db, "courts", courtId));
            if (courtDoc.exists()) {
              courtsMap[courtId] = { id: courtId, ...courtDoc.data() } as Court;
            }
          })
        );
        setCourts(courtsMap);
      } catch (err: any) {
        setError(err.message || "Failed to fetch bookings");
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking?"))
      return;
    setCancelling(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "cancelled" });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "cancelled" } : b
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancelling(null);
    }
  };

  // Split bookings into upcoming and past
  const now = new Date();
  const upcoming = bookings.filter((b) => {
    const bookingDate = new Date(b.date + "T" + b.time);
    return bookingDate >= now && b.status !== "cancelled";
  });
  const past = bookings.filter((b) => {
    const bookingDate = new Date(b.date + "T" + b.time);
    return bookingDate < now || b.status === "cancelled";
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-8 animate-fade-in my-16">
        <div className="flex justify-start mb-4">
          <button
            className="text-[#286a3a] hover:underline text-sm font-semibold"
            onClick={() => router.push("/courts")}
          >
            ← Browse More Courts
          </button>
        </div>
        <h1 className="text-3xl font-extrabold text-[#286a3a] mb-2 text-center">
          Player Dashboard
        </h1>
        <p className="text-gray-600 text-center mb-2">
          Welcome! Here are your bookings.
        </p>
        {loading ? (
          <p className="text-center text-gray-500">Loading bookings...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-[#286a3a] mb-2">
                Upcoming Bookings
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-gray-400 text-sm">No upcoming bookings.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((b) => {
                    const court = courts[b.courtId];
                    return (
                      <li
                        key={b.id}
                        className="bg-[#e3f1e7] rounded-xl p-4 shadow flex flex-col sm:flex-row sm:items-center gap-4 border border-[#e3f1e7]"
                      >
                        <div className="flex-1">
                          <div className="text-[#286a3a] font-semibold text-sm">
                            {b.date} at {b.time} ({b.duration}h)
                          </div>
                          <div className="text-xs text-gray-500">
                            Court: {court ? court.name : b.courtId} (
                            {court ? court.location : ""})
                          </div>
                          <div className="text-xs text-gray-500">
                            Status: {b.status}
                          </div>
                        </div>
                        {court?.imageUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={court.imageUrl}
                              alt={court.name}
                              className="w-16 h-16 object-cover rounded-lg shadow-sm"
                            />
                          </div>
                        )}
                        {b.status !== "cancelled" && (
                          <button
                            className="bg-red-100 text-red-700 px-3 py-1 rounded font-semibold text-xs shadow hover:bg-red-200 transition disabled:opacity-60"
                            onClick={() => handleCancel(b.id)}
                            disabled={cancelling === b.id}
                          >
                            {cancelling === b.id ? "Cancelling..." : "Cancel"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#286a3a] mt-8 mb-2">
                Past & Cancelled Bookings
              </h2>
              {past.length === 0 ? (
                <p className="text-gray-400 text-sm">No past bookings.</p>
              ) : (
                <ul className="space-y-3">
                  {past.map((b) => {
                    const court = courts[b.courtId];
                    return (
                      <li
                        key={b.id}
                        className="bg-gray-50 rounded-xl p-4 shadow flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100 opacity-70"
                      >
                        <div className="flex-1">
                          <div className="text-gray-900 font-semibold text-sm">
                            {b.date} at {b.time} ({b.duration}h)
                          </div>
                          <div className="text-xs text-gray-500">
                            Court: {court ? court.name : b.courtId} (
                            {court ? court.location : ""})
                          </div>
                          <div className="text-xs text-gray-500">
                            Status: {b.status}
                          </div>
                        </div>
                        {court?.imageUrl && (
                          <div className="flex-shrink-0">
                            <img
                              src={court.imageUrl}
                              alt={court.name}
                              className="w-16 h-16 object-cover rounded-lg shadow-sm opacity-70"
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
