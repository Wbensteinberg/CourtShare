"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Trophy,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  Shield,
  Star,
} from "lucide-react";

const googleProvider = new GoogleAuthProvider();

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const handleGoogleSignup = async () => {
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
      setSuccess(true);
      router.push(redirect || "/courts");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign-up failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      // Create user doc in Firestore with isOwner=false
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        isOwner: false,
      });
      setSuccess(true);
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/courts");
      }
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-20 left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        <Card className="border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] rounded-xl overflow-hidden bg-slate-800/90 backdrop-blur-xl border border-slate-700">
          <CardHeader className="bg-slate-800/90 border-b border-slate-700 p-6 relative overflow-hidden">
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 backdrop-blur-md flex items-center justify-center shadow-xl border border-emerald-500/30">
                <UserPlus className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                  Create Account
                </h2>
                <p className="text-slate-400 text-sm font-medium mt-0.5">
                  Join the CourtShare community
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-slate-800/90">
            <form onSubmit={handleSignup} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-3">
                <label className="block text-sm font-extrabold text-white tracking-tight">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-13 border-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-base font-medium"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label className="block text-sm font-extrabold text-white tracking-tight">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-13 border-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-base font-medium"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Must be at least 6 characters long
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-3">
                <label className="block text-sm font-extrabold text-white tracking-tight">
                  Confirm Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 pr-12 h-13 border-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-base font-medium"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="flex items-center space-x-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl shadow-sm">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center space-x-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl shadow-sm">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-emerald-700 text-sm font-medium">
                    Account created successfully!
                  </p>
                </div>
              )}

              {/* Signup Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 text-base font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02] relative overflow-hidden group"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Create Account
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-slate-800/90 text-slate-400 text-xs font-medium">or</span>
                </div>
              </div>

              {/* Google Sign Up */}
              <Button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading}
                variant="outline"
                className="w-full h-14 text-base font-bold border-2 border-slate-600 bg-slate-700/30 text-white hover:bg-slate-700/60 hover:border-slate-500 rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              {/* Terms and Login Link */}
              <div className="text-center pt-2">
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-2">
                  By creating an account, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </p>
                <div className="border-t border-slate-700 pt-2">
                  <p className="text-slate-400 text-xs font-medium">
                    Already have an account?{" "}
                    <a
                      href={
                        redirect
                          ? `/login?redirect=${encodeURIComponent(redirect)}`
                          : "/login"
                      }
                      className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline transition-colors"
                    >
                      Sign in here
                    </a>
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
