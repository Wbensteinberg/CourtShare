"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db, isMockMode } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { signInMockUser } from "@/lib/mockData";

const googleProvider = new GoogleAuthProvider();

function SignupForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      if (isMockMode) {
        signInMockUser("demo@courtshare.co");
        setSuccess(true);
        router.push(redirect || "/courts");
        router.refresh();
        return;
      }

      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      const googleDisplayName = result.user.displayName?.trim() || "";
      let nextPath = redirect || "/courts";

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: googleDisplayName,
          isOwner: false,
        });
      } else if (!String(userSnap.data().displayName || "").trim()) {
        if (googleDisplayName) {
          await setDoc(userRef, { displayName: googleDisplayName }, { merge: true });
        } else {
          nextPath = "/profile";
        }
      }

      if (!googleDisplayName && (!userSnap.exists() || !String(userSnap.data().displayName || "").trim())) {
        nextPath = "/profile";
      }
      setSuccess(true);
      router.push(nextPath);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign-up failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />

      {/* Green hero strip — matches courts page */}
      <div className="w-full bg-gradient-tennis py-14 px-4 flex flex-col items-center text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4 shadow-glow">
          <UserPlus className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Join CourtShare</h1>
        <p className="text-white/75 mt-2 text-sm font-medium">
          Create your account securely with Google
        </p>
      </div>

      {/* Card overlapping hero — same pattern as courts page search card */}
      <div className="flex justify-center px-4 -mt-8 pb-16 relative z-10">
        <Card className="w-full max-w-md shadow-elegant rounded-3xl border border-gray-100 overflow-hidden bg-white">
          <CardContent className="p-8">
            <div className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-emerald-700 text-sm">Account created successfully!</p>
                </div>
              )}

              <Button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading}
                variant="outline"
                className="w-full h-12 text-sm font-bold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent mr-3" />
                ) : (
                  <svg className="h-4 w-4 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {loading ? "Opening Google..." : "Continue with Google"}
              </Button>

              <div className="rounded-2xl bg-slate-50 p-4 text-center text-xs leading-5 text-slate-500">
                CourtShare uses Google sign-up so every player and owner starts
                with a trusted account identity. If Google does not provide a
                name, we will ask you to complete your profile.
              </div>

              <div className="text-center pt-1 space-y-2">
                <p className="text-gray-400 text-xs leading-relaxed">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </p>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-gray-500 text-xs">
                    Already have an account?{" "}
                    <a
                      href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"}
                      className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
                    >
                      Sign in here
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
