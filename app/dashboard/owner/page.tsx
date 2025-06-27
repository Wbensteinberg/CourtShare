"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/src/lib/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/src/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import Image from "next/image";

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [deletingCourtId, setDeletingCourtId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    const fetchData = async () => {
      try {
        // Fetch courts owned by this user (assuming you store ownerId on court)
        const courtsSnap = await getDocs(
          query(collection(db, "courts"), where("ownerId", "==", user.uid))
        );
        const courtsData: Court[] = courtsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Court[];
        setCourts(courtsData);
        // Fetch bookings for these courts
        const courtIds = courtsData.map((c) => c.id);
        let bookingsData: Booking[] = [];
        if (courtIds.length > 0) {
          const bookingsSnap = await getDocs(
            query(collection(db, "bookings"), where("courtId", "in", courtIds))
          );
          bookingsData = bookingsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Booking[];
        }
        setBookings(bookingsData);
      } catch (err: any) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleDelete = async (courtId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this court? This cannot be undone."
      )
    )
      return;
    setDeletingCourtId(courtId);
    try {
      await deleteDoc(doc(db, "courts", courtId));
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    } catch (err: any) {
      alert(err.message || "Failed to delete court");
    } finally {
      setDeletingCourtId(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100 px-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-8 animate-fade-in my-16">
        <h1 className="text-3xl font-extrabold text-green-800 mb-2 text-center">
          Owner Dashboard
        </h1>
        <p className="text-gray-600 text-center mb-2">
          Welcome! Here are your courts and bookings.
        </p>
        <div className="flex justify-center mb-4">
          <button
            className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold text-sm shadow hover:bg-green-200 transition"
            onClick={() => router.push("/create-listing")}
          >
            + Add New Court
          </button>
        </div>
        {loading ? (
          <p className="text-center text-gray-500">
            Loading courts and bookings...
          </p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : courts.length === 0 ? (
          <p className="text-center text-gray-500">
            You have no courts listed yet.
          </p>
        ) : (
          <div className="space-y-8">
            {courts.map((court) => (
              <div
                key={court.id}
                className="bg-green-50 rounded-2xl p-6 shadow border border-green-100"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-20 h-20 relative rounded-xl overflow-hidden shadow">
                    {court.imageUrl ? (
                      <Image
                        src={court.imageUrl}
                        alt={court.name}
                        fill
                        className="object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-xl">
                        <span className="text-4xl">🎾</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-900">
                      {court.name}
                    </div>
                    <div className="text-gray-600 text-sm">
                      {court.location}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <button
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold text-xs shadow hover:bg-blue-200 transition"
                      onClick={() => router.push(`/edit-listing/${court.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-100 text-red-700 px-3 py-1 rounded font-semibold text-xs shadow hover:bg-red-200 transition disabled:opacity-60"
                      onClick={() => handleDelete(court.id)}
                      disabled={deletingCourtId === court.id}
                    >
                      {deletingCourtId === court.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-md font-semibold text-green-700 mb-2">
                    Bookings
                  </h3>
                  {bookings.filter((b) => b.courtId === court.id).length ===
                  0 ? (
                    <p className="text-gray-400 text-sm">
                      No bookings for this court yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {bookings
                        .filter((b) => b.courtId === court.id)
                        .sort((a, b) =>
                          (a.date + a.time).localeCompare(b.date + b.time)
                        )
                        .map((b) => (
                          <li
                            key={b.id}
                            className="bg-white rounded-lg p-3 shadow border border-green-50 flex flex-col sm:flex-row sm:items-center gap-2"
                          >
                            <div className="flex-1">
                              <div className="text-green-900 font-semibold text-sm">
                                {b.date} at {b.time} ({b.duration}h)
                              </div>
                              <div className="text-xs text-gray-500">
                                Status: {b.status}
                              </div>
                              <div className="text-xs text-gray-500">
                                User: {b.userId}
                              </div>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
