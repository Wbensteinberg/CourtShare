"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";

export default function CreateListingPage() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!name || !location || !address || !price || !description || images.length === 0) {
      setError("Please fill in all fields and upload at least one image.");
      return;
    }
    if (!user) {
      setError("You must be logged in to create a listing.");
      return;
    }
    setLoading(true);
    try {
      // 1. Upload all images to Firebase Storage
      const storage = getStorageInstance();
      const imageUrls: string[] = [];
      
      for (const image of images) {
        const imageRef = ref(storage, `courts/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        const imageUrl = await getDownloadURL(imageRef);
        imageUrls.push(imageUrl);
      }
      
      // 2. Add court data to Firestore, including ownerId
      await addDoc(collection(db, "courts"), {
        name,
        location,
        address,
        accessInstructions,
        price: Number(price),
        description,
        imageUrl: imageUrls[0], // Keep first image as main image for compatibility
        imageUrls: imageUrls, // Store all image URLs
        createdAt: Timestamp.now(),
        ownerId: user.uid,
      });
      setSuccess(true);
      setName("");
      setLocation("");
      setAddress("");
      setAccessInstructions("");
      setPrice("");
      setDescription("");
      setImages([]);
      // Optionally redirect or show success
      router.push("/dashboard/owner");
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
      <div className="w-full max-w-lg my-12">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-6 animate-fade-in"
        >
          <div className="flex flex-col items-center mb-2">
            <div className="w-16 h-16 bg-[#e3f1e7] rounded-full flex items-center justify-center mb-2 shadow-md">
              <span className="text-3xl font-bold text-[#286a3a]">🎾</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight mb-1">
              Create Court Listing
            </h2>
            <p className="text-gray-500 text-sm">
              Fill in your court details below
            </p>
          </div>
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="text"
            placeholder="Court Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="text"
            placeholder="Full Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900 resize-none"
            placeholder="Access Instructions (e.g., gate code, building access, parking info)"
            value={accessInstructions}
            onChange={(e) => setAccessInstructions(e.target.value)}
            rows={3}
          />
          <input
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
            type="number"
            placeholder="Price per hour (USD)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={0}
            required
          />
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900 resize-none"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {images.length === 0 ? "Upload Images" : `Add More Images (${images.length} selected)`}
            </label>
            <input
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 text-gray-900 caret-gray-900 file:bg-[#e3f1e7] file:border-0 file:rounded-lg file:px-4 file:py-2 file:text-[#286a3a] file:font-semibold"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              required={images.length === 0}
            />
          </div>
          {images.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Selected images ({images.length}):</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
          )}
          {success && (
            <p className="text-green-600 text-sm mb-2 text-center">
              Court listed successfully!
            </p>
          )}
          <button
            className="w-full bg-[#286a3a] text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-[#20542e] focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition disabled:opacity-60 disabled:cursor-not-allowed"
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
