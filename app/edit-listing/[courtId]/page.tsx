"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";

interface Court {
  id: string;
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  ownerId: string;
}

export default function EditListingPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!courtId || !user) return;
    
    const fetchCourt = async () => {
      setLoading(true);
      setError("");
      
      try {
        const courtRef = doc(db, "courts", courtId as string);
        const courtSnap = await getDoc(courtRef);
        
        if (!courtSnap.exists()) {
          setError("Court not found");
          setLoading(false);
          return;
        }
        
        const courtData = { id: courtSnap.id, ...courtSnap.data() } as Court;
        
        // Check if this court belongs to the current user
        if (courtData.ownerId !== user.uid) {
          setError("You don't have permission to edit this court");
          setLoading(false);
          return;
        }
        
        setCourt(courtData);
        
        // Populate form fields
        setName(courtData.name);
        setLocation(courtData.location);
        setAddress(courtData.address || "");
        setAccessInstructions(courtData.accessInstructions || "");
        setPrice(courtData.price.toString());
        setDescription(courtData.description);
        setExistingImages(courtData.imageUrls || [courtData.imageUrl]);
        // Set the main image index to 0 (first image) by default
        setMainImageIndex(0);
        
      } catch (err: any) {
        setError(err.message || "Failed to fetch court details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourt();
  }, [courtId, user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeImage = (index: number) => {
    const newImageIndex = existingImages.length + index;
    setImages(images.filter((_, i) => i !== index));
    
    // Adjust main image index if the removed image was the main image or before it
    if (newImageIndex <= mainImageIndex) {
      setMainImageIndex(Math.max(0, mainImageIndex - 1));
    }
  };

  const removeExistingImage = (imageUrl: string) => {
    const imageIndex = existingImages.indexOf(imageUrl);
    setExistingImages(existingImages.filter(img => img !== imageUrl));
    setRemovedImages([...removedImages, imageUrl]);
    
    // Adjust main image index if the removed image was the main image or before it
    if (imageIndex <= mainImageIndex) {
      setMainImageIndex(Math.max(0, mainImageIndex - 1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    if (!name || !location || !address || !price || !description) {
      setError("Please fill in all required fields.");
      return;
    }
    
    if (!user || !court) {
      setError("You must be logged in to edit a listing.");
      return;
    }
    
    setSaving(true);
    
    try {
      const storage = getStorageInstance();
      const newImageUrls: string[] = [];
      
      // Upload new images
      for (const image of images) {
        const imageRef = ref(storage, `courts/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        const imageUrl = await getDownloadURL(imageRef);
        newImageUrls.push(imageUrl);
      }
      
      // Combine existing images (not removed) with new images
      const finalImageUrls = [...existingImages.filter(img => !removedImages.includes(img)), ...newImageUrls];
      
      if (finalImageUrls.length === 0) {
        setError("At least one image is required.");
        return;
      }
      
      // Use the selected main image
      const mainImageUrl = finalImageUrls[mainImageIndex] || finalImageUrls[0];
      
      // Update court data in Firestore
      await updateDoc(doc(db, "courts", courtId as string), {
        name,
        location,
        address,
        accessInstructions,
        price: Number(price),
        description,
        imageUrl: mainImageUrl, // Use selected main image
        imageUrls: finalImageUrls,
      });
      
      setSuccess(true);
      
      // Redirect to owner dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard/owner");
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || "Failed to update listing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading court details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-auto text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard/owner")}
            className="bg-[#286a3a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 mx-auto text-center">
          <div className="text-6xl mb-4">❓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Court Not Found</h2>
          <p className="text-gray-600 mb-6">The court you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push("/dashboard/owner")}
            className="bg-[#286a3a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
      <div className="w-full max-w-lg my-12">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-6 animate-fade-in"
        >
          <div className="flex flex-col items-center mb-2">
            <div className="w-16 h-16 bg-[#e3f1e7] rounded-full flex items-center justify-center mb-2 shadow-md">
              <span className="text-3xl font-bold text-[#286a3a]">✏️</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight mb-1">
              Edit Court Listing
            </h2>
            <p className="text-gray-500 text-sm">
              Update your court details below
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
          
          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Images ({existingImages.length})
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Click "Set as Main" to choose which photo appears first in your listing
              </p>
              <div className="grid grid-cols-2 gap-2">
                {existingImages.map((imageUrl, index) => (
                  <div key={index} className="relative">
                    <img
                      src={imageUrl}
                      alt={`Current ${index + 1}`}
                      className={`w-full h-24 object-cover rounded-lg ${mainImageIndex === index ? 'ring-2 ring-[#286a3a]' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(imageUrl)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                    {mainImageIndex === index && (
                      <div className="absolute -top-2 -left-2 bg-[#286a3a] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                        ★
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setMainImageIndex(index)}
                      className={`absolute bottom-1 left-1 px-2 py-1 rounded text-xs font-medium transition ${
                        mainImageIndex === index 
                          ? 'bg-[#286a3a] text-white' 
                          : 'bg-white/90 text-gray-700 hover:bg-[#286a3a] hover:text-white'
                      }`}
                    >
                      {mainImageIndex === index ? 'Main Photo' : 'Set as Main'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* New Images */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {images.length === 0 ? "Add New Images" : `Add More Images (${images.length} selected)`}
            </label>
            <input
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 text-gray-900 caret-gray-900 file:bg-[#e3f1e7] file:border-0 file:rounded-lg file:px-4 file:py-2 file:text-[#286a3a] file:font-semibold"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
            />
          </div>
          
          {images.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">New images ({images.length}):</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => {
                  const newImageIndex = existingImages.length + index;
                  return (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`New ${index + 1}`}
                        className={`w-full h-24 object-cover rounded-lg ${mainImageIndex === newImageIndex ? 'ring-2 ring-[#286a3a]' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                      {mainImageIndex === newImageIndex && (
                        <div className="absolute -top-2 -left-2 bg-[#286a3a] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                          ★
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setMainImageIndex(newImageIndex)}
                        className={`absolute bottom-1 left-1 px-2 py-1 rounded text-xs font-medium transition ${
                          mainImageIndex === newImageIndex 
                            ? 'bg-[#286a3a] text-white' 
                            : 'bg-white/90 text-gray-700 hover:bg-[#286a3a] hover:text-white'
                        }`}
                      >
                        {mainImageIndex === newImageIndex ? 'Main Photo' : 'Set as Main'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {error && (
            <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
          )}
          
          {success && (
            <p className="text-green-600 text-sm mb-2 text-center">
              Court updated successfully! Redirecting to dashboard...
            </p>
          )}
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard/owner")}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition hover:cursor-pointer"
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-[#286a3a] text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-[#20542e] focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition disabled:opacity-60 disabled:cursor-not-allowed hover:cursor-pointer"
              type="submit"
              disabled={saving}
            >
              {saving ? (
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
                  Updating...
                </span>
              ) : (
                "Update Listing"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 