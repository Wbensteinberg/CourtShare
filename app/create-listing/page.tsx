"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Calendar as CalendarIcon, Clock, Trophy, Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import AppHeader from "@/components/AppHeader";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface CourtFormData {
  courtName: string;
  location: string;
  fullAddress: string;
  accessInstructions: string;
  pricePerHour: string;
  description: string;
  latitude: string;
  longitude: string;
}

const CreateListing = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Number of bookable courts
  const [numberOfCourts, setNumberOfCourts] = useState<number>(1);

  // Availability settings (applies to all courts)
  const [maxAdvanceBookingDays, setMaxAdvanceBookingDays] = useState<number | null>(null);
  const [alwaysBlockedTimes, setAlwaysBlockedTimes] = useState<string[]>([]);
  const [alwaysBlockedTimesByDay, setAlwaysBlockedTimesByDay] = useState<{ [dayOfWeek: number]: string[] }>({});

  // Per-court availability overrides (only used when numberOfCourts > 1)
  const [courtSpecificAlwaysBlockedTimes, setCourtSpecificAlwaysBlockedTimes] = useState<{ [courtNum: string]: string[] }>({});
  const [courtSpecificAlwaysBlockedTimesByDay, setCourtSpecificAlwaysBlockedTimesByDay] = useState<{ [courtNum: string]: { [dayOfWeek: string]: string[] } }>({});

  // Expanded per-court sections
  const [expandedCourt, setExpandedCourt] = useState<number | null>(null);

  const form = useForm<CourtFormData>({
    defaultValues: {
      courtName: "",
      location: "",
      fullAddress: "",
      accessInstructions: "",
      pricePerHour: "",
      description: "",
      latitude: "",
      longitude: "",
    },
  });

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

  const formatTimeDisplay = (time: string): string => {
    const hour = parseInt(time.split(":")[0], 10);
    return hour < 12 ? `${hour === 0 ? 12 : hour}:00 AM` : `${hour === 12 ? 12 : hour - 12}:00 PM`;
  };

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

  const toggleCourtSpecificTime = (courtNum: number, time: string) => {
    const key = String(courtNum);
    setCourtSpecificAlwaysBlockedTimes(prev => {
      const times = prev[key] || [];
      const newTimes = times.includes(time)
        ? times.filter(t => t !== time)
        : [...times, time].sort();
      return { ...prev, [key]: newTimes };
    });
  };

  const toggleCourtSpecificTimeForDay = (courtNum: number, dayOfWeek: number, time: string) => {
    const courtKey = String(courtNum);
    const dayKey = String(dayOfWeek);
    setCourtSpecificAlwaysBlockedTimesByDay(prev => {
      const courtData = prev[courtKey] || {};
      const dayTimes = courtData[dayKey] || [];
      const newDayTimes = dayTimes.includes(time)
        ? dayTimes.filter(t => t !== time)
        : [...dayTimes, time].sort();
      const newCourtData = { ...courtData };
      if (newDayTimes.length === 0) {
        delete newCourtData[dayKey];
      } else {
        newCourtData[dayKey] = newDayTimes;
      }
      return { ...prev, [courtKey]: newCourtData };
    });
  };

  const onSubmit = async (data: CourtFormData) => {
    setError("");
    if (!data.courtName || !data.location || !data.fullAddress || !data.pricePerHour || !data.description) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!user) {
      setError("You must be logged in to create a listing.");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("Please upload at least one image.");
      return;
    }

    setSaving(true);
    try {
      const storage = getStorageInstance();
      const imageUrls: string[] = [];

      for (const file of selectedFiles) {
        const imageRef = ref(storage, `courts/${Date.now()}_${file.name}`);
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        imageUrls.push(url);
      }

      const courtDoc: any = {
        name: data.courtName,
        location: data.location,
        address: data.fullAddress,
        accessInstructions: data.accessInstructions,
        price: Number(data.pricePerHour),
        description: data.description,
        imageUrl: imageUrls[0],
        imageUrls,
        ownerId: user.uid,
        numberOfCourts,
        maxAdvanceBookingDays: maxAdvanceBookingDays ?? null,
        alwaysBlockedTimes,
        alwaysBlockedTimesByDay,
        createdAt: new Date(),
      };

      if (data.latitude) courtDoc.latitude = Number(data.latitude);
      if (data.longitude) courtDoc.longitude = Number(data.longitude);

      if (numberOfCourts > 1) {
        courtDoc.courtSpecificAlwaysBlockedTimes = courtSpecificAlwaysBlockedTimes;
        courtDoc.courtSpecificAlwaysBlockedTimesByDay = courtSpecificAlwaysBlockedTimesByDay;
      }

      await addDoc(collection(db, "courts"), courtDoc);
      router.push("/dashboard/owner");
    } catch (err: any) {
      setError(err.message || "Failed to create listing");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
      <AppHeader />

      <section className="relative py-24 bg-gradient-tennis overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center text-white">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-3xl glass-dark flex items-center justify-center shadow-glow">
                <Trophy className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">Create Court Listing</h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto font-medium">Fill in your court details below to start accepting bookings</p>
          </div>
        </div>
      </section>

      <section className="py-12 -mt-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-elegant border-0 rounded-3xl glass backdrop-blur-xl mt-8">
              <CardHeader className="space-y-2 pb-10 pt-10">
                <CardTitle className="text-3xl md:text-4xl font-black text-center tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Court Details</CardTitle>
                <CardDescription className="text-center text-gray-600 font-medium text-lg">Please provide accurate information about your tennis court</CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="courtName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Court Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter court name" className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Location</FormLabel>
                          <FormControl>
                            <Input placeholder="City, State" className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="fullAddress" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value}
                            onChange={(address, coordinates) => {
                              field.onChange(address);
                              if (coordinates) {
                                form.setValue("latitude", coordinates.latitude.toString());
                                form.setValue("longitude", coordinates.longitude.toString());
                              }
                            }}
                            placeholder="Complete street address"
                            className="h-12 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200"
                            label="Full Address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="accessInstructions" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Access Instructions</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Gate code, building access, parking info..." className="min-h-[100px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200 resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Price per Hour (USD)</FormLabel>
                          <FormControl>
                            <Input placeholder="25.00" type="number" step="0.01" className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Number of Bookable Courts */}
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Number of Bookable Courts</FormLabel>
                        <Select
                          value={String(numberOfCourts)}
                          onValueChange={(v) => setNumberOfCourts(parseInt(v, 10))}
                        >
                          <SelectTrigger className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-xl">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <SelectItem key={n} value={String(n)} className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer">
                                {n} {n === 1 ? "court" : "courts"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          {numberOfCourts === 1 ? "Single court listing" : `Club listing with ${numberOfCourts} bookable courts`}
                        </p>
                      </FormItem>
                    </div>

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe your court's features, amenities, surface type..." className="min-h-[120px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20 transition-all duration-200 resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Location Coordinates */}
                    <div className="space-y-4">
                      <FormLabel className="text-sm font-semibold">Location Coordinates (Optional)</FormLabel>
                      <p className="text-sm text-gray-600">Add precise coordinates to enable distance-based search.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="latitude" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Latitude</FormLabel>
                            <FormControl>
                              <Input placeholder="34.0522" type="number" step="any" className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="longitude" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Longitude</FormLabel>
                            <FormControl>
                              <Input placeholder="-118.2437" type="number" step="any" className="h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* Image Upload Section */}
                    <div className="space-y-4">
                      <FormLabel className="text-sm font-semibold">Upload Images</FormLabel>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500/50 transition-colors">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <div className="space-y-2">
                          <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
                          <Button type="button" variant="outline" className="border-green-500/20 hover:bg-green-50 text-green-700 hover:border-green-500 cursor-pointer" onClick={triggerFileInput}>Choose Files</Button>
                          <p className="text-sm text-gray-500">{selectedFiles.length === 0 ? "No file chosen" : `${selectedFiles.length} file(s) selected`}</p>
                        </div>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-700">Selected Images:</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                                <button type="button" onClick={() => removeFile(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100">×</button>
                                <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="my-8 border-t border-gray-200"></div>

                    {/* Availability Management */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Availability Management</h3>
                        <p className="text-sm text-gray-600">
                          {numberOfCourts > 1
                            ? `Set default availability rules that apply to all ${numberOfCourts} courts`
                            : "Manage when your court is available for booking"}
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
                                {[
                                  { value: "unlimited", label: "No limit" },
                                  { value: "7", label: "1 week in advance" },
                                  { value: "14", label: "2 weeks in advance" },
                                  { value: "30", label: "1 month in advance" },
                                  { value: "60", label: "2 months in advance" },
                                  { value: "90", label: "3 months in advance" },
                                ].map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors duration-150 focus:bg-emerald-100 focus:text-emerald-800">
                                    {opt.label}
                                  </SelectItem>
                                ))}
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
                            {numberOfCourts > 1 ? "Always Blocked Times (All Courts)" : "Always Blocked Times"}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            {numberOfCourts > 1
                              ? "Select times that are blocked every day on ALL courts"
                              : "Select times that are always blocked on every day"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-gray-600">Click to toggle. Selected times are blocked every day.</p>
                          <div className="flex flex-wrap gap-2">
                            {timeSlots.map((time) => {
                              const isBlocked = alwaysBlockedTimes.includes(time);
                              return (
                                <button key={time} type="button" onClick={() => toggleAlwaysBlockedTime(time)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${isBlocked ? "bg-red-100 text-red-800 border-2 border-red-300" : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"}`}>
                                  {formatTimeDisplay(time)}
                                </button>
                              );
                            })}
                          </div>
                          {alwaysBlockedTimes.length > 0 && (
                            <p className="text-sm text-red-600">{alwaysBlockedTimes.length} time(s) always blocked</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Always Blocked on Specific Day */}
                      <Card className="border-gray-200">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {numberOfCourts > 1 ? "Always Blocked on Specific Day (All Courts)" : "Always Blocked on Specific Day"}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            {numberOfCourts > 1
                              ? `Set times blocked every week on a specific day for ALL ${numberOfCourts} courts`
                              : 'Set times that are blocked every week on a specific day (e.g. "9 AM blocked every Monday")'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => (
                            <div key={dayOfWeek} className="space-y-2">
                              <FormLabel className="text-sm font-medium">{label}</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {timeSlots.map((time) => {
                                  const isBlocked = (alwaysBlockedTimesByDay[dayOfWeek] || []).includes(time);
                                  return (
                                    <button key={time} type="button" onClick={() => toggleAlwaysBlockedTimeForDay(dayOfWeek, time)}
                                      className={`px-2 py-1.5 rounded text-xs font-medium transition ${isBlocked ? "bg-orange-100 text-orange-800 border border-orange-300" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
                                      {formatTimeDisplay(time)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Per-Court Availability (only when numberOfCourts > 1) */}
                      {numberOfCourts > 1 && (
                        <div className="space-y-4">
                          <div className="my-4 border-t-2 border-emerald-200"></div>
                          <h3 className="text-lg font-semibold">Individual Court Availability</h3>
                          <p className="text-sm text-gray-600">
                            Optionally set additional blocked times for specific courts. These are added on top of the &quot;all courts&quot; settings above.
                          </p>

                          {Array.from({ length: numberOfCourts }, (_, i) => i + 1).map((courtNum) => (
                            <Card key={courtNum} className="border-gray-200">
                              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedCourt(expandedCourt === courtNum ? null : courtNum)}>
                                <CardTitle className="text-base flex items-center justify-between">
                                  <span>Court {courtNum}</span>
                                  <span className="text-sm text-gray-400">{expandedCourt === courtNum ? "▼" : "▶"}</span>
                                </CardTitle>
                                <CardDescription className="text-xs text-gray-500">
                                  {(courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).length > 0
                                    ? `${(courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).length} additional blocked time(s)`
                                    : "No additional restrictions"}
                                </CardDescription>
                              </CardHeader>

                              {expandedCourt === courtNum && (
                                <CardContent className="space-y-4 pt-0">
                                  {/* Court-specific always blocked */}
                                  <div>
                                    <FormLabel className="text-sm font-medium">Additional Always Blocked Times</FormLabel>
                                    <p className="text-xs text-gray-500 mb-2">These times will be blocked every day for Court {courtNum} only (in addition to the global blocks above).</p>
                                    <div className="flex flex-wrap gap-2">
                                      {timeSlots.map((time) => {
                                        const isBlocked = (courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).includes(time);
                                        const isGlobalBlocked = alwaysBlockedTimes.includes(time);
                                        return (
                                          <button key={time} type="button"
                                            onClick={() => !isGlobalBlocked && toggleCourtSpecificTime(courtNum, time)}
                                            disabled={isGlobalBlocked}
                                            className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                                              isGlobalBlocked
                                                ? "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed"
                                                : isBlocked
                                                ? "bg-red-100 text-red-800 border border-red-300"
                                                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                                            }`}>
                                            {formatTimeDisplay(time)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Court-specific day blocks */}
                                  <div>
                                    <FormLabel className="text-sm font-medium">Additional Blocked on Specific Day</FormLabel>
                                    <p className="text-xs text-gray-500 mb-2">Block specific times on specific days for Court {courtNum} only.</p>
                                    {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => (
                                      <div key={dayOfWeek} className="space-y-1 mb-3">
                                        <span className="text-xs font-medium text-gray-600">{label}</span>
                                        <div className="flex flex-wrap gap-1">
                                          {timeSlots.map((time) => {
                                            const courtKey = String(courtNum);
                                            const dayKey = String(dayOfWeek);
                                            const isBlocked = ((courtSpecificAlwaysBlockedTimesByDay[courtKey] || {})[dayKey] || []).includes(time);
                                            const isGlobalBlocked = alwaysBlockedTimes.includes(time) || (alwaysBlockedTimesByDay[dayOfWeek] || []).includes(time);
                                            return (
                                              <button key={time} type="button"
                                                onClick={() => !isGlobalBlocked && toggleCourtSpecificTimeForDay(courtNum, dayOfWeek, time)}
                                                disabled={isGlobalBlocked}
                                                className={`px-1.5 py-1 rounded text-[10px] font-medium transition ${
                                                  isGlobalBlocked
                                                    ? "bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed"
                                                    : isBlocked
                                                    ? "bg-orange-100 text-orange-800 border border-orange-300"
                                                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                                                }`}>
                                                {formatTimeDisplay(time)}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <div className="pt-6">
                      <Button type="submit" disabled={saving}
                        className="w-full h-14 text-lg font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02]">
                        {saving ? "Creating..." : "Create Listing"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="w-full bg-slate-900 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-sm">© 2025 CourtShare. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default CreateListing;
