import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Menu, X, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppHeader() {
  const { user, isOwner, setIsOwner } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");
  const [currentPath, setCurrentPath] = useState("");

  // Get current path to determine if we should hide the toggle
  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  // Update path when router changes
  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Listen for navigation events
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    setMenuOpen(false);
    router.push("/login");
  };

  const handleToggleRole = async () => {
    if (!user) return;
    const newIsOwner = !isOwner;
    await updateDoc(doc(db, "users", user.uid), { isOwner: newIsOwner });
    setIsOwner(newIsOwner);
    setMenuOpen(false);
  };

  // Check if we should show the role toggle (hide on dashboard pages and create-listing)
  const shouldShowRoleToggle = () => {
    return (
      !currentPath.startsWith("/dashboard/owner") &&
      !currentPath.startsWith("/dashboard/player") &&
      !currentPath.startsWith("/create-listing")
    );
  };

  // Fetch user profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      if (!user) {
        setProfileImageUrl("");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setProfileImageUrl(userData.profileImageUrl || "");
        }
      } catch (error) {
        console.error("Error fetching profile image:", error);
        setProfileImageUrl("");
      }
    };

    fetchProfileImage();
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/30 glass backdrop-blur-2xl supports-[backdrop-filter]:bg-white/85 shadow-sm">
      <div className="relative h-18 flex items-center px-6 w-full max-w-screen-2xl mx-auto">
        {/* Left: Logo (in container) - more refined */}
        <div
          className="flex items-center cursor-pointer group"
          onClick={() => router.push("/courts")}
        >
          <span className="text-2xl font-black bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 bg-clip-text text-transparent hover:from-emerald-700 hover:via-emerald-600 hover:to-teal-700 transition-all duration-500 rounded-xl px-4 py-2 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 tracking-tight">
            CourtShare
          </span>
        </div>
        {/* Center: Navigation (absolutely centered on desktop) */}
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-x-8">
          {!isOwner && (
            <>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/dashboard/player")}
              >
                Player Dashboard
              </Button>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => {
                  router.push("/courts");
                  // Auto-scroll to search section after navigation
                  setTimeout(() => {
                    const searchSection =
                      document.getElementById("search-section");
                    if (searchSection) {
                      searchSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }, 100);
                }}
              >
                Find Courts
              </Button>
            </>
          )}
          {isOwner && (
            <>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/dashboard/owner")}
              >
                Owner Dashboard
              </Button>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/create-listing")}
              >
                Create New Listing
              </Button>
            </>
          )}
        </nav>
        {/* Right: Auth/Profile, truly flush right */}
        <div className="hidden md:flex absolute right-0 top-0 h-full items-center justify-end min-w-[260px] space-x-4 pr-4">
          {!user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/login")}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white transition-all duration-200 font-medium hover:cursor-pointer shadow-md hover:shadow-lg"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
              {shouldShowRoleToggle() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleRole}
                  className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Switch to {isOwner ? "Player" : "Owner"} Mode
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer p-0 overflow-hidden rounded-full w-8 h-8"
                onClick={() => router.push("/profile")}
                aria-label="Profile"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove(
                        "hidden"
                      );
                    }}
                  />
                ) : null}
                <User
                  className={`h-4 w-4 ${profileImageUrl ? "hidden" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2 cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
              >
                Log Out
              </Button>
            </>
          )}
        </div>
        {/* Mobile: Auth buttons (when not logged in) or Profile + Hamburger menu */}
        <div className="md:hidden flex items-center justify-end gap-2 flex-shrink-0 ml-auto">
          {!user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/login")}
              >
                Sign In
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-md hover:shadow-lg transition-all duration-300 font-semibold hover:cursor-pointer rounded-lg"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer p-0 overflow-hidden rounded-full w-8 h-8"
                onClick={() => router.push("/profile")}
                aria-label="Profile"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove(
                        "hidden"
                      );
                    }}
                  />
                ) : null}
                <User
                  className={`h-5 w-5 ${profileImageUrl ? "hidden" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="cursor-pointer"
              >
                {menuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden border-t border-gray-200 bg-background",
          menuOpen ? "block" : "hidden"
        )}
      >
        <div className="container py-4 space-y-4" ref={menuRef}>
          <nav className="flex flex-col space-y-3">
            {!isOwner && (
              <>
                <Button
                  variant="ghost"
                  className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    router.push("/dashboard/player");
                    setMenuOpen(false);
                  }}
                >
                  Player Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    // Scroll to search section
                    const searchSection = document.querySelector(
                      "[data-search-section]"
                    );
                    if (searchSection) {
                      searchSection.scrollIntoView({ behavior: "smooth" });
                    }
                    setMenuOpen(false);
                  }}
                >
                  Find Courts
                </Button>
              </>
            )}
            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    router.push("/dashboard/owner");
                    setMenuOpen(false);
                  }}
                >
                  Owner Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    router.push("/create-listing");
                    setMenuOpen(false);
                  }}
                >
                  Create New Listing
                </Button>
              </>
            )}
          </nav>
          {user && (
            <div className="flex flex-col space-y-2 pt-4 border-t">
              {shouldShowRoleToggle() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleRole}
                  className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Switch to {isOwner ? "Player" : "Owner"} Mode
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
              >
                Log Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
