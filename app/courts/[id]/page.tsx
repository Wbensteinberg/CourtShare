"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
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
import { useAuth } from "@/lib/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";

interface Court {
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
}

export default function CourtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, isOwner } = useAuth();

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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  const handleCheckout = async () => {
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
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: id,
          userId: user.uid,
          date: date instanceof Date ? date.toISOString().slice(0, 10) : date,
          time,
          duration,
          price: court?.price || 0,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setBookingStatus("error");
        alert("Failed to start checkout: " + data.error);
      }
    } catch (err) {
      setBookingStatus("error");
      alert("Failed to start checkout");
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
    <div className="min-h-screen bg-[#286a3a] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 mx-auto">
        <div className="w-full h-72 relative mb-6 rounded-2xl overflow-hidden shadow-md">
          {court.imageUrl ? (
            <>
              <Image
                src={court.imageUrls && court.imageUrls.length > 0 ? court.imageUrls[currentImageIndex] : court.imageUrl}
                alt={court.name}
                fill
                className="object-cover rounded-2xl"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
              {court.imageUrls && court.imageUrls.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : court.imageUrls!.length - 1)}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 transition"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev < court.imageUrls!.length - 1 ? prev + 1 : 0)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 transition"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                    {court.imageUrls.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-2xl">
              <span className="text-6xl">🎾</span>
            </div>
          )}
        </div>
        <h2 className="text-3xl font-extrabold text-[#286a3a] mb-2 text-center drop-shadow-sm">
          {court.name}
        </h2>
        <p className="text-gray-600 text-center mb-1 text-lg">
          {court.location}
        </p>
        <p className="text-[#286a3a] font-bold text-center text-xl mb-4">
          ${court.price} <span className="font-medium">/ hour</span>
        </p>
        <p className="text-gray-700 text-base mb-6 text-center whitespace-pre-line">
          {court.description}
        </p>
        {court.address && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[#286a3a] mb-2 text-center">
              Address
            </h3>
            <p className="text-gray-700 text-base text-center">
              {court.address}
            </p>
          </div>
        )}
        {court.accessInstructions && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#286a3a] mb-2 text-center">
              Access Instructions
            </h3>
            <p className="text-gray-700 text-base text-center whitespace-pre-line">
              {court.accessInstructions}
            </p>
          </div>
        )}
        {/* Booking UI */}
        {user && isOwner ? (
          <div className="bg-white p-6 rounded-2xl shadow-md max-w-md mx-auto mt-4 mb-8 space-y-4 border border-[#e3f1e7]">
            <h3 className="text-xl font-bold text-[#286a3a] mb-2 text-center">
              Owner Mode Active
            </h3>
            <p className="text-gray-600 text-center mb-4">
              You're currently in owner mode. Switch to player mode to book courts.
            </p>
            <button
              className="w-full bg-[#286a3a] text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-[#20542e] focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition"
              onClick={() => router.push("/dashboard/owner")}
            >
              Go to Owner Dashboard
            </button>
          </div>
        ) : user && !isOwner ? (
          <div className="bg-white p-6 rounded-2xl shadow-md max-w-md mx-auto mt-4 mb-8 space-y-4 border border-[#e3f1e7]">
            <h3 className="text-xl font-bold text-[#286a3a] mb-2 text-center">
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
              className="w-full bg-[#286a3a] text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-[#20542e] focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              onClick={handleCheckout}
              disabled={bookingStatus === "loading" || fetchingBookings}
            >
              {bookingStatus === "loading" ? "Processing..." : "Book & Pay"}
            </button>
            {bookingStatus === "conflict" && (
              <p className="text-red-500 text-sm mt-2 text-center">
                This time slot is already booked. Please choose another.
              </p>
            )}
            {bookingStatus === "error" && (
              <p className="text-red-500 text-sm mt-2 text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center mt-8 mb-8">
            <p className="text-center text-gray-500 mb-4">
              Log in to book this court.
            </p>
            <button
              className="bg-[#286a3a] text-white py-2 px-6 rounded-lg font-semibold text-lg shadow-md hover:bg-[#20542e] focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => router.push(`/login?redirect=/courts/${id}`)}
            >
              Log In to Book
            </button>
          </div>
        )}
        <div className="flex justify-center mt-6">
          <button
            className="text-[#286a3a] hover:underline text-sm font-semibold"
            onClick={() => router.back()}
          >
            ← Back to Browse
          </button>
        </div>
      </div>
    </div>
  );
}
