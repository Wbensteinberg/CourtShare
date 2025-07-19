"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  setIsOwner: (isOwner: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isOwner: false,
  setIsOwner: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        try {
          // Fetch isOwner from Firestore
          const { getDoc, doc } = await import("firebase/firestore");
          const { db } = await import("./firebase");
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          setIsOwner(userDoc.exists() ? !!userDoc.data().isOwner : false);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setIsOwner(false);
        }
      } else {
        setIsOwner(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isOwner, setIsOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
