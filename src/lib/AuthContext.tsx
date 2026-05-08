"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, isMockMode } from "./firebase";
import {
  getMockAuthUser,
  getMockProfile,
  setMockUserRole,
  subscribeToMockAuthChanges,
} from "./mockData";

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
    if (isMockMode) {
      const syncMockAuth = () => {
        const mockUser = getMockAuthUser();
        const mockProfile = mockUser ? getMockProfile(mockUser.uid) : null;
        setUser(mockUser);
        setIsOwner(!!mockProfile?.isOwner);
        setLoading(false);
      };

      syncMockAuth();
      return subscribeToMockAuthChanges(syncMockAuth);
    }

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

  const handleSetIsOwner = (nextIsOwner: boolean) => {
    setIsOwner(nextIsOwner);

    if (isMockMode) {
      const mockUser = getMockAuthUser();
      if (mockUser) {
        setMockUserRole(mockUser.uid, nextIsOwner);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isOwner, setIsOwner: handleSetIsOwner }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
