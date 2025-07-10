import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Menu, X, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppHeader() {
  const { user, isOwner, setIsOwner } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative h-16 flex items-center px-4 w-full max-w-screen-2xl mx-auto">
        {/* Left: Logo (in container) */}
        <div
          className="flex items-center min-w-[160px] cursor-pointer"
          onClick={() => router.push("/courts")}
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-primary ml-2">
            CourtShare
          </span>
        </div>
        {/* Center: Navigation (absolutely centered on desktop) */}
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 space-x-8">
          <Button variant="ghost" onClick={() => router.push("/courts")}>
            Find Courts
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/create-listing")}
          >
            List Your Court
          </Button>
        </nav>
        {/* Right: Auth/Profile, truly flush right */}
        <div className="hidden md:flex absolute right-0 top-0 h-full items-center justify-end min-w-[260px] space-x-4 pr-4">
          {!user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/login")}
              >
                Sign In
              </Button>
              <Button
                variant="tennis"
                size="sm"
                onClick={() => router.push("/signup")}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  router.push(
                    isOwner ? "/dashboard/owner" : "/dashboard/player"
                  )
                }
                aria-label="Profile"
              >
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToggleRole}>
                Switch to {isOwner ? "Player" : "Owner"} Mode
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2"
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
          "md:hidden border-t bg-background",
          menuOpen ? "block" : "hidden"
        )}
      >
        <div className="container py-4 space-y-4" ref={menuRef}>
          <nav className="flex flex-col space-y-3">
            <Button
              variant="ghost"
              onClick={() => {
                router.push("/courts");
                setMenuOpen(false);
              }}
            >
              Find Courts
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                router.push("/create-listing");
                setMenuOpen(false);
              }}
            >
              List Your Court
            </Button>
          </nav>
          <div className="flex flex-col space-y-2 pt-4 border-t">
            {!user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    router.push("/login");
                    setMenuOpen(false);
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="tennis"
                  size="sm"
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
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    router.push(
                      isOwner ? "/dashboard/owner" : "/dashboard/player"
                    );
                    setMenuOpen(false);
                  }}
                  aria-label="Profile"
                >
                  <User className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleToggleRole}>
                  Switch to {isOwner ? "Player" : "Owner"} Mode
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
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
