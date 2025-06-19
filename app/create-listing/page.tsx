"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "@/src/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function CreateListingPage() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!name || !location || !price || !description || !image) {
      setError("Please fill in all fields and upload an image.");
      return;
    }
    setLoading(true);
    try {
      // 1. Upload image to Firebase Storage
      const imageRef = ref(storage, `courts/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);
      const imageUrl = await getDownloadURL(imageRef);
      // 2. Add court data to Firestore
      await addDoc(collection(db, "courts"), {
        name,
        location,
        price: Number(price),
        description,
        imageUrl,
        createdAt: Timestamp.now(),
      });
      setSuccess(true);
      setName("");
      setLocation("");
      setPrice("");
      setDescription("");
      setImage(null);
      // Optionally redirect or show success
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-300 via-lime-200 to-green-100 px-4">
      <div className="w-full max-w-lg my-12">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-6 animate-fade-in"
        >
          <div className="flex flex-col items-center mb-2">
            <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mb-2 shadow-md">
              <span className="text-3xl font-bold text-green-700">🎾</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight mb-1">
              Create Court Listing
            </h2>
            <p className="text-gray-500 text-sm">
              Fill in your court details below
            </p>
          </div>
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="text"
            placeholder="Court Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="number"
            placeholder="Price per hour (USD)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={0}
            required
          />
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900 resize-none"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 transition mb-2 text-gray-900 caret-gray-900 file:bg-green-100 file:border-0 file:rounded-lg file:px-4 file:py-2 file:text-green-700 file:font-semibold"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            required
          />
          {error && (
            <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
          )}
          {success && (
            <p className="text-green-600 text-sm mb-2 text-center">
              Court listed successfully!
            </p>
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
                Creating listing...
              </span>
            ) : (
              "Create Listing"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
