"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Camera,
  Edit3,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Trophy,
  MapPin,
  Calendar,
  Star,
} from "lucide-react";

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner: boolean;
}

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");

  // Cropping state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const imgRef = useRef<HTMLImageElement>(null);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          setProfile(userData);
          setDisplayName(userData.displayName || "");
          setBio(userData.bio || "");
          setProfileImagePreview(userData.profileImageUrl || "");
        } else {
          // Create basic profile if it doesn't exist
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

    if (!user) {
      setError("You must be logged in to update your profile.");
      return;
    }

    setSaving(true);

    try {
      let profileImageUrl = profile?.profileImageUrl || "";

      // Upload new profile image if selected
      if (profileImage) {
        const storage = getStorageInstance();
        const imageRef = ref(
          storage,
          `profiles/${user.uid}_${Date.now()}_${profileImage.name}`
        );
        await uploadBytes(imageRef, profileImage);
        profileImageUrl = await getDownloadURL(imageRef);
      }

      // Update user profile in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        bio,
        profileImageUrl,
      });

      setSuccess(true);

      // Update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName,
              bio,
              profileImageUrl,
            }
          : null
      );

      // Clear the file input
      setProfileImage(null);

      // Redirect to courts page after successful save
      router.push("/courts");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30">
        <AppHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md mx-auto text-center shadow-elegant rounded-3xl border-0">
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
        <AppHeader />

        {/* Hero Section - Modernized */}
        <section className="relative overflow-hidden w-full bg-gradient-tennis text-white">
          {/* Background effects */}
          <div className="absolute inset-0">
            <div className="absolute top-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
            <div
              className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-300/10 rounded-full blur-3xl animate-float"
              style={{ animationDelay: "2s" }}
            ></div>
          </div>

          <div className="relative w-full flex flex-col items-center py-16 md:py-20">
            <div className="max-w-4xl w-full mx-auto text-center space-y-6">
              {/* Badge - Modernized */}
              <div className="inline-flex items-center rounded-full glass-dark px-8 py-3 text-sm font-semibold border border-white/25 text-white shadow-glow backdrop-blur-md">
                <User className="h-5 w-5 mr-2.5" />
                Profile Management
              </div>

              {/* Headlines - Modernized */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white">
                  Your Tennis
                  <span className="block bg-gradient-to-r from-yellow-300 via-yellow-200 to-amber-200 bg-clip-text text-transparent mt-2">
                    Profile
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-white/95 max-w-2xl mx-auto leading-relaxed font-medium">
                  Customize your profile to enhance your tennis court booking
                  experience. Add your photo, update your information, and make
                  your profile uniquely yours.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {displayName ? "✓" : "—"}
                  </div>
                  <div className="text-sm text-white/80">Name Set</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {profileImagePreview ? "✓" : "—"}
                  </div>
                  <div className="text-sm text-white/80">Photo Added</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {bio ? "✓" : "—"}
                  </div>
                  <div className="text-sm text-white/80">Bio Added</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content - Modernized */}
        <main className="w-full bg-transparent relative">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Profile Photo Section - Modernized */}
                <Card className="border-0 shadow-elegant rounded-3xl overflow-hidden glass backdrop-blur-xl">
                  <CardHeader className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 text-white border-0 relative overflow-hidden p-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5"></div>
                    <div className="relative z-10">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        Profile Photo
                      </h2>
                      <p className="text-white/90 text-sm font-medium mt-0.5">
                        Add a professional photo to personalize your profile
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                      {/* Current Photo */}
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg">
                          <img
                            src={profileImagePreview || "/default-avatar.png"}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                        {profileImagePreview && (
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Upload Section */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload New Photo
                          </label>
                          <div className="flex items-center space-x-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-2 border-dashed border-gray-300 hover:border-[#286a3a] hover:bg-gray-50"
                              onClick={() =>
                                document
                                  .getElementById("profile-image-input")
                                  ?.click()
                              }
                            >
                              Choose Photo
                            </Button>
                            <input
                              id="profile-image-input"
                              className="hidden"
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                            />
                            <span className="text-sm text-gray-500">
                              JPG, PNG up to 5MB
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Professional
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            High Quality
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            <User className="h-3 w-3 mr-1" />
                            Clear Face
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Personal Information Section */}
                <Card className="border border-gray-200 shadow-lg rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-emerald-50/50 border-b border-emerald-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <Edit3 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">
                          Personal Information
                        </h2>
                        <p className="text-gray-600">
                          Update your basic profile information
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Full Name
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter your full name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <Input
                          type="email"
                          value={user?.email || ""}
                          disabled
                          className="border-gray-300 bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-500">
                          Email cannot be changed
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bio
                      </label>
                      <textarea
                        placeholder="Tell us about yourself, your tennis experience, or what you're looking for..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                      />
                      <p className="text-xs text-gray-500">
                        Share your tennis story, experience level, or what
                        you're looking for in a court
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Status Section - Commented out for now */}
                {/* <Card className="border border-gray-200 shadow-lg rounded-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-emerald-50/50 border-b border-emerald-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <Trophy className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">
                          Account Status
                        </h2>
                        <p className="text-gray-600">
                          Your current account information and privileges
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <User className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-800">
                          Account Type
                        </h3>
                        <p className="text-sm text-gray-600">
                          {profile?.isOwner ? "Court Owner" : "Tennis Player"}
                        </p>
                      </div>

                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-3">
                          <MapPin className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-800">
                          Location
                        </h3>
                        <p className="text-sm text-gray-600">
                          Nationwide Access
                        </p>
                      </div>

                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
                          <Star className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-800">
                          Member Since
                        </h3>
                        <p className="text-sm text-gray-600">Active Member</p>
                      </div>
                    </div>
                  </CardContent>
                </Card> */}

                {/* Success/Error Messages */}
                {error && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <p className="text-red-700">{error}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/courts")}
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Courts
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
