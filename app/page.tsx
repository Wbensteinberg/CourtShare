"use client";

import { useAuth } from "@/src/lib/AuthContext";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading, isOwner, setIsOwner } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleToggleRole = async () => {
    if (!user) return;
    const newIsOwner = !isOwner;
    await updateDoc(doc(db, "users", user.uid), { isOwner: newIsOwner });
    setIsOwner(newIsOwner);
  };

  useEffect(() => {
    router.replace("/courts");
  }, [router]);

  return null;
}
