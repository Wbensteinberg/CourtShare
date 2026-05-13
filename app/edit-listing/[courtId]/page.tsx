"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, getStorageInstance, isMockMode } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Info,
  Settings2,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  deleteMockCourt,
  fileToDataUrl,
  getMockCourtById,
  updateMockCourt,
} from "@/lib/mockData";

interface Court {
  id: string;
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  checkInType?: "self" | "host";
  checkInInstructions?: string;
  price: number;
  description: string;
  surface?: string;
  indoor?: boolean;
  amenities?: string[];
  parkingSpaces?: number | null;
  spaceGreatFor?: string[];
  imageUrl: string;
  imageUrls?: string[];
  ownerId: string;
  numberOfCourts?: number;
  blockedDates?: string[];
  blockedTimes?: { [date: string]: string[] };
  maxAdvanceBookingDays?: number | null;
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: { [dayOfWeek: number]: string[] };
  courtSpecificAlwaysBlockedTimes?: { [courtNum: string]: string[] };
  courtSpecificAlwaysBlockedTimesByDay?: { [courtNum: string]: { [dayOfWeek: string]: string[] } };
  maxGuests?: number | null;
  speakersPolicy?: "allowed" | "not_allowed" | "quiet_hours_only" | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  houseRules?: string[];
  additionalRules?: string;
}

interface CourtFormData {
  courtName: string;
  location: string;
  fullAddress: string;
  accessInstructions: string;
  pricePerHour: string;
  description: string;
}

const AMENITY_OPTIONS = [
  { value: "on_site_parking", label: "On-site parking" },
  { value: "free_street_parking", label: "Free street parking" },
  { value: "wifi", label: "WiFi" },
  { value: "restrooms", label: "Restrooms" },
  { value: "balls_provided", label: "Balls provided" },
  { value: "night_lights", label: "Night lights" },
  { value: "water_provided", label: "Water provided" },
  { value: "towels_provided", label: "Towels provided" },
];

const SPACE_GREAT_FOR_OPTIONS = [
  "Casual Play",
  "Competitive Play",
  "Lessons/Training",
  "Photoshoots/Content",
];

const HOUSE_RULES_OPTIONS = [
  { value: "no_smoking", label: "No smoking" },
  { value: "no_alcohol", label: "No alcohol" },
  { value: "no_outside_food", label: "No outside food or drinks" },
  { value: "court_shoes_required", label: "Court shoes required" },
  { value: "no_pets", label: "No pets" },
  { value: "guests_must_sign_in", label: "Guests must sign in" },
];

const COURT_TYPE_OPTIONS = ["Hard Court", "Grass Court", "Clay Court"];

const RequiredStar = () => <span className="text-red-500">*</span>;

const formatTakeHome = (price: string) => {
  const amount = Number(price);
  return Number.isFinite(amount) && amount > 0
    ? `$${Math.round(amount * 0.9).toLocaleString()}`
    : "$0";
};

const deriveLocationFromAddress = (address: string) => {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const hasCountry = parts[parts.length - 1].toLowerCase() === "usa";
    const statePart = hasCountry ? parts[parts.length - 2] : parts[parts.length - 1];
    const cityPart = hasCountry ? parts[parts.length - 3] : parts[parts.length - 2];
    const state = statePart.split(/\s+/)[0] || statePart;
    return cityPart && state ? `${cityPart}, ${state}` : address;
  }
  return address;
};

export default function EditListingPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  const [checkInType, setCheckInType] = useState<"self" | "host" | "">("");
  const [courtType, setCourtType] = useState("Hard Court");
  const [courtSetting, setCourtSetting] = useState<"outdoor" | "indoor">("outdoor");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState("");
  const [spaceGreatFor, setSpaceGreatFor] = useState<string[]>([]);
  const [maxGuests, setMaxGuests] = useState<string>("");
  const [speakersPolicy, setSpeakersPolicy] = useState<"allowed" | "not_allowed" | "quiet_hours_only" | "">("");
  const [quietHoursStart, setQuietHoursStart] = useState<string>("");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("");
  const [houseRules, setHouseRules] = useState<string[]>([]);
  const [additionalRules, setAdditionalRules] = useState<string>("");

  // Default blocked settings
  const [maxAdvanceBookingDays, setMaxAdvanceBookingDays] = useState<number | null>(null);
  const [alwaysBlockedTimes, setAlwaysBlockedTimes] = useState<string[]>([]);
  const [alwaysBlockedTimesByDay, setAlwaysBlockedTimesByDay] = useState<{ [dayOfWeek: number]: string[] }>({});

  // Multi-court
  const [numberOfCourts, setNumberOfCourts] = useState<number>(1);
  const [courtSpecificAlwaysBlockedTimes, setCourtSpecificAlwaysBlockedTimes] = useState<{ [courtNum: string]: string[] }>({});
  const [courtSpecificAlwaysBlockedTimesByDay, setCourtSpecificAlwaysBlockedTimesByDay] = useState<{ [courtNum: string]: { [dayOfWeek: string]: string[] } }>({});
  const [expandedCourt, setExpandedCourt] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingListing, setDeletingListing] = useState(false);
  
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

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
  const watchedPricePerHour = form.watch("pricePerHour");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!courtId || !user) return;
    
    const fetchCourt = async () => {
      setLoading(true);
      setError("");
      
      try {
        let resolvedCourt: Court | null = null;

        if (isMockMode) {
          resolvedCourt = getMockCourtById(courtId as string) as Court | null;
        } else {
          const courtRef = doc(db, "courts", courtId as string);
          const snap = await getDoc(courtRef);
          resolvedCourt = snap.exists()
            ? ({ id: snap.id, ...snap.data() } as Court)
            : null;
        }

        if (!resolvedCourt) {
          setError("Court not found");
          setLoading(false);
          return;
        }
        
        // Check if this court belongs to the current user
        if (resolvedCourt.ownerId !== user.uid) {
          setError("You don't have permission to edit this court");
          setLoading(false);
          return;
        }
        
        setCourt(resolvedCourt);
        
        setExistingImages(resolvedCourt.imageUrls || [resolvedCourt.imageUrl]);
        // Set the main image index to 0 (first image) by default
        setMainImageIndex(0);
        
        // Load availability data
        setMaxAdvanceBookingDays(resolvedCourt.maxAdvanceBookingDays ?? null);
        setAlwaysBlockedTimes(resolvedCourt.alwaysBlockedTimes || []);
        setAlwaysBlockedTimesByDay(resolvedCourt.alwaysBlockedTimesByDay || {});
        setNumberOfCourts(resolvedCourt.numberOfCourts || 1);
        setCourtSpecificAlwaysBlockedTimes(resolvedCourt.courtSpecificAlwaysBlockedTimes || {});
        setCourtSpecificAlwaysBlockedTimesByDay(resolvedCourt.courtSpecificAlwaysBlockedTimesByDay || {});
        setCheckInType(resolvedCourt.checkInType || "");
        setCourtType(resolvedCourt.surface || "Hard Court");
        setCourtSetting(resolvedCourt.indoor ? "indoor" : "outdoor");
        setAmenities(resolvedCourt.amenities || []);
        setParkingSpaces(
          resolvedCourt.parkingSpaces ? String(resolvedCourt.parkingSpaces) : ""
        );
        setSpaceGreatFor(resolvedCourt.spaceGreatFor || []);
        setMaxGuests(resolvedCourt.maxGuests ? String(resolvedCourt.maxGuests) : "");
        setSpeakersPolicy(resolvedCourt.speakersPolicy || "");
        setQuietHoursStart(resolvedCourt.quietHoursStart || "");
        setQuietHoursEnd(resolvedCourt.quietHoursEnd || "");
        setHouseRules(resolvedCourt.houseRules || []);
        setAdditionalRules(resolvedCourt.additionalRules || "");

        // Update form default values
        form.setValue("courtName", resolvedCourt.name);
        form.setValue("location", resolvedCourt.location);
        form.setValue("fullAddress", resolvedCourt.address || "");
        form.setValue(
          "accessInstructions",
          resolvedCourt.checkInInstructions || resolvedCourt.accessInstructions || ""
        );
        form.setValue("pricePerHour", resolvedCourt.price.toString());
        form.setValue("description", resolvedCourt.description);
        
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const inputClass =
    "h-12 rounded-2xl border-slate-300 bg-white text-base font-medium focus:border-[var(--site-accent)] focus:ring-[var(--site-accent)]";
  const textareaClass =
    "min-h-[120px] resize-none rounded-2xl border-slate-300 bg-white p-4 text-base focus:border-[var(--site-accent)] focus:ring-[var(--site-accent)]";
  const sectionCardClass = "rounded-[32px] border-slate-200 bg-white shadow-sm";

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
      if (isMockMode) {
        await deleteMockCourt(courtId);
      } else {
        await deleteDoc(doc(db, "courts", courtId));
      }
      router.push("/host?tab=courts");
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

  const toggleArrayValue = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const formatTimeDisplay = (time: string): string => {
    const hour = parseInt(time.split(":")[0], 10);
    return hour < 12 ? `${hour === 0 ? 12 : hour}:00 AM` : `${hour === 12 ? 12 : hour - 12}:00 PM`;
  };

  const toggleCourtSpecificTime = (courtNum: number, time: string) => {
    const key = String(courtNum);
    setCourtSpecificAlwaysBlockedTimes(prev => {
      const times = prev[key] || [];
      const newTimes = times.includes(time) ? times.filter(t => t !== time) : [...times, time].sort();
      return { ...prev, [key]: newTimes };
    });
  };

  const toggleCourtSpecificTimeForDay = (courtNum: number, dayOfWeek: number, time: string) => {
    const courtKey = String(courtNum);
    const dayKey = String(dayOfWeek);
    setCourtSpecificAlwaysBlockedTimesByDay(prev => {
      const courtData = prev[courtKey] || {};
      const dayTimes = courtData[dayKey] || [];
      const newDayTimes = dayTimes.includes(time) ? dayTimes.filter(t => t !== time) : [...dayTimes, time].sort();
      const newCourtData = { ...courtData };
      if (newDayTimes.length === 0) { delete newCourtData[dayKey]; } else { newCourtData[dayKey] = newDayTimes; }
      return { ...prev, [courtKey]: newCourtData };
    });
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
    const derivedLocation = deriveLocationFromAddress(data.fullAddress);
    form.setValue("location", derivedLocation);
    
    if (!data.courtName || !data.fullAddress || !data.pricePerHour || !data.description) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^\d+$/.test(data.pricePerHour)) {
      setError("Price per hour must be a whole dollar amount.");
      return;
    }
    if (!checkInType || !data.accessInstructions) {
      setError("Please select a check-in option and add check-in instructions.");
      return;
    }
    
    if (!user || !court) {
      setError("You must be logged in to edit a listing.");
      return;
    }
    
    setSaving(true);
    
    try {
      const newImageUrls: string[] = isMockMode
        ? await Promise.all(images.map((image) => fileToDataUrl(image)))
        : [];
      
      if (!isMockMode) {
        const storage = getStorageInstance();
        for (const image of images) {
          const imageRef = ref(storage, `courts/${Date.now()}_${image.name}`);
          await uploadBytes(imageRef, image);
          const imageUrl = await getDownloadURL(imageRef);
          newImageUrls.push(imageUrl);
        }
      }
      
      // Combine existing images (not removed) with new images
      const finalImageUrls = [...existingImages.filter(img => !removedImages.includes(img)), ...newImageUrls];
      
      if (finalImageUrls.length === 0) {
        setError("At least one image is required.");
        return;
      }
      
      // Use the selected main image
      const mainImageUrl = finalImageUrls[mainImageIndex] || finalImageUrls[0];
      
      const updateData: any = {
        name: data.courtName,
        location: deriveLocationFromAddress(data.fullAddress),
        address: data.fullAddress,
        accessInstructions: data.accessInstructions,
        checkInType,
        checkInInstructions: data.accessInstructions,
        price: Number(data.pricePerHour),
        description: data.description,
        surface: courtType,
        indoor: courtSetting === "indoor",
        amenities,
        parkingSpaces: amenities.includes("on_site_parking")
          ? Number(parkingSpaces) || null
          : null,
        spaceGreatFor,
        maxGuests: maxGuests ? Number(maxGuests) : null,
        speakersPolicy: speakersPolicy || null,
        quietHoursStart: speakersPolicy === "quiet_hours_only" ? quietHoursStart || null : null,
        quietHoursEnd: speakersPolicy === "quiet_hours_only" ? quietHoursEnd || null : null,
        houseRules,
        additionalRules,
        imageUrl: mainImageUrl,
        imageUrls: finalImageUrls,
        numberOfCourts,
        maxAdvanceBookingDays: maxAdvanceBookingDays ?? null,
        alwaysBlockedTimes,
        alwaysBlockedTimesByDay,
      };

      if (numberOfCourts > 1) {
        updateData.courtSpecificAlwaysBlockedTimes = courtSpecificAlwaysBlockedTimes;
        updateData.courtSpecificAlwaysBlockedTimesByDay = courtSpecificAlwaysBlockedTimesByDay;
      }

      if (isMockMode) {
        await updateMockCourt(courtId as string, updateData);
      } else {
        await updateDoc(doc(db, "courts", courtId as string), updateData);
      }
      
      setSuccess(true);
      
      // Redirect to host dashboard after a short delay
      setTimeout(() => {
        router.push("/host?tab=courts");
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || "Failed to update listing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen
        message="Loading listing"
        detail="Preparing your court details and availability settings."
      />
    );
  }

  if (error && !court) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-md rounded-[32px] border-slate-200 bg-white text-center shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-black text-slate-950">Unable to edit listing</h2>
              <p className="mt-3 text-slate-500">{error}</p>
              <Button
                onClick={() => router.push("/host?tab=courts")}
                className="mt-6 h-12 rounded-2xl bg-[var(--site-accent)] px-6 font-bold text-white hover:bg-[var(--site-accent-hover)]"
              >
                Back to Your Courts
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-md rounded-[32px] border-slate-200 bg-white text-center shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-black text-slate-950">Court Not Found</h2>
              <p className="mt-3 text-slate-500">The court you're looking for doesn't exist.</p>
              <Button
                onClick={() => router.push("/host?tab=courts")}
                className="mt-6 h-12 rounded-2xl bg-[var(--site-accent)] px-6 font-bold text-white hover:bg-[var(--site-accent-hover)]"
              >
                Back to Your Courts
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-6">
          <Button
            type="button"
            variant="ghost"
            className="mb-4 -ml-3 rounded-2xl text-slate-600 hover:bg-white hover:text-slate-950"
            onClick={() => router.push("/host?tab=courts")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Your Courts
          </Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950">
                Edit Court Listing
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
                Keep your listing accurate so players know what to expect before they book.
              </p>
            </div>
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
              Changes apply to future booking requests
		                      </div>
	          </div>
	        </div>

	        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className={sectionCardClass}>
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--site-accent)]">
                  <Trophy className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-black text-slate-950">
                  Editing checklist
                </h2>
                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  {[
                    "Review public court details",
                    "Keep access instructions current",
                    "Choose a strong main photo",
                    "Confirm pricing and court count",
                    "Update blocked time rules",
                  ].map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={sectionCardClass}>
              <CardContent className="p-6">
                <h2 className="text-lg font-black text-slate-950">
                  Listing status
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Saved changes update the live court listing. Existing confirmed bookings keep their booking details.
                </p>
              </CardContent>
            </Card>
          </aside>

          <section>
            <Card className={sectionCardClass}>
              <CardHeader className="border-b border-slate-200 p-6">
                <CardTitle className="text-2xl font-black tracking-tight text-slate-950">
                  Court details
                </CardTitle>
                <CardDescription className="text-base text-slate-500">
                  Update the core information players see before requesting a reservation.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-8 p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
	                    <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">Basics</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Name, location, pricing, and a short description.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <FormField
                          control={form.control}
                          name="courtName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">
                                Court Name <RequiredStar />
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Brentwood Backyard Court" className={inputClass} {...field} />
	                              </FormControl>
                              <p className="mt-2 text-xs font-medium text-slate-500">
                                The exact address will only be provided to the player once you accept their booking request.
                              </p>
	                              <FormMessage />
	                            </FormItem>
	                          )}
                        />

                        <FormField
                          control={form.control}
                          name="fullAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <AddressAutocomplete
                                  value={field.value}
                                  onChange={(address) => {
                                    field.onChange(address);
                                    form.setValue("location", deriveLocationFromAddress(address));
                                  }}
                                  placeholder="Complete street address"
                                  className={inputClass}
                                  label="Full Address *"
                                />
		                            </FormControl>
                                <p className="mt-2 text-xs font-medium text-slate-500">
                                  Check-in instructions will only be provided to the player once you accept their booking request.
                                </p>
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
                            <FormLabel className="text-sm font-semibold">
                              Description <RequiredStar />
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your court's surface, lighting, amenities, privacy, and anything players should know."
                                className={textareaClass}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
	                          )}
	                      />

	                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
	                        <FormItem>
	                          <FormLabel className="text-sm font-semibold">Court Type</FormLabel>
	                          <Select value={courtType} onValueChange={setCourtType}>
		                            <SelectTrigger className={`${inputClass} text-sm`}>
	                              <SelectValue />
	                            </SelectTrigger>
	                            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
	                              {COURT_TYPE_OPTIONS.map((type) => (
		                                <SelectItem key={type} value={type} className="cursor-pointer text-sm hover:bg-emerald-50 hover:text-emerald-700">
	                                  {type}
	                                </SelectItem>
	                              ))}
	                            </SelectContent>
	                          </Select>
	                        </FormItem>

	                        <FormItem>
	                          <FormLabel className="text-sm font-semibold">Indoor / Outdoor</FormLabel>
	                          <Select value={courtSetting} onValueChange={(value) => setCourtSetting(value as "outdoor" | "indoor")}>
		                            <SelectTrigger className={`${inputClass} text-sm`}>
	                              <SelectValue />
	                            </SelectTrigger>
	                            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
		                              <SelectItem value="outdoor" className="cursor-pointer text-sm hover:bg-emerald-50 hover:text-emerald-700">Outdoor</SelectItem>
		                              <SelectItem value="indoor" className="cursor-pointer text-sm hover:bg-emerald-50 hover:text-emerald-700">Indoor</SelectItem>
	                            </SelectContent>
	                          </Select>
	                        </FormItem>
	                      </div>

	                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
	                        <FormField
	                          control={form.control}
	                          name="pricePerHour"
	                          render={({ field }) => (
	                            <FormItem>
	                              <FormLabel className="flex items-center gap-2 text-sm font-semibold">
	                                Price per Hour (USD) <RequiredStar />
	                                <span className="group relative inline-flex">
	                                  <Info className="h-4 w-4 text-slate-400" />
	                                  <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium leading-5 text-slate-600 shadow-xl group-hover:block">
	                                    CourtShare takes a 10% fee from this price. The remaining 90% is your estimated host take-home before any taxes or adjustments.
	                                  </span>
	                                </span>
	                              </FormLabel>
	                              <FormControl>
	                                <Input
	                                  placeholder="25"
	                                  type="number"
	                                  step="1"
	                                  min="1"
	                                  inputMode="numeric"
	                                  className={inputClass}
	                                  {...field}
	                                  onChange={(event) =>
	                                    field.onChange(event.target.value.replace(/\D/g, ""))
	                                  }
	                                />
	                              </FormControl>
	                              <p className="mt-1 text-xs font-bold text-[var(--site-accent)]">
	                                Your take home will be {formatTakeHome(watchedPricePerHour)}/hr
	                              </p>
	                              <FormMessage />
	                            </FormItem>
	                          )}
	                        />

	                        <FormItem>
	                          <FormLabel className="text-sm font-semibold">Number of Bookable Courts</FormLabel>
	                          <Select value={String(numberOfCourts)} onValueChange={(v) => setNumberOfCourts(parseInt(v, 10))}>
	                            <SelectTrigger className={`${inputClass} text-sm`}>
	                              <SelectValue />
	                            </SelectTrigger>
	                            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
	                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
	                                <SelectItem key={n} value={String(n)} className="cursor-pointer text-sm hover:bg-emerald-50 hover:text-emerald-700">
	                                  {n} {n === 1 ? "court" : "courts"}
	                                </SelectItem>
	                              ))}
	                            </SelectContent>
	                          </Select>
	                          <p className="mt-1 text-xs text-slate-500">
	                            {numberOfCourts === 1 ? "Single court listing" : `Club listing with ${numberOfCourts} bookable courts`}
	                          </p>
	                        </FormItem>
	                      </div>

	                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                        <Info className="h-4 w-4 shrink-0 text-slate-400" />
		                        <p className="text-sm text-slate-600">
		                          <span className="font-semibold">Cancellation Policy:</span> Full refund if cancelled 24 hours before court time.
		                        </p>
		                      </div>
	                    </div>

		                    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
	                      <div>
	                        <h3 className="text-lg font-black text-slate-950">
	                          Check-in <RequiredStar />
	                        </h3>
	                        <p className="mt-1 text-sm text-slate-500">
	                          Tell players how they will access the court.
	                        </p>
	                      </div>
	                      <div className="grid gap-3 md:grid-cols-2">
	                        {[
	                          { value: "self" as const, label: "Self-check in" },
	                          { value: "host" as const, label: "Check-in with host" },
	                        ].map((option) => (
	                          <label
	                            key={option.value}
	                            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"
	                          >
	                            <Checkbox
	                              checked={checkInType === option.value}
	                              onCheckedChange={(checked) =>
	                                setCheckInType(checked ? option.value : "")
	                              }
	                            />
	                            {option.label}
	                          </label>
	                        ))}
	                      </div>
	                      <FormField
	                        control={form.control}
	                        name="accessInstructions"
	                        render={({ field }) => (
	                          <FormItem>
	                            <FormLabel className="text-sm font-semibold">
	                              Check-in Instructions <RequiredStar />
	                            </FormLabel>
	                            <FormControl>
	                              <Textarea
	                                placeholder="Gate code, building access, where players should enter, and anything they need for check-in..."
	                                className={textareaClass}
	                                {...field}
	                              />
	                            </FormControl>
	                            <FormMessage />
	                          </FormItem>
	                        )}
	                      />
	                    </div>

                      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">
                            Amenities
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Select everything players can use during their booking.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {AMENITY_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"
                            >
                              <Checkbox
                                checked={amenities.includes(option.value)}
                                onCheckedChange={() =>
                                  toggleArrayValue(option.value, setAmenities)
                                }
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                        {amenities.includes("on_site_parking") && (
                          <div className="max-w-xs">
                            <FormLabel className="text-sm font-semibold">
                              Up to how many cars?
                            </FormLabel>
                            <Input
                              type="number"
                              min="1"
                              placeholder="2"
                              value={parkingSpaces}
                              onChange={(event) =>
                                setParkingSpaces(event.target.value)
                              }
                              className={`${inputClass} mt-2`}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">
                            This space is great for
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Help players understand the best uses for your court.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {SPACE_GREAT_FOR_OPTIONS.map((option) => (
                            <label
                              key={option}
                              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"
                            >
                              <Checkbox
                                checked={spaceGreatFor.includes(option)}
                                onCheckedChange={() =>
                                  toggleArrayValue(option, setSpaceGreatFor)
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
	                        <div>
	                          <h3 className="text-lg font-black text-slate-950">Court Rules</h3>
	                          <p className="mt-1 text-sm text-slate-500">
	                            Let guests know what's expected during their booking.
	                          </p>
	                        </div>

	                        <FormItem>
	                          <FormLabel className="text-sm font-semibold">Max Guests</FormLabel>
	                          <FormControl>
	                            <Input
	                              type="number"
	                              min="1"
	                              placeholder="e.g. 6"
	                              value={maxGuests}
	                              onChange={(e) => setMaxGuests(e.target.value.replace(/\D/g, ""))}
	                              className={`${inputClass} max-w-[200px]`}
	                            />
	                          </FormControl>
	                          <p className="mt-1 text-xs text-slate-500">Maximum number of people allowed at the court during a booking.</p>
	                        </FormItem>

	                        <div className="space-y-3">
                          <FormLabel className="text-sm font-semibold">Music & Speakers</FormLabel>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {[
                              { value: "allowed", label: "Speakers allowed" },
                              { value: "quiet_hours_only", label: "Quiet hours only" },
                              { value: "not_allowed", label: "No speakers" },
                            ].map((option) => (
                              <label
                                key={option.value}
                                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"
                              >
                                <Checkbox
                                  checked={speakersPolicy === option.value}
                                  onCheckedChange={(checked) =>
                                    setSpeakersPolicy(checked ? option.value as "allowed" | "not_allowed" | "quiet_hours_only" : "")
                                  }
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          {speakersPolicy === "quiet_hours_only" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <FormLabel className="text-sm font-semibold">Quiet hours start</FormLabel>
                                <Select value={quietHoursStart} onValueChange={setQuietHoursStart}>
                                  <SelectTrigger className={`${inputClass} mt-2`}>
                                    <SelectValue placeholder="Select time" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
                                    {timeSlots.map((time) => (
                                      <SelectItem key={time} value={time} className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-700">
                                        {formatTimeDisplay(time)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <FormLabel className="text-sm font-semibold">Quiet hours end</FormLabel>
                                <Select value={quietHoursEnd} onValueChange={setQuietHoursEnd}>
                                  <SelectTrigger className={`${inputClass} mt-2`}>
                                    <SelectValue placeholder="Select time" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
                                    {timeSlots.map((time) => (
                                      <SelectItem key={time} value={time} className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-700">
                                        {formatTimeDisplay(time)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <FormLabel className="text-sm font-semibold">House Rules</FormLabel>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {HOUSE_RULES_OPTIONS.map((rule) => (
                              <label
                                key={rule.value}
                                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"
                              >
                                <Checkbox
                                  checked={houseRules.includes(rule.value)}
                                  onCheckedChange={() => toggleArrayValue(rule.value, setHouseRules)}
                                />
                                {rule.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <FormLabel className="text-sm font-semibold">Additional Rules</FormLabel>
                          <Textarea
                            placeholder="Any other rules or expectations guests should know about..."
                            value={additionalRules}
                            onChange={(e) => setAdditionalRules(e.target.value)}
                            className={`${textareaClass} mt-2 min-h-[80px]`}
                          />
                        </div>
                      </div>

                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">
                          Photos <RequiredStar />
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Choose which existing photo appears first and add new photos as needed.
                        </p>
                      </div>

                      {existingImages.length > 0 && (
                        <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                          <p className="text-sm font-bold text-slate-700">Current photos ({existingImages.length})</p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {existingImages.map((imageUrl, index) => (
                              <div key={imageUrl} className="group relative">
                                <img
                                  src={imageUrl}
                                  alt={`Current ${index + 1}`}
                                  className={`h-28 w-full rounded-2xl border object-cover ${mainImageIndex === index ? "border-[var(--site-accent)] ring-2 ring-[var(--site-accent)]" : "border-slate-200"}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingImage(imageUrl)}
                                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover:opacity-100"
                                >
                                  ×
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMainImageIndex(index)}
                                  className={`absolute bottom-2 left-2 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition ${mainImageIndex === index ? "bg-[var(--site-accent)] text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                                >
                                  {mainImageIndex === index ? "Main photo" : "Set main"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-[28px] border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-[var(--site-accent)]">
                        <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                        <div className="space-y-2">
                          <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                          <Button type="button" variant="outline" className="rounded-2xl border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-100" onClick={triggerFileInput}>
                            Choose Photos
                          </Button>
                          <p className="text-sm text-slate-500">
                            {images.length === 0 ? "No new photos selected" : `${images.length} new photo(s) selected`}
                          </p>
                        </div>
                      </div>

                      {images.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-slate-700">New photos</p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {images.map((image, index) => {
                              const newImageIndex = existingImages.length + index;
                              return (
                                <div key={`${image.name}-${index}`} className="group relative">
                                  <img
                                    src={URL.createObjectURL(image)}
                                    alt={`New ${index + 1}`}
                                    className={`h-28 w-full rounded-2xl border object-cover ${mainImageIndex === newImageIndex ? "border-[var(--site-accent)] ring-2 ring-[var(--site-accent)]" : "border-slate-200"}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50"
                                  >
                                    ×
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMainImageIndex(newImageIndex)}
                                    className={`absolute bottom-2 left-2 rounded-full px-3 py-1 text-xs font-bold shadow-sm transition ${mainImageIndex === newImageIndex ? "bg-[var(--site-accent)] text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                                  >
                                    {mainImageIndex === newImageIndex ? "Main photo" : "Set main"}
                                  </button>
                                  <p className="mt-1 truncate text-xs text-slate-500">{image.name}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200" />

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">Availability</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Manage when your court is available for booking.
                        </p>
                      </div>

                      <Card className={sectionCardClass}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base font-black text-slate-950">
                            <Settings2 className="h-4 w-4" />
                            Default Blocked Settings
                          </CardTitle>
                          <CardDescription className="text-sm text-slate-500">
                            Set booking availability rules that apply to all dates.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <FormLabel className="text-sm font-semibold">How far in advance can guests book?</FormLabel>
                          <Select
                            value={maxAdvanceBookingDays === null ? "unlimited" : String(maxAdvanceBookingDays)}
                            onValueChange={(v) => setMaxAdvanceBookingDays(v === "unlimited" ? null : parseInt(v, 10))}
                          >
                            <SelectTrigger className={`${inputClass} mt-2`}>
                              <SelectValue placeholder="Select booking window" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
                              {[
                                { value: "unlimited", label: "No limit" },
                                { value: "7", label: "1 week in advance" },
                                { value: "14", label: "2 weeks in advance" },
                                { value: "30", label: "1 month in advance" },
                                { value: "60", label: "2 months in advance" },
                                { value: "90", label: "3 months in advance" },
                              ].map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-700">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>

                      <Card className={sectionCardClass}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base font-black text-slate-950">
                            <Clock className="h-4 w-4" />
                            {numberOfCourts > 1 ? "Always Blocked Times (All Courts)" : "Always Blocked Times"}
                          </CardTitle>
                          <CardDescription className="text-sm text-slate-500">
                            Select times that are always blocked on every day.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-slate-500">Click to toggle. Selected times are blocked every day.</p>
                          <div className="flex flex-wrap gap-2">
                            {timeSlots.map((time) => {
                              const isBlocked = alwaysBlockedTimes.includes(time);
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => toggleAlwaysBlockedTime(time)}
                                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${isBlocked ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                                >
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

                      <Card className={sectionCardClass}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base font-black text-slate-950">
                            <CalendarIcon className="h-4 w-4" />
                            {numberOfCourts > 1 ? "Always Blocked on Specific Day (All Courts)" : "Always Blocked on Specific Day"}
                          </CardTitle>
                          <CardDescription className="text-sm text-slate-500">
                            Set times that are blocked every week on a specific day.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => (
                            <div key={dayOfWeek} className="space-y-2">
                              <FormLabel className="text-sm font-semibold">{label}</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {timeSlots.map((time) => {
                                  const isBlocked = (alwaysBlockedTimesByDay[dayOfWeek] || []).includes(time);
                                  return (
                                    <button
                                      key={time}
                                      type="button"
                                      onClick={() => toggleAlwaysBlockedTimeForDay(dayOfWeek, time)}
                                      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${isBlocked ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                                    >
                                      {formatTimeDisplay(time)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {numberOfCourts > 1 && (
                        <div className="space-y-4 rounded-[32px] border border-slate-200 bg-slate-50 p-5">
                          <div>
                            <h3 className="text-lg font-black text-slate-950">Individual court availability</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Add restrictions for a specific court. These stack on top of the all-court rules above.
                            </p>
                          </div>

                          {Array.from({ length: numberOfCourts }, (_, i) => i + 1).map((courtNum) => (
                            <Card key={courtNum} className="rounded-[24px] border-slate-200 bg-white shadow-sm">
                              <CardHeader className="cursor-pointer pb-3" onClick={() => setExpandedCourt(expandedCourt === courtNum ? null : courtNum)}>
                                <CardTitle className="flex items-center justify-between text-base font-black text-slate-950">
                                  <span>Court {courtNum}</span>
                                  <span className="text-sm text-slate-400">{expandedCourt === courtNum ? "Collapse" : "Edit"}</span>
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                  {(courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).length > 0
                                    ? `${(courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).length} additional blocked time(s)`
                                    : "No additional restrictions"}
                                </CardDescription>
                              </CardHeader>

                              {expandedCourt === courtNum && (
                                <CardContent className="space-y-4 pt-0">
                                  <div>
                                    <FormLabel className="text-sm font-semibold">Additional always blocked times</FormLabel>
                                    <p className="mb-3 text-xs text-slate-500">These times will be blocked every day for Court {courtNum} only.</p>
                                    <div className="flex flex-wrap gap-2">
                                      {timeSlots.map((time) => {
                                        const isBlocked = (courtSpecificAlwaysBlockedTimes[String(courtNum)] || []).includes(time);
                                        const isGlobalBlocked = alwaysBlockedTimes.includes(time);
                                        return (
                                          <button
                                            key={time}
                                            type="button"
                                            onClick={() => !isGlobalBlocked && toggleCourtSpecificTime(courtNum, time)}
                                            disabled={isGlobalBlocked}
                                            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${isGlobalBlocked ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : isBlocked ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                                          >
                                            {formatTimeDisplay(time)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div>
                                    <FormLabel className="text-sm font-semibold">Additional blocked on specific days</FormLabel>
                                    <p className="mb-3 text-xs text-slate-500">Block specific times on specific days for Court {courtNum} only.</p>
                                    {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => (
                                      <div key={dayOfWeek} className="mb-3 space-y-2">
                                        <span className="text-xs font-semibold text-slate-600">{label}</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {timeSlots.map((time) => {
                                            const courtKey = String(courtNum);
                                            const dayKey = String(dayOfWeek);
                                            const isBlocked = ((courtSpecificAlwaysBlockedTimesByDay[courtKey] || {})[dayKey] || []).includes(time);
                                            const isGlobalBlocked = alwaysBlockedTimes.includes(time) || (alwaysBlockedTimesByDay[dayOfWeek] || []).includes(time);
                                            return (
                                              <button
                                                key={time}
                                                type="button"
                                                onClick={() => !isGlobalBlocked && toggleCourtSpecificTimeForDay(courtNum, dayOfWeek, time)}
                                                disabled={isGlobalBlocked}
                                                className={`rounded-lg border px-1.5 py-1 text-[10px] font-semibold transition ${isGlobalBlocked ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : isBlocked ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                                              >
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

                    {error && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {error}
                      </div>
                    )}

                    {success && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                        Court updated successfully. Redirecting to Your Courts...
                      </div>
                    )}

                    <div className="space-y-4 pt-6">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push("/host?tab=courts")}
                          className="h-14 flex-1 rounded-2xl border-slate-300 bg-white text-lg font-bold text-slate-700 hover:bg-slate-100"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="h-14 flex-1 rounded-2xl bg-[var(--site-accent)] text-lg font-extrabold text-white shadow-sm transition hover:bg-[var(--site-accent-hover)]"
                          disabled={saving}
                        >
                          {saving ? "Updating Listing..." : "Update Listing"}
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDeleteListing}
                        disabled={deletingListing}
                        className="h-12 w-full rounded-2xl border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingListing ? "Deleting..." : "Delete Listing"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
