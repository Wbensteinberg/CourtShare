"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, isMockMode } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMockCourts, getMockProfile } from "@/lib/mockData";

export default function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasOwnerListing, setHasOwnerListing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const isLandingPage = pathname === "/courts";

  useEffect(() => {
    const fetchUserHeaderData = async () => {
      if (!user) {
        setHasOwnerListing(false);
        setProfileImageUrl("");
        return;
      }

      if (!user.uid) {
        setHasOwnerListing(false);
        setProfileImageUrl(user.photoURL || "");
        return;
      }

      try {
        if (isMockMode) {
          const mockProfile = getMockProfile(user.uid);
          setHasOwnerListing(
            getMockCourts().some((court) => court.ownerId === user.uid)
          );
          setProfileImageUrl(mockProfile?.profileImageUrl || user.photoURL || "");
          return;
        }

        const [ownerCourts, profileSnap] = await Promise.all([
          getDocs(
            query(collection(db, "courts"), where("ownerId", "==", user.uid))
          ),
          getDoc(doc(db, "users", user.uid)),
        ]);
        const profileData = profileSnap.exists() ? profileSnap.data() : null;

        setHasOwnerListing(!ownerCourts.empty);
        setProfileImageUrl(profileData?.profileImageUrl || user.photoURL || "");
      } catch (error) {
        console.error("Error loading header user data:", error);
        setHasOwnerListing(false);
        setProfileImageUrl(user.photoURL || "");
      }
    };

    fetchUserHeaderData();
  }, [user, pathname]);

  const navButtonClass = isLandingPage
    ? "rounded-full border border-white/20 bg-white/10 px-5 text-white backdrop-blur-md hover:bg-white/18 hover:text-white"
    : "rounded-lg font-medium text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700";

  const closeAndGo = (path: string) => {
    router.push(path);
    setMenuOpen(false);
  };

  const profileInitial =
    user?.displayName?.trim().charAt(0) || user?.email?.trim().charAt(0) || "P";

  const profileButton = (showLabel: boolean) => (
    <Button
      variant="ghost"
      size={showLabel ? "sm" : "icon"}
      className={cn(
        showLabel
          ? navButtonClass
          : "h-10 w-10 rounded-full p-0 transition-transform hover:scale-105",
        !showLabel && isLandingPage
          ? "bg-white/10 text-white hover:bg-white/18 hover:text-white"
          : !showLabel &&
              "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      )}
      onClick={() => closeAndGo("/profile")}
      aria-label="Profile"
      title="Profile"
    >
      {profileImageUrl ? (
        <Avatar className="h-9 w-9 border border-white/60">
          <AvatarImage
            src={profileImageUrl}
            alt="Profile"
            className="object-cover"
          />
          <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-800">
            {profileInitial.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        showLabel ? (
          "Profile"
        ) : (
          <Avatar className="h-9 w-9 border border-white/60">
            <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-800">
              {profileInitial.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )
      )}
    </Button>
  );

  const authedLinks = (showProfileLabel: boolean) => (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={navButtonClass}
        onClick={() => closeAndGo("/messages")}
      >
        Messages
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={navButtonClass}
        onClick={() => closeAndGo("/dashboard/player")}
      >
        Player Dashboard
      </Button>
      {hasOwnerListing && (
        <Button
          variant="ghost"
          size="sm"
          className={navButtonClass}
          onClick={() => closeAndGo("/dashboard/owner")}
        >
          Owner Dashboard
        </Button>
      )}
      {profileButton(showProfileLabel)}
    </>
  );

  const guestLinks = (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={navButtonClass}
        onClick={() => closeAndGo("/login")}
      >
        Sign In
      </Button>
      <Button
        size="sm"
        className={
          isLandingPage
            ? "rounded-full bg-white px-5 text-slate-900 shadow-none hover:bg-slate-100"
            : "rounded-lg bg-emerald-600 px-5 text-white hover:bg-emerald-700"
        }
        onClick={() => closeAndGo("/signup")}
      >
        Sign Up
      </Button>
    </>
  );

  return (
    <header
      className={
        isLandingPage
          ? "absolute inset-x-0 top-0 z-50 w-full"
          : "sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl"
      }
    >
      <div className="relative mx-auto flex h-18 w-full max-w-screen-2xl items-center justify-between px-6">
        <button
          type="button"
          className={cn(
            "rounded-xl px-4 py-2 text-2xl font-black tracking-tight transition-colors",
            isLandingPage
              ? "text-white"
              : "text-brand-logo"
          )}
          onClick={() => closeAndGo("/courts")}
        >
          CourtShare
        </button>

        <nav className="hidden items-center gap-2 md:flex">
          {user ? authedLinks(false) : guestLinks}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className={cn("md:hidden", isLandingPage && "text-white")}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div
        className={cn(
          "border-t md:hidden",
          isLandingPage
            ? "border-white/20 bg-slate-950/95"
            : "border-slate-200 bg-white",
          menuOpen ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-2 px-4 py-4">
          {user ? authedLinks(true) : guestLinks}
        </nav>
      </div>
    </header>
  );
}
