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
  };

  const handleToggleRole = async () => {
    if (!user) return;
    const newIsOwner = !isOwner;
    await updateDoc(doc(db, "users", user.uid), { isOwner: newIsOwner });
    setIsOwner(newIsOwner);
    setMenuOpen(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative h-16 flex items-center px-4 w-full max-w-screen-2xl mx-auto">
        {/* Left: Logo (in container) */}
        <div
          className="flex items-center cursor-pointer"
          onClick={() => router.push("/courts")}
        >
          <span className="text-xl font-bold text-primary hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium rounded-lg px-2 py-1">
            CourtShare
          </span>
        </div>
        {/* Center: Navigation (absolutely centered on desktop) */}
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-x-8">
          {!isOwner && (
            <Button
              variant="ghost"
              className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
              onClick={() => {
                // Scroll to search section
                const searchSection = document.querySelector('[data-search-section]');
                if (searchSection) {
                  searchSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              Find Courts
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/dashboard/owner")}
              >
                View Listings
              </Button>
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => router.push("/create-listing")}
              >
                List Your Court
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
                variant="ghost"
                size="sm"
                className="bg-green-700 text-white hover:bg-green-800 transition-colors duration-200 font-medium hover:cursor-pointer"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
                                            <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleToggleRole}
                 className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
               >
                 Switch to {isOwner ? "Player" : "Owner"} Mode
               </Button>
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
                       e.currentTarget.style.display = 'none';
                       e.currentTarget.nextElementSibling?.classList.remove('hidden');
                     }}
                   />
                 ) : null}
                 <User className={`h-4 w-4 ${profileImageUrl ? 'hidden' : ''}`} />
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
        {/* Hamburger menu always visible on mobile, never hidden by flex */}
        <div className="md:hidden flex items-center justify-end flex-shrink-0 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
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
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                onClick={() => {
                  // Scroll to search section
                  const searchSection = document.querySelector('[data-search-section]');
                  if (searchSection) {
                    searchSection.scrollIntoView({ behavior: 'smooth' });
                  }
                  setMenuOpen(false);
                }}
              >
                Find Courts
              </Button>
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
                  View Listings
                </Button>
                <Button
                  variant="ghost"
                  className="hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    router.push("/create-listing");
                    setMenuOpen(false);
                  }}
                >
                  List Your Court
                </Button>
              </>
            )}
          </nav>
          <div className="flex flex-col space-y-2 pt-4 border-t">
            {!user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                  onClick={() => {
                    router.push("/login");
                    setMenuOpen(false);
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-green-700 text-white hover:bg-green-800 transition-colors duration-200 font-medium hover:cursor-pointer"
                  onClick={() => {
                    router.push("/signup");
                    setMenuOpen(false);
                  }}
                >
                  Sign Up
                </Button>
              </>
            ) : (
              <>
                                                  <Button
                   variant="ghost"
                   size="sm"
                   onClick={handleToggleRole}
                   className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                 >
                   Switch to {isOwner ? "Player" : "Owner"} Mode
                 </Button>
                                   <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer p-0 overflow-hidden rounded-full w-8 h-8"
                    onClick={() => {
                      router.push("/profile");
                      setMenuOpen(false);
                    }}
                    aria-label="Profile"
                  >
                   {profileImageUrl ? (
                     <img
                       src={profileImageUrl}
                       alt="Profile"
                       className="w-full h-full rounded-full object-cover"
                       onError={(e) => {
                         e.currentTarget.style.display = 'none';
                         e.currentTarget.nextElementSibling?.classList.remove('hidden');
                       }}
                     />
                   ) : null}
                   <User className={`h-4 w-4 ${profileImageUrl ? 'hidden' : ''}`} />
                 </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="cursor-pointer hover:cursor-pointer hover:bg-green-50 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Log Out
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
