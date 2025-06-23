"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";

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
        <div className="flex justify-center">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
            disabled
          >
            Book This Court (Coming Soon)
          </button>
        </div>
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
