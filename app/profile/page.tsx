"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, getStorageInstance, isMockMode } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Pencil,
  Star,
  User,
} from "lucide-react";
import {
  fileToDataUrl,
  getMockBookingsForUser,
  getMockCourtById,
  getMockCourts,
  getMockProfile,
  getMockReviewsForTarget,
  type MockReview,
  updateMockProfile,
} from "@/lib/mockData";
import {
  formatBookingDateWithDay,
  isPastOrInactiveBooking,
  sortBookingsAscending,
} from "@/lib/bookingDates";

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner: boolean;
  playerReviewCount?: number;
  playerRating?: number;
  ownerReviewCount?: number;
  ownerRating?: number;
  createdAt?: any;
}

interface Booking {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  durationMinutes?: number;
  status: string;
  courtNumber?: number;
}

interface Court {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  ownerId?: string;
  surface?: string;
  indoor?: boolean;
}

interface PublicReview {
  id: string;
  bookingId: string;
  courtId: string;
  reviewerId?: string;
  ownerId?: string;
  reviewerName?: string;
  reviewerProfileImageUrl?: string;
  reviewerRole?: string;
  targetType?: string;
  rating: number;
  comment: string;
  createdAt?: string | null;
}

type ProfileTab = "about" | "past" | "reviews";

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

  const getProfileDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const getStatusBadge = (status: string) => (
  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">
    {status}
  </span>
);

const formatReviewDate = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const getMonthCount = (createdAt: any) => {
  const start = getProfileDate(createdAt);
  if (!start) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth()
  );
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("about");
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [hasOwnerListing, setHasOwnerListing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courtsById, setCourtsById] = useState<Record<string, Court>>({});
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  // Cropping state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const imgRef = useRef<HTMLImageElement>(null);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "past" || requestedTab === "reviews") {
      setActiveTab(requestedTab);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      try {
        if (isMockMode) {
          const userData = getMockProfile(user.uid) as UserProfile | null;
          if (userData) {
            setProfile(userData);
            setDisplayName(userData.displayName || "");
            setBio(userData.bio || "");
            setProfileImagePreview(userData.profileImageUrl || "");
          }
        } else {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            setProfile(userData);
            setDisplayName(userData.displayName || "");
            setBio(userData.bio || "");
            setProfileImagePreview(userData.profileImageUrl || "");
          } else {
            const basicProfile: UserProfile = {
              uid: user.uid,
              email: user.email || "",
              displayName: "",
              bio: "",
              profileImageUrl: "",
              isOwner: false,
            };
            setProfile(basicProfile);
          }
        }

        if (isMockMode && !getMockProfile(user.uid)) {
          const basicProfile: UserProfile = {
            uid: user.uid,
            email: user.email || "",
            displayName: "",
            bio: "",
            profileImageUrl: "",
            isOwner: false,
          };
          setProfile(basicProfile);
        }

        if (isMockMode) {
          const ownerCourts = getMockCourts().filter(
            (court) => court.ownerId === user.uid
          ) as Court[];
          setHasOwnerListing(ownerCourts.length > 0);

          const userBookings = getMockBookingsForUser(user.uid) as Booking[];
          setBookings(userBookings);
          setCourtsById(
            Object.fromEntries(
              [
                ...userBookings
                  .map((booking) => getMockCourtById(booking.courtId) as Court | null)
                  .filter((court): court is Court => Boolean(court)),
                ...ownerCourts,
              ]
                .map((court) => [court.id, court])
            )
          );
          setReviews(
            getMockReviewsForTarget(user.uid).map((review: MockReview) => ({
              id: review.id,
              bookingId: review.bookingId,
              courtId: review.courtId,
              reviewerId: review.reviewerId,
              ownerId: review.ownerId,
              reviewerName:
                getMockProfile(review.reviewerId)?.displayName ||
                "CourtShare player",
              reviewerProfileImageUrl:
                getMockProfile(review.reviewerId)?.profileImageUrl || "",
              reviewerRole: review.reviewerRole,
              targetType: review.targetType,
              rating: review.rating,
              comment: review.comment,
              createdAt: review.createdAt,
            }))
          );
        } else {
          const ownerCourts = await getDocs(
            query(collection(db, "courts"), where("ownerId", "==", user.uid))
          );
          setHasOwnerListing(!ownerCourts.empty);
          const ownerCourtEntries = ownerCourts.docs.map(
            (courtDoc) =>
              [courtDoc.id, { id: courtDoc.id, ...courtDoc.data() } as Court] as [
                string,
                Court,
              ]
          );

          const bookingsSnapshot = await getDocs(
            query(collection(db, "bookings"), where("userId", "==", user.uid))
          );
          const userBookings = bookingsSnapshot.docs.map((bookingDoc) => ({
            id: bookingDoc.id,
            ...bookingDoc.data(),
          })) as Booking[];
          setBookings(userBookings);

          const uniqueCourtIds = Array.from(
            new Set(userBookings.map((booking) => booking.courtId))
          );
          const courtEntries = await Promise.all(
            uniqueCourtIds.map(async (courtId) => {
              const courtSnap = await getDoc(doc(db, "courts", courtId));
              return courtSnap.exists()
                ? [courtSnap.id, { id: courtSnap.id, ...courtSnap.data() } as Court]
                : null;
            })
          );
          setCourtsById(
            Object.fromEntries([
              ...courtEntries.filter(
                (entry): entry is [string, Court] => Boolean(entry)
              ),
              ...ownerCourtEntries,
            ])
          );

          const reviewsRes = await fetch(
            `/api/reviews?targetUserId=${encodeURIComponent(user.uid)}`
          );
          const reviewsData = await reviewsRes.json().catch(() => ({}));
          setReviews(reviewsRes.ok ? reviewsData.reviews || [] : []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      const imageUrl = URL.createObjectURL(file);
      setOriginalImageUrl(imageUrl);
      setShowCropModal(true);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerAspectCrop(width, height, 1);
    setCrop(crop);
  };

  const getCroppedImg = (
    image: HTMLImageElement,
    crop: PixelCrop
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          }
        },
        "image/jpeg",
        0.9
      );
    });
  };

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) return;

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const croppedFile = new File([croppedBlob], "cropped-profile.jpg", {
        type: "image/jpeg",
      });

      setProfileImage(croppedFile);
      setProfileImagePreview(URL.createObjectURL(croppedBlob));
      setShowCropModal(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (error) {
      console.error("Error cropping image:", error);
      setError("Failed to crop image");
    }
  };

  const handleCancelCrop = () => {
    setShowCropModal(false);
    setProfileImage(null);
    setOriginalImageUrl("");
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    const trimmedDisplayName = displayName.trim();

    if (!user) {
      setError("You must be logged in to update your profile.");
      return;
    }

    if (!trimmedDisplayName) {
      setError("Please enter your full name.");
      return;
    }

    setSaving(true);

    try {
      let profileImageUrl = profile?.profileImageUrl || "";

      if (isMockMode) {
        if (profileImage) {
          profileImageUrl = await fileToDataUrl(profileImage);
        }

        await updateMockProfile(user.uid, {
          displayName: trimmedDisplayName,
          bio,
          profileImageUrl,
        });
      } else {
        if (profileImage) {
          const storage = getStorageInstance();
          const imageRef = ref(
            storage,
            `profiles/${user.uid}_${Date.now()}_${profileImage.name}`
          );
          await uploadBytes(imageRef, profileImage);
          profileImageUrl = await getDownloadURL(imageRef);
        }

        await updateDoc(doc(db, "users", user.uid), {
          displayName: trimmedDisplayName,
          bio,
          profileImageUrl,
        });

        const conversationSnapshot = await getDocs(
          query(
            collection(db, "conversations"),
            where("participantIds", "array-contains", user.uid)
          )
        );
        await Promise.all(
          conversationSnapshot.docs.map((conversationDoc) => {
            const conversation = conversationDoc.data();
            const updates: Record<string, string> = {};
            if (conversation.playerId === user.uid) {
              updates.playerName = trimmedDisplayName;
            }
            if (conversation.ownerId === user.uid) {
              updates.ownerName = trimmedDisplayName;
            }
            return Object.keys(updates).length > 0
              ? updateDoc(conversationDoc.ref, updates)
              : Promise.resolve();
          })
        );
      }

      setSuccess(true);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: trimmedDisplayName,
              bio,
              profileImageUrl,
            }
          : null
      );

      setProfileImage(null);
      setSuccess(true);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen
        message="Loading Your Profile"
        detail="Pulling together your bookings, reviews, and profile details."
      />
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md mx-auto text-center shadow-elegant rounded-[32px] border-0">
            <CardContent className="p-10">
              <div className="text-6xl mb-6">❌</div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
                Error
              </h2>
              <p className="text-gray-600 mb-8 font-medium">{error}</p>
              <Button
                onClick={() => router.push("/courts")}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Courts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const profileName =
    displayName.trim() ||
    profile?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "CourtShare player";
  const profileInitial = profileName.charAt(0).toUpperCase();
  const bookingList = bookings ?? [];
  const ownerListings = Object.values(courtsById).filter(
    (court) => court.ownerId === user?.uid
  );
  const pastBookings = bookingList
    .filter((booking) => booking.status === "completed")
    .sort(sortBookingsAscending);
  const confirmedTrips = bookingList.filter(
    (booking) => booking.status === "confirmed"
  ).length;
  const reviewCount =
    typeof profile?.playerReviewCount === "number"
      ? profile.playerReviewCount
      : reviews.length;
  const playerRating =
    typeof profile?.playerRating === "number"
      ? profile.playerRating
      : reviews.length > 0
        ? reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length
        : 0;
  const reviewSummary =
    reviewCount > 0
      ? `${playerRating.toFixed(1)} (${reviewCount} ${
          reviewCount === 1 ? "review" : "reviews"
        })`
      : "No reviews";
  const playerReviews = reviews.filter(
    (review) => review.reviewerRole === "owner" || review.targetType === "player"
  );
  const playerReviewSummary =
    playerReviews.length > 0
      ? `${(
          playerReviews.reduce((total, review) => total + review.rating, 0) /
          playerReviews.length
        ).toFixed(1)} (${playerReviews.length} ${
          playerReviews.length === 1 ? "review" : "reviews"
        })`
      : "No reviews";
  const hostReviewCount =
    typeof profile?.ownerReviewCount === "number"
      ? profile.ownerReviewCount
      : reviews.filter((review) => review.reviewerRole === "player").length;
  const completedPastBookingCount = pastBookings.length;
  const monthsOnCourtShare = getMonthCount(profile?.createdAt);
  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "about", label: "About Me" },
    { id: "past", label: "Past Bookings" },
    { id: "reviews", label: "My Reviews" },
  ];

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <AppHeader />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="border-b border-slate-200 pb-6">
            <h1 className="text-4xl font-black tracking-tight text-slate-950">
              Profile
            </h1>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <nav className="space-y-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsEditing(false);
                      setSuccess(false);
                    }}
                    className={`flex w-full items-center gap-5 rounded-[32px] px-6 py-5 text-left text-base font-bold transition ${
                      activeTab === tab.id && !isEditing
                        ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-100"
                        : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-pink-50 text-lg font-black text-pink-700">
                      {tab.id === "about" ? (
                        <User className="h-5 w-5 text-slate-500" />
                      ) : (
                        <>
                          {tab.id === "past" ? (
                            <Calendar className="h-5 w-5 text-slate-500" />
                          ) : (
                            <Star className="h-5 w-5 text-slate-500" />
                          )}
                        </>
                      )}
                    </span>
                    {tab.label}
                  </button>
                ))}
              </nav>

              {!hasOwnerListing && (
                <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold text-slate-950">
                      Have a court? List it now to start earning.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Create your first listing to unlock the host dashboard.
                    </p>
                    <Button
                      type="button"
                      className="mt-5 w-full rounded-2xl bg-[var(--site-accent)] text-white hover:bg-[var(--site-accent-hover)]"
                      onClick={() => router.push("/host?tab=courts&addCourt=1")}
                    >
                      Create a Listing
                    </Button>
                  </CardContent>
                </Card>
              )}
            </aside>

            <section className="space-y-8">
              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-3xl font-black tracking-tight text-slate-950">
                        Edit Profile
                      </h2>
                      <p className="mt-2 text-slate-500">
                        Update the details other players and hosts see.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setError("");
                          setSuccess(false);
                          setDisplayName(profile?.displayName || "");
                          setBio(profile?.bio || "");
                          setProfileImagePreview(profile?.profileImageUrl || "");
                          setProfileImage(null);
                        }}
                        className="rounded-2xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={saving}
                        className="rounded-2xl bg-[var(--site-accent)] text-white hover:bg-[var(--site-accent-hover)]"
                      >
                        {saving ? "Saving..." : "Save profile"}
                      </Button>
                    </div>
                  </div>

                  <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-6 p-6">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-pink-50 text-pink-700">
                          {profileImagePreview ? (
                            <img
                              src={profileImagePreview}
                              alt="Profile"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl font-black">
                              {profileInitial}
                            </div>
                          )}
                          {profileImagePreview && (
                            <div className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--site-accent)] text-white shadow-sm">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-slate-300"
                            onClick={() =>
                              document
                                .getElementById("profile-image-input")
                                ?.click()
                            }
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            Change photo
                          </Button>
                          <input
                            id="profile-image-input"
                            className="hidden"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                          <p className="mt-2 text-sm text-slate-500">
                            JPG or PNG works best. You can crop before saving.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Full Name
                          </label>
                          <Input
                            type="text"
                            placeholder="Enter your full name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="h-12 rounded-2xl border-slate-300 bg-white focus:border-[var(--site-accent)] focus:ring-[var(--site-accent)]"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Email Address
                          </label>
                          <Input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="h-12 rounded-2xl border-slate-300 bg-slate-50 text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                          Bio
                        </label>
                        <textarea
                          placeholder="Tell players and hosts a little about your background and tennis experience."
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          rows={6}
                          className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm focus:border-[var(--site-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)]"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </form>
              ) : activeTab === "about" ? (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      About Me
                    </h2>
  
                    <Button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setSuccess(false);
                        setError("");
                      }}
                      className="w-fit rounded-2xl bg-slate-100 px-6 text-slate-900 hover:bg-slate-200"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>

                  <div
                    className={`grid gap-6 ${
                      hasOwnerListing ? "xl:grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    <Card className="w-full rounded-[32px] border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                      <CardContent className="p-8 sm:p-10">
                        <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-400">
                          Player Profile
                        </p>
                        <div className="mt-6 space-y-6">
                          <div className="flex items-center gap-5">
                            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-pink-50 text-pink-700">
                              {profileImagePreview ? (
                                <img
                                  src={profileImagePreview}
                                  alt={profileName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-4xl font-black">
                                  {profileInitial}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-2xl font-black tracking-tight text-slate-950">
                                {profileName}
                              </h3>
                              <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--site-accent)]">
                                Player
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-2xl font-black text-slate-950">
                                {confirmedTrips}
                              </p>
                              <p className="text-xs font-semibold text-slate-600">
                                Bookings
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-slate-950">
                                {reviewCount}
                              </p>
                              <p className="text-xs font-semibold text-slate-600">
                                Reviews
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-slate-950">
                                {monthsOnCourtShare}
                              </p>
                              <p className="text-xs font-semibold text-slate-600">
                                Months
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-6 border-t border-slate-200 pt-5 text-base leading-7 text-slate-600">
                          {profile?.bio || "No bio added."}
                        </p>
                      </CardContent>
                    </Card>

                    {hasOwnerListing && (
                      <Card className="w-full rounded-[32px] border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                        <CardContent className="p-8 sm:p-10">
                          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-slate-400">
                            Host Profile
                          </p>
                          <div className="mt-6 space-y-6">
                            <div className="flex items-center gap-5">
                              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-pink-50 text-pink-700">
                                {profileImagePreview ? (
                                  <img
                                    src={profileImagePreview}
                                    alt={profileName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-4xl font-black">
                                    {profileInitial}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-2xl font-black tracking-tight text-slate-950">
                                  {profileName}
                                </h3>
                                <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--site-accent)]">
                                  Host
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-2xl font-black text-slate-950">
                                  {ownerListings.length}
                                </p>
                                <p className="text-xs font-semibold text-slate-600">
                                  Listings
                                </p>
                              </div>
                              <div>
                                <p className="text-2xl font-black text-slate-950">
                                  {hostReviewCount}
                                </p>
                                <p className="text-xs font-semibold text-slate-600">
                                  Reviews
                                </p>
                              </div>
                              <div>
                                <p className="text-2xl font-black text-slate-950">
                                  {monthsOnCourtShare}
                                </p>
                                <p className="text-xs font-semibold text-slate-600">
                                  Months
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="mt-6 border-t border-slate-200 pt-5 text-base leading-7 text-slate-600">
                            {profile?.bio ||
                              "No bio added."}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              ) : activeTab === "reviews" ? (
                <>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h2 className="text-3xl font-black tracking-tight text-slate-950">
                        My Reviews
                      </h2>
                      <span className="text-base font-semibold text-slate-400">
                        {playerReviewSummary}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-500">
                      Your player reviews written by court hosts from completed bookings.
                    </p>
                    {hasOwnerListing && (
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        To see your host reviews, go to the{" "}
                        <button
                          type="button"
                          onClick={() => router.push("/host?tab=reviews")}
                          className="font-extrabold text-[var(--site-accent)] underline-offset-4 hover:underline"
                        >
                          Host Dashboard
                        </button>
                        .
                      </p>
                    )}
                    {playerReviews.length === 0 ? (
                      <Card className="mt-6 rounded-[32px] border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-8 text-slate-600">
                          You have no reviews yet.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="mt-8 grid gap-8 md:grid-cols-2">
                        {playerReviews.map((review) => {
                          const court = courtsById[review.courtId];
                          const reviewerName =
                            review.reviewerName?.trim() || "Court host";
                          const reviewerImageUrl =
                            review.reviewerProfileImageUrl || "";
                          return (
                          <button
                            type="button"
                            key={review.id}
                            onClick={() => router.push(`/booking/${review.bookingId}`)}
                            className="rounded-[32px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-11 w-11 border border-slate-200">
                                    <AvatarImage
                                      src={reviewerImageUrl}
                                      alt={reviewerName}
                                    />
                                    <AvatarFallback className="bg-slate-100 text-sm font-bold text-slate-700">
                                      {reviewerName.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="truncate text-lg font-black text-slate-950">
                                    {reviewerName}
                                  </p>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-slate-500">
                                  <span className="text-slate-700">
                                    {court?.name || "Court booking"}
                                  </span>
                                  <span className="text-slate-300">/</span>
                                  <span>{formatReviewDate(review.createdAt)}</span>
                                </div>
                              </div>
                              <div className="flex gap-0.5 text-amber-400">
                                {Array.from({ length: 5 }).map((_, star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star < review.rating
                                        ? "fill-amber-400"
                                        : "text-slate-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="mt-5 text-lg leading-8 text-slate-900">
                              {review.comment || "No written review provided."}
                            </p>
                          </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h2 className="text-3xl font-black tracking-tight text-slate-950">
                        Past Bookings
                      </h2>
                      <span className="text-base font-semibold text-slate-400">
                        ({completedPastBookingCount})
                      </span>
                    </div>
                    <p className="mt-2 text-slate-500">
                      Your completed bookings are listed chronologically.
                    </p>
                  </div>

                  {pastBookings.length === 0 ? (
                    <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-8 text-slate-600">
                        You do not have any completed bookings yet.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pastBookings.map((booking) => {
                        const court = courtsById[booking.courtId];
                        const courtName = court?.name || "Court booking";
                        return (
                          <div
                            key={booking.id}
                            className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-5 text-left shadow-sm sm:grid-cols-[120px_minmax(0,1fr)]"
                          >
                            <div className="h-24 overflow-hidden rounded-[24px] bg-slate-100">
                              {court?.imageUrl ? (
                                <img
                                  src={court.imageUrl}
                                  alt={courtName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                                  Court
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-lg font-black text-slate-950">
                                  {courtName}
                                </h3>
                                {getStatusBadge(booking.status)}
                              </div>
                              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
                                  <span className="inline-flex items-center">
                                    <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                                    {formatBookingDateWithDay(booking.date)}
                                  </span>
                                  <span className="inline-flex items-center">
                                    <Clock className="mr-2 h-4 w-4 text-slate-400" />
                                    {booking.time} for {booking.duration}h
                                  </span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit rounded-lg border-slate-300 px-4"
                                  onClick={() => router.push(`/booking/${booking.id}`)}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {(error || success) && (
                <Card
                  className={`rounded-[32px] ${
                    error
                      ? "border-red-200 bg-red-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {error ? (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      )}
                      <p className={error ? "text-red-700" : "text-emerald-700"}>
                        {error || "Profile updated."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Crop Your Profile Picture
              </h3>
              <p className="text-gray-600">
                Drag and resize the crop area to frame your profile picture
                perfectly
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="max-w-md w-full">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={originalImageUrl}
                    onLoad={onImageLoad}
                    className="max-w-full h-auto"
                  />
                </ReactCrop>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={handleCancelCrop}
                className="px-6 py-3"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropComplete}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg transition-all duration-300"
              >
                Apply Crop
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
