"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/src/lib/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";

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
  const [date, setDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "loading" | "success" | "error" | "conflict"
  >("idle");
  const [bookingsForDate, setBookingsForDate] = useState<any[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);

  // Compute all blocked times for the selected date
  const blockedTimes = new Set<string>();
  bookingsForDate.forEach((b) => {
    const startHour = parseInt((b.time || "").split(":")[0], 10);
    const dur = Number(b.duration) || 1;
    for (let i = 0; i < dur; i++) {
      const hour = startHour + i;
      if (hour >= 8 && hour <= 20) {
        blockedTimes.add(hour.toString().padStart(2, "0") + ":00");
      }
    }
  });

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

  // Fetch bookings for selected date
  useEffect(() => {
    if (!id || !date) {
      setBookingsForDate([]);
      return;
    }
    setFetchingBookings(true);
    const fetchBookings = async () => {
      try {
        const q = query(
          collection(db, "bookings"),
          where("courtId", "==", id),
          where(
            "date",
            "==",
            date instanceof Date ? date.toISOString().slice(0, 10) : date
          )
        );
        const snap = await getDocs(q);
        setBookingsForDate(snap.docs.map((doc) => doc.data()));
      } catch (e) {
        setBookingsForDate([]);
      } finally {
        setFetchingBookings(false);
      }
    };
    fetchBookings();
  }, [id, date]);

  const handleBooking = async () => {
    if (!user) return;
    if (!date || !time || !duration) {
      alert("Please fill out all fields.");
      return;
    }
    // Prevent double booking
    if (bookingsForDate.some((b) => b.time === time)) {
      setBookingStatus("conflict");
      return;
    }
    setBookingStatus("loading");
    try {
      await addDoc(collection(db, "bookings"), {
        userId: user.uid,
        courtId: id,
        date: date instanceof Date ? date.toISOString().slice(0, 10) : date,
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
              <span className="text-gray-600 font-semibold">Date</span>
              <DatePicker
                selected={date}
                onChange={(d) => {
                  setDate(d);
                }}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select date"
                className={`mt-1 block w-full rounded border-gray-300 placeholder:text-gray-400 ${
                  date ? "text-gray-800" : "text-gray-400"
                } py-2 px-3`}
                minDate={new Date()}
                wrapperClassName="w-full"
                popperPlacement="bottom"
                calendarClassName="cs-datepicker-calendar"
                dayClassName={(d) => {
                  const today = new Date();
                  const isToday =
                    d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
                  return [
                    "cs-datepicker-day",
                    isToday ? "cs-datepicker-today" : "",
                  ].join(" ");
                }}
                showPopperArrow={false}
              />
            </label>
            {/* Booked slots section */}
            {date && blockedTimes.size > 0 && (
              <div className="text-sm text-gray-500 mb-2">
                <span className="font-semibold text-gray-700">
                  Booked slots:
                </span>
                <span className="ml-2">
                  {[...blockedTimes]
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((t) => (
                      <span
                        key={t}
                        className="inline-block bg-red-100 text-red-700 rounded px-2 py-0.5 mr-1 mb-1 text-xs font-semibold"
                      >
                        {t}
                      </span>
                    ))}
                </span>
              </div>
            )}
            <label className="block">
              <span className="text-gray-600 font-semibold">Time</span>
              <select
                className={`mt-1 block w-full rounded border-gray-300 ${
                  time ? "text-gray-800" : "text-gray-400"
                }`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              >
                <option value="" disabled className="text-gray-400">
                  Select time
                </option>
                {[...Array(13)].map((_, i) => {
                  const hour = 8 + i;
                  const label = hour.toString().padStart(2, "0") + ":00";
                  // Disable if booked or (if today) in the past
                  const isBooked = blockedTimes.has(label);
                  let isPast = false;
                  if (date) {
                    const today = new Date();
                    const selectedDate = new Date(date);
                    if (selectedDate.toDateString() === today.toDateString()) {
                      const nowHour = today.getHours();
                      isPast = hour <= nowHour;
                    }
                  }
                  return (
                    <option
                      key={label}
                      value={label}
                      className={
                        isBooked
                          ? "text-red-400 bg-red-50"
                          : isPast
                          ? "text-gray-400"
                          : "text-gray-800"
                      }
                      disabled={isBooked || isPast}
                    >
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <span className="text-gray-600 font-semibold">
                Duration (hours)
              </span>
              <select
                value={duration || ""}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`mt-1 block w-full rounded border-gray-300 ${
                  duration ? "text-gray-800" : "text-gray-400"
                }`}
              >
                <option value="" disabled className="text-gray-400">
                  Select duration
                </option>
                {[1, 2, 3].map((d) => (
                  <option key={d} value={d} className="text-gray-800">
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
            {bookingStatus === "conflict" && (
              <p className="text-red-600 text-center">
                That time slot is already booked. Please choose another.
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
