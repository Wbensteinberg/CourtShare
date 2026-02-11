"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Calendar as CalendarIcon, Clock, Trophy, Edit3, Trash2, Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import AppHeader from "@/components/AppHeader";
import AddressAutocomplete from "@/components/AddressAutocomplete";

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
  blockedDates?: string[]; // Array of date strings in YYYY-MM-DD format
  blockedTimes?: { [date: string]: string[] }; // Object with date as key and array of time strings as value
  maxAdvanceBookingDays?: number | null; // e.g. 30 = only available one month in advance
  alwaysBlockedTimes?: string[]; // Times always blocked every day (24h format)
  alwaysBlockedTimesByDay?: { [dayOfWeek: number]: string[] }; // 0=Sun, 1=Mon, etc.
}

interface CourtFormData {
  courtName: string;
  location: string;
  fullAddress: string;
  accessInstructions: string;
  pricePerHour: string;
  description: string;
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
  
  // Default blocked settings
  const [maxAdvanceBookingDays, setMaxAdvanceBookingDays] = useState<number | null>(null);
  const [alwaysBlockedTimes, setAlwaysBlockedTimes] = useState<string[]>([]);
  const [alwaysBlockedTimesByDay, setAlwaysBlockedTimesByDay] = useState<{ [dayOfWeek: number]: string[] }>({});
  
  // New state for the beautiful UI
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingListing, setDeletingListing] = useState(false);
  
  const router = useRouter();
  const { user } = useAuth();

  const form = useForm<CourtFormData>({
    defaultValues: {
      courtName: "",
      location: "",
      fullAddress: "",
      accessInstructions: "",
      pricePerHour: "",
      description: ""
    }
  });

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
        
        // Load availability data
        setMaxAdvanceBookingDays(courtData.maxAdvanceBookingDays ?? null);
        setAlwaysBlockedTimes(courtData.alwaysBlockedTimes || []);
        setAlwaysBlockedTimesByDay(courtData.alwaysBlockedTimesByDay || {});
        
        // Update form default values
        form.setValue("courtName", courtData.name);
        form.setValue("location", courtData.location);
        form.setValue("fullAddress", courtData.address || "");
        form.setValue("accessInstructions", courtData.accessInstructions || "");
        form.setValue("pricePerHour", courtData.price.toString());
        form.setValue("description", courtData.description);
        
      } catch (err: any) {
        setError(err.message || "Failed to fetch court details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourt();
  }, [courtId, user, form]);

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

  // New file handling functions for the beautiful UI
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteListing = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your listing? This cannot be undone."
      )
    )
      return;
    if (!courtId) return;
    setDeletingListing(true);
    try {
      await deleteDoc(doc(db, "courts", courtId));
      router.push("/dashboard/owner");
    } catch (err: any) {
      setError(err.message || "Failed to delete listing");
    } finally {
      setDeletingListing(false);
    }
  };

  const timeSlots = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  const DAYS_OF_WEEK = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  const toggleAlwaysBlockedTime = (time: string) => {
    setAlwaysBlockedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort()
    );
  };

  const toggleAlwaysBlockedTimeForDay = (dayOfWeek: number, time: string) => {
    setAlwaysBlockedTimesByDay(prev => {
      const dayTimes = prev[dayOfWeek] || [];
      const newDayTimes = dayTimes.includes(time)
        ? dayTimes.filter(t => t !== time)
        : [...dayTimes, time].sort();
      const next = { ...prev };
      if (newDayTimes.length === 0) {
        delete next[dayOfWeek];
      } else {
        next[dayOfWeek] = newDayTimes;
      }
      return next;
    });
  };

  const onSubmit = async (data: CourtFormData) => {
    setError("");
    setSuccess(false);
    
    if (!data.courtName || !data.location || !data.fullAddress || !data.pricePerHour || !data.description) {
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
        name: data.courtName,
        location: data.location,
        address: data.fullAddress,
        accessInstructions: data.accessInstructions,
        price: Number(data.pricePerHour),
        description: data.description,
        imageUrl: mainImageUrl, // Use selected main image
        imageUrls: finalImageUrls,
        maxAdvanceBookingDays: maxAdvanceBookingDays ?? null,
        alwaysBlockedTimes,
        alwaysBlockedTimesByDay,
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
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      {/* Hero Section with Background - Same as create listing */}
      <section className="relative py-24 bg-gradient-tennis overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div
            className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center text-white">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center shadow-glow">
                <Edit3 className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
              Edit Court Listing
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">
              Update your court details below to keep your listing current
            </p>
          </div>
        </div>
      </section>

      {/* Main Content - Modernized */}
      <section className="py-12 -mt-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-elegant border-0 rounded-3xl glass backdrop-blur-xl mt-8">
              <CardHeader className="space-y-2 pb-10 pt-10">
                <CardTitle className="text-3xl md:text-4xl font-black text-center tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Court Details
                </CardTitle>
                <CardDescription className="text-center text-gray-600 font-medium text-lg">
                  Please update the information about your tennis court
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="courtName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Court Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter court name" 
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Location</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="City, State" 
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="fullAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressAutocomplete
                              value={field.value}
                              onChange={(address, coordinates) => {
                                field.onChange(address);
                                // Auto-populate coordinates if available
                                if (coordinates) {
                                  // Note: Edit listing page doesn't have latitude/longitude fields yet
                                  // This would need to be added to the form if coordinates are needed
                                  console.log('Coordinates:', coordinates);
                                }
                              }}
                              placeholder="Complete street address"
                              className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                              label="Full Address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accessInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Access Instructions</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Gate code, building access, parking info..."
                              className="min-h-[100px] border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 resize-none"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="pricePerHour"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Price per Hour (USD)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="25.00" 
                                type="number"
                                step="0.01"
                                className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your court's features, amenities, surface type..."
                              className="min-h-[120px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200 resize-none"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Existing Images */}
                    {existingImages.length > 0 && (
                      <div className="space-y-4">
                        <FormLabel className="text-sm font-semibold">Current Images ({existingImages.length})</FormLabel>
                        <p className="text-xs text-gray-500">
                          Click "Set as Main" to choose which photo appears first in your listing
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {existingImages.map((imageUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Current ${index + 1}`}
                                className={`w-full h-24 object-cover rounded-lg border border-gray-200 ${mainImageIndex === index ? 'ring-2 ring-emerald-600' : ''}`}
                              />
                              <button
                                type="button"
                                onClick={() => removeExistingImage(imageUrl)}
                                className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                ×
                              </button>
                              {mainImageIndex === index && (
                                <div className="absolute -top-2 -left-2 bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                  ★
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setMainImageIndex(index)}
                                className={`absolute bottom-1 left-1 px-2 py-1 rounded text-xs font-medium transition ${
                                  mainImageIndex === index 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-white/90 text-gray-700 hover:bg-emerald-600 hover:text-white'
                                }`}
                              >
                                {mainImageIndex === index ? 'Main Photo' : 'Set as Main'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Image Upload Section */}
                    <div className="space-y-4">
                      <FormLabel className="text-sm font-semibold">Upload New Images</FormLabel>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <div className="space-y-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="border-emerald-500/20 hover:bg-emerald-50 text-emerald-700 hover:border-emerald-500 cursor-pointer"
                            onClick={triggerFileInput}
                          >
                            Choose Files
                          </Button>
                          <p className="text-sm text-gray-500">
                            {images.length === 0 ? "No new files chosen" : `${images.length} new file(s) selected`}
                          </p>
                        </div>
                      </div>
                      
                      {/* Display new images */}
                      {images.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-700">New Images ({images.length}):</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {images.map((image, index) => {
                              const newImageIndex = existingImages.length + index;
                              return (
                                <div key={index} className="relative group">
                                  <img
                                    src={URL.createObjectURL(image)}
                                    alt={`New ${index + 1}`}
                                    className={`w-full h-24 object-cover rounded-lg border border-gray-200 ${mainImageIndex === newImageIndex ? 'ring-2 ring-green-600' : ''}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    ×
                                  </button>
                                  {mainImageIndex === newImageIndex && (
                                    <div className="absolute -top-2 -left-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                      ★
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setMainImageIndex(newImageIndex)}
                                    className={`absolute bottom-1 left-1 px-2 py-1 rounded text-xs font-medium transition ${
                                      mainImageIndex === newImageIndex 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-white/90 text-gray-700 hover:bg-green-600 hover:text-white'
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
                    </div>

                    {/* Simple Div Separator */}
                    <div className="my-8 border-t border-gray-200"></div>

                    {/* Availability Management */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Availability Management</h3>
                        <p className="text-sm text-gray-600">
                          Manage when your court is available for booking
                        </p>
                      </div>

                      {/* Default Blocked Settings */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            Default Blocked Settings
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            Set booking availability rules that apply to all dates
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <FormLabel className="text-sm">How far in advance can guests book?</FormLabel>
                            <Select
                              value={maxAdvanceBookingDays === null ? "unlimited" : String(maxAdvanceBookingDays)}
                              onValueChange={(v) => setMaxAdvanceBookingDays(v === "unlimited" ? null : parseInt(v, 10))}
                            >
                              <SelectTrigger className="h-12 mt-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300">
                                <SelectValue placeholder="Select booking window" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-xl">
                                <SelectItem
                                  value="unlimited"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  No limit
                                </SelectItem>
                                <SelectItem
                                  value="7"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  1 week in advance
                                </SelectItem>
                                <SelectItem
                                  value="14"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  2 weeks in advance
                                </SelectItem>
                                <SelectItem
                                  value="30"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  1 month in advance
                                </SelectItem>
                                <SelectItem
                                  value="60"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  2 months in advance
                                </SelectItem>
                                <SelectItem
                                  value="90"
                                  className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800"
                                >
                                  3 months in advance
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Always Blocked Times (every day) */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Always Blocked Times
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            Select times that are always blocked on every day
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-gray-600">Click to toggle. Selected times are blocked every day.</p>
                          <div className="flex flex-wrap gap-2">
                            {timeSlots.map((time) => {
                              const hour = parseInt(time.split(":")[0], 10);
                              const display = hour < 12 ? `${hour === 0 ? 12 : hour}:00 AM` : `${hour === 12 ? 12 : hour - 12}:00 PM`;
                              const isBlocked = alwaysBlockedTimes.includes(time);
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => toggleAlwaysBlockedTime(time)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                                    isBlocked
                                      ? "bg-red-100 text-red-800 border-2 border-red-300"
                                      : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                                  }`}
                                >
                                  {display}
                                </button>
                              );
                            })}
                          </div>
                          {alwaysBlockedTimes.length > 0 && (
                            <p className="text-sm text-red-600">
                              {alwaysBlockedTimes.length} time(s) always blocked
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Always Blocked on Specific Day */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Always Blocked on Specific Day
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            Set times that are blocked every week on a specific day (e.g. “9 AM blocked every Monday”)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => (
                            <div key={dayOfWeek} className="space-y-2">
                              <FormLabel className="text-sm font-medium">{label}</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {timeSlots.map((time) => {
                                  const hour = parseInt(time.split(":")[0], 10);
                                  const display = hour < 12 ? `${hour === 0 ? 12 : hour}:00 AM` : `${hour === 12 ? 12 : hour - 12}:00 PM`;
                                  const isBlocked = (alwaysBlockedTimesByDay[dayOfWeek] || []).includes(time);
                                  return (
                                    <button
                                      key={time}
                                      type="button"
                                      onClick={() => toggleAlwaysBlockedTimeForDay(dayOfWeek, time)}
                                      className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                                        isBlocked
                                          ? "bg-orange-100 text-orange-800 border border-orange-300"
                                          : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                                      }`}
                                    >
                                      {display}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Error and Success Messages */}
                    {error && (
                      <p className="text-red-500 text-sm text-center">{error}</p>
                    )}
                    
                    {success && (
                      <p className="text-emerald-600 text-sm text-center font-medium">
                        Court updated successfully! Redirecting to dashboard...
                      </p>
                    )}

                    {/* Submit Buttons */}
                    <div className="pt-6 flex flex-col gap-4">
                      <div className="flex gap-4">
                        <Button 
                          type="button"
                          onClick={() => router.push("/dashboard/owner")}
                          className="flex-1 h-14 text-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          Back
                        </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 h-14 text-lg font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02]"
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
                      </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDeleteListing}
                        disabled={deletingListing}
                        className="h-12 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                      >
                        {deletingListing ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Deleting...
                          </span>
                        ) : (
                          <><Trash2 className="h-4 w-4 mr-2 inline" /> Delete Listing</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Dark Gray Footer Section - Same as /courts page */}
      <div className="w-full bg-slate-900 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-sm">
            © 2025 CourtShare. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}