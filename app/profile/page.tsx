"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, getStorageInstance } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/AuthContext";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
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
    crop: PixelCrop,
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        }
      }, 'image/jpeg', 0.9);
    });
  };

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) return;

    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const croppedFile = new File([croppedBlob], 'cropped-profile.jpg', { type: 'image/jpeg' });
      
      setProfileImage(croppedFile);
      setProfileImagePreview(URL.createObjectURL(croppedBlob));
      setShowCropModal(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (error) {
      console.error('Error cropping image:', error);
      setError('Failed to crop image');
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
        const imageRef = ref(storage, `profiles/${user.uid}_${Date.now()}_${profileImage.name}`);
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
      setProfile(prev => prev ? {
        ...prev,
        displayName,
        bio,
        profileImageUrl,
      } : null);
      
      // Clear the file input
      setProfileImage(null);
      
      // Redirect to courts page after successful save
      setTimeout(() => {
        router.push("/courts");
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading profile...</p>
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
            onClick={() => router.push("/courts")}
            className="bg-[#286a3a] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
          >
            Back to Courts
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-[#286a3a] px-4">
        <div className="w-full max-w-lg my-12">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col gap-6 animate-fade-in"
          >
            <div className="flex flex-col items-center mb-2">
              <div className="w-16 h-16 bg-[#e3f1e7] rounded-full flex items-center justify-center mb-2 shadow-md">
                <span className="text-3xl font-bold text-[#286a3a]">👤</span>
              </div>
              <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight mb-1">
                Profile Settings
              </h2>
              <p className="text-gray-500 text-sm">
                Update your profile information
              </p>
            </div>
            
            {/* Profile Image */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={profileImagePreview || "/default-avatar.png"}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <div className="flex-1">
                  <input
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition text-gray-900 caret-gray-900 file:bg-[#e3f1e7] file:border-0 file:rounded-lg file:px-4 file:py-2 file:text-[#286a3a] file:font-semibold hover:cursor-pointer"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload and crop your profile picture
                  </p>
                </div>
              </div>
            </div>
            
            <input
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900"
              type="text"
              placeholder="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#286a3a] transition mb-2 placeholder-gray-400 text-gray-900 caret-gray-900 resize-none"
              placeholder="Tell us about yourself (optional)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
            />
            
            {error && (
              <p className="text-red-500 text-sm mb-2 text-center">{error}</p>
            )}
            
            {success && (
              <p className="text-green-600 text-sm mb-2 text-center">
                Profile updated successfully!
              </p>
            )}
            
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push("/courts")}
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
                    Saving...
                  </span>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>
          </form>
        </div>
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
                Drag and resize the crop area to frame your profile picture perfectly
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
              <button
                onClick={handleCancelCrop}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition hover:cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCropComplete}
                className="px-6 py-3 bg-[#286a3a] text-white rounded-lg font-semibold hover:bg-[#20542e] transition hover:cursor-pointer"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 