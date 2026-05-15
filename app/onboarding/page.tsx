"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, getStorageInstance, isMockMode } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { getMockProfile, updateMockProfile } from "@/lib/mockData";

function OnboardingForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const [displayName, setDisplayName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(redirect ? `/sign-in?redirect=${encodeURIComponent(redirect)}` : "/sign-in");
    }
  }, [authLoading, user, router, redirect]);

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      if (isMockMode) {
        const profile = getMockProfile(user.uid);
        setDisplayName(profile?.displayName || user.displayName || "");
        setProfileImageUrl(profile?.profileImageUrl || user.photoURL || "");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(String(data.displayName || user.displayName || "").trim());
          setProfileImageUrl(data.profileImageUrl || user.photoURL || "");
        } else {
          setDisplayName(user.displayName?.trim() || "");
          setProfileImageUrl(user.photoURL || "");
        }
      } catch {
        setDisplayName(user.displayName?.trim() || "");
        setProfileImageUrl(user.photoURL || "");
      }
    };

    load();
  }, [authLoading, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user) return;
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (isMockMode) {
        updateMockProfile(user.uid, { displayName: trimmedName });
        router.push(redirect || "/");
        return;
      }

      let photoUrl = profileImageUrl;

      if (selectedFile) {
        const storage = getStorageInstance();
        if (storage) {
          const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`);
          await uploadBytes(storageRef, selectedFile);
          photoUrl = await getDownloadURL(storageRef);
        }
      }

      await setDoc(
        doc(db, "users", user.uid),
        { displayName: trimmedName, profileImageUrl: photoUrl },
        { merge: true }
      );

      router.push(redirect || "/");
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <LoadingScreen message="Loading" detail="Setting up your account." />;
  }

  const avatarSrc = previewUrl || profileImageUrl;
  const nameInitial = displayName.trim().charAt(0) || user?.email?.charAt(0) || "P";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                  Welcome to CourtShare
                </h1>
                <p className="text-sm font-medium leading-6 text-slate-500">
                  Let&apos;s set up your profile before you start booking.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative cursor-pointer"
                  aria-label="Upload profile photo"
                >
                  <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                    <AvatarImage src={avatarSrc} alt="Profile photo" className="object-cover" />
                    <AvatarFallback className="bg-emerald-100 text-3xl font-bold text-emerald-800">
                      {nameInitial.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-6 w-6 text-white" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {selectedFile ? "Change photo" : "Add profile photo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="displayName"
                  className="text-sm font-semibold text-slate-700"
                >
                  Your name
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Enter your full name"
                  className="h-12 rounded-2xl border-2 border-gray-200 focus:border-emerald-400"
                  maxLength={60}
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-red-600">{error}</p>
              )}

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !displayName.trim()}
                className="h-12 w-full rounded-2xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Continue to CourtShare"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading" detail="Setting up your account." />}>
      <OnboardingForm />
    </Suspense>
  );
}
