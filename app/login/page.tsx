"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

const googleProvider = new GoogleAuthProvider();

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || "",
          isOwner: false,
        });
      }
      router.push(redirect || "/courts");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          isOwner: false,
        });
      }
      router.push(redirect || "/courts");
    } catch (err: any) {
      setError(err.message || "Login failed");
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
          <LogIn className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Welcome Back</h1>
        <p className="text-white/75 mt-2 text-sm font-medium">
          Sign in to your CourtShare account
        </p>
      </div>

      {/* Card overlapping hero — same pattern as courts page search card */}
      <div className="flex justify-center px-4 -mt-8 pb-16 relative z-10">
        <Card className="w-full max-w-md shadow-elegant rounded-3xl border border-gray-100 overflow-hidden bg-white">
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800 tracking-tight">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors text-sm"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800 tracking-tight">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-12 h-12 border-2 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors text-sm"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-sm font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02]"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-gray-400 text-xs">or</span>
                </div>
              </div>

              {/* Google */}
              <Button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                variant="outline"
                className="w-full h-12 text-sm font-bold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                <svg className="h-4 w-4 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              {/* Footer links */}
              <div className="text-center pt-1 space-y-2">
                <a href="#" className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold hover:underline transition-colors block">
                  Forgot your password?
                </a>
                <div className="border-t border-gray-100 pt-3 space-y-1">
                  <p className="text-gray-500 text-xs">
                    Don&apos;t have an account?{" "}
                    <a
                      href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"}
                      className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
                    >
                      Sign up here
                    </a>
                  </p>
                  <p className="text-gray-400 text-xs">
                    <a href="/terms" className="hover:text-emerald-600 hover:underline transition-colors">Terms</a>
                    {" · "}
                    <a href="/privacy" className="hover:text-emerald-600 hover:underline transition-colors">Privacy</a>
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
