"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LogIn,
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
} from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      // Ensure user doc exists in Firestore
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          isOwner: false,
        });
      }
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/courts");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 flex items-center justify-center py-12 px-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-200/10 rounded-full blur-3xl animate-float"></div>
        <div
          className="absolute bottom-20 left-20 w-80 h-80 bg-teal-200/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="border-0 shadow-elegant rounded-3xl overflow-hidden glass backdrop-blur-xl">
          <CardHeader className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white p-8">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/30">
                <LogIn className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  Sign In
                </h2>
                <p className="text-white/90 font-medium mt-1">
                  Welcome back to CourtShare
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 bg-white">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-900 tracking-tight">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-13 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-300 text-base font-medium"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl shadow-sm">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 text-base font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 shadow-xl hover:shadow-glow-hover transition-all duration-300 rounded-2xl transform hover:scale-[1.02] relative overflow-hidden group"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign In
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                  </>
                )}
              </Button>

              {/* Links */}
              <div className="text-center space-y-4 pt-2">
                <a
                  href="#"
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold hover:underline transition-colors"
                >
                  Forgot your password?
                </a>
                <div className="border-t border-gray-200 pt-6">
                  <p className="text-gray-600 text-sm font-medium">
                    Don't have an account?{" "}
                    <a
                      href={
                        redirect
                          ? `/signup?redirect=${encodeURIComponent(redirect)}`
                          : "/signup"
                      }
                      className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
                    >
                      Sign up here
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

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
