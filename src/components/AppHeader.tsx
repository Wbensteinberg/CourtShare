"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db, isMockMode } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMockConversationsForUser,
  getMockCourts,
  getMockProfile,
  signOutMockUser,
} from "@/lib/mockData";

export default function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasOwnerListing, setHasOwnerListing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const isLandingPage = pathname === "/";
  const isAuthPage =
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/login" ||
    pathname === "/signup";

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

  useEffect(() => {
    if (!user?.uid) {
      setUnreadMessageCount(0);
      return;
    }

    if (isMockMode) {
      setUnreadMessageCount(
        getMockConversationsForUser(user.uid).filter((conversation) =>
          conversation.unreadBy?.includes(user.uid)
        ).length
      );
      return;
    }

    const conversationsQuery = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        setUnreadMessageCount(
          snapshot.docs.filter((conversationDoc) => {
            const unreadBy = conversationDoc.data().unreadBy;
            return Array.isArray(unreadBy) && unreadBy.includes(user.uid);
          }).length
        );
      },
      (error) => {
        console.error("Error loading unread message count:", error);
        setUnreadMessageCount(0);
      }
    );

    return unsubscribe;
  }, [pathname, user]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const navButtonClass = isLandingPage
    ? "rounded-full border border-white/20 bg-white/10 px-5 text-white backdrop-blur-md hover:bg-white/18 hover:text-white"
    : "rounded-full border border-slate-200 bg-white px-5 font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900";

  const closeAndGo = (path: string) => {
    router.push(path);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (isMockMode) {
        signOutMockUser();
      } else {
        await signOut(auth);
      }
      setMenuOpen(false);
      router.replace("/courts");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const profileInitial =
    user?.displayName?.trim().charAt(0) || user?.email?.trim().charAt(0) || "P";
  const unreadMessageLabel =
    unreadMessageCount > 99 ? "99+" : unreadMessageCount.toString();

  const accountLinks: Array<{
    label: string;
    path: string;
    Icon: ComponentType<{ className?: string }>;
    showUnreadCount?: boolean;
  }> = [
    { label: "Upcoming Bookings", path: "/upcoming", Icon: CalendarDays },
    {
      label: "Messages",
      path: "/messages",
      Icon: MessageSquare,
      showUnreadCount: true,
    },
    ...(hasOwnerListing
      ? [{ label: "Host Dashboard", path: "/host", Icon: LayoutDashboard }]
      : []),
    { label: "Profile", path: "/profile", Icon: CircleUserRound },
  ];

  const guestLinks = (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={navButtonClass}
        onClick={() => closeAndGo("/sign-in")}
      >
        Sign In
      </Button>
      <Button
        size="sm"
        className={
          isLandingPage
            ? "rounded-full bg-white px-5 text-slate-900 shadow-none hover:bg-slate-100"
            : "rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
        }
        onClick={() => closeAndGo("/sign-up")}
      >
        Sign Up
      </Button>
    </>
  );

  return (
    <header
      ref={headerRef}
      className={
        isLandingPage
          ? "absolute inset-x-0 top-0 z-50 w-full"
          : "sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl"
      }
    >
      <div className="relative mx-auto flex h-18 w-full items-center justify-between px-6">
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-xl py-2 pr-4 text-2xl font-black tracking-tight transition-colors",
            isLandingPage
              ? "text-white"
              : "text-brand-logo"
          )}
          onClick={() => closeAndGo("/")}
        >
          CourtShare
        </button>

        <div className="flex items-center gap-2">
          {!user && !isAuthPage && (
            <nav className="flex items-center gap-2">
              {guestLinks}
            </nav>
          )}

          {user && (
            <>
              {hasOwnerListing && (
                <Button
                  variant="ghost"
                  className={cn(
                    "hidden h-11 cursor-pointer gap-2 rounded-full border px-4 text-sm font-bold transition-colors md:inline-flex",
                    isLandingPage
                      ? "border-white/25 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
                  )}
                  onClick={() => closeAndGo("/host")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Host Dashboard
                </Button>
              )}
              <Button
                variant="ghost"
                className={cn(
                  "relative h-11 cursor-pointer gap-2 rounded-full border px-3 text-sm font-bold transition-colors sm:px-4",
                  isLandingPage
                    ? "border-white/25 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
                )}
                onClick={() => closeAndGo("/messages")}
                aria-label={
                  unreadMessageCount > 0
                    ? `Messages, ${unreadMessageCount} unread`
                    : "Messages"
                }
              >
                <MessageSquare className="h-5 w-5" />
                <span className="hidden sm:inline">Messages</span>
                {unreadMessageCount > 0 && (
                  <span
                    className={cn(
                      "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2",
                      "bg-slate-900 ring-white"
                    )}
                  >
                    {unreadMessageLabel}
                  </span>
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-11 w-11 cursor-pointer overflow-hidden rounded-full border p-0 transition-transform hover:scale-105 hover:bg-transparent",
                  isLandingPage
                    ? "border-white/25 bg-white/10"
                    : "border-slate-200 bg-white"
                )}
                onClick={() => closeAndGo("/profile")}
                aria-label="Profile"
                title="Profile"
              >
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={profileImageUrl}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {profileInitial.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-11 w-11 cursor-pointer rounded-full border transition-colors",
              user ? "md:flex" : "hidden",
              isLandingPage
                ? "border-white/25 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
            )}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "absolute right-6 left-6 top-16 z-50 rounded-[28px] border border-slate-200 bg-white p-3 text-slate-950 shadow-2xl sm:left-auto sm:w-80",
          menuOpen ? "block" : "hidden"
        )}
      >
        <nav className="flex flex-col gap-1">
          {user ? (
            <>
              {accountLinks.map(({ Icon, ...link }) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => closeAndGo(link.path)}
                  className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-slate-100 hover:text-slate-950"
                >
                  <span className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-slate-800" />
                    {link.label}
                  </span>
                  {link.showUnreadCount && unreadMessageCount > 0 && (
                    <span className="ml-3 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                      {unreadMessageLabel}
                    </span>
                  )}
                </button>
              ))}
              {!hasOwnerListing && (
                <>
                  <div className="my-1 h-px bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => closeAndGo("/host?tab=courts&addCourt=1")}
                    className="flex items-center justify-between rounded-2xl px-4 py-4 text-left transition-colors hover:bg-slate-100"
                  >
                    <span>
                      <span className="block text-base font-bold text-slate-950">
                        Become a Host
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-500">
                        Have a court? It&apos;s easy to start hosting and earn extra income.
                      </span>
                    </span>
                    <span className="ml-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-black text-[var(--site-accent)]">
                      $
                    </span>
                  </button>
                </>
              )}
              <div className="my-1 h-px bg-slate-200" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-5 w-5" />
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full border border-slate-200 bg-white px-5 font-medium text-slate-900 transition-colors hover:bg-slate-50"
                onClick={() => closeAndGo("/sign-in")}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                onClick={() => closeAndGo("/sign-up")}
              >
                Sign Up
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
