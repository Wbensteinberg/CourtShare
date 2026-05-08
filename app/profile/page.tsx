"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db, getStorageInstance, isMockMode } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
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
import {
  Camera,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  fileToDataUrl,
  getMockCourts,
  getMockProfile,
  signOutMockUser,
  updateMockProfile,
} from "@/lib/mockData";

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
  const [loggingOut, setLoggingOut] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [hasOwnerListing, setHasOwnerListing] = useState(false);

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
      if (!loggingOut) {
        router.push("/login");
      }
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
          setHasOwnerListing(
            getMockCourts().some((court) => court.ownerId === user.uid)
          );
        } else {
          const ownerCourts = await getDocs(
            query(collection(db, "courts"), where("ownerId", "==", user.uid))
          );
          setHasOwnerListing(!ownerCourts.empty);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, router, loggingOut]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setError("");

    try {
      if (isMockMode) {
        signOutMockUser();
      } else {
        await signOut(auth);
      }
      router.replace("/courts");
      router.refresh();
    } catch (err: any) {
      setLoggingOut(false);
      setError(err.message || "Failed to log out");
    }
  };

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

      if (isMockMode) {
        if (profileImage) {
          profileImageUrl = await fileToDataUrl(profileImage);
        }

        await updateMockProfile(user.uid, {
          displayName,
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
          displayName,
          bio,
          profileImageUrl,
        });
      }

      setSuccess(true);

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

      setProfileImage(null);
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

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <AppHeader />

        <main className="w-full">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <h1 className="text-3xl font-bold text-slate-950">Profile</h1>
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                disabled={loggingOut}
                className="h-11 rounded-lg border-slate-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="space-y-6">
                <Card className="overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative">
                        <div className="h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg ring-1 ring-slate-200">
                          <img
                            src={profileImagePreview || "/default-avatar.png"}
                            alt="Profile"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                        {profileImagePreview && (
                          <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <h2 className="mt-4 text-xl font-semibold text-slate-950">
                        {displayName || "Unnamed player"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {profile?.email || user?.email}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-5 w-full rounded-lg border-slate-300"
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
                      <p className="mt-3 text-xs text-slate-500">
                        JPG or PNG works best. You can crop before saving.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {!hasOwnerListing && (
                  <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                      <h2 className="text-lg font-semibold text-slate-950">
                        Have a tennis court? Become an owner and start earning.
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Create your first listing to unlock the owner dashboard.
                      </p>
                      <Button
                        type="button"
                        className="mt-4 w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => router.push("/create-listing")}
                      >
                        List your court
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </aside>

              <section className="space-y-6">
                <Card className="rounded-[32px] border-slate-200 bg-white shadow-sm">
                  <CardHeader className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        Personal information
                      </h2>
                      <p className="text-sm text-slate-500">
                        This information is used across bookings, requests, and owner communication.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="w-fit rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {saving ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                          Saving
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6 p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Full Name
                        </label>
                        <Input
                          type="text"
                          placeholder="Enter your full name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="h-11 rounded-lg border-slate-300 bg-white focus:border-emerald-500 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Email Address
                        </label>
                        <Input
                          type="email"
                          value={user?.email || ""}
                          disabled
                          className="h-11 rounded-lg border-slate-300 bg-slate-50 text-slate-500"
                        />
                        <p className="text-xs text-slate-500">
                          Email cannot be changed
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Bio
                      </label>
                      <textarea
                        placeholder="Tell us about yourself, your tennis experience, or what you're looking for..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={6}
                        className="w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-xs text-slate-500">
                        Share your tennis story, experience level, or what you look for in a court.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <Card className="rounded-[32px] border-red-200 bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <p className="text-red-700">{error}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </section>
            </div>
          </form>
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
