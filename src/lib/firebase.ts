// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate that all required config values are present (only in browser, not during build)
if (
  typeof window !== "undefined" &&
  (!firebaseConfig.apiKey || !firebaseConfig.projectId)
) {
  console.error(
    "Firebase configuration is missing required values. Please check your environment variables.",
    {
      hasApiKey: !!firebaseConfig.apiKey,
      hasProjectId: !!firebaseConfig.projectId,
    }
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Initialize Firestore with settings that work better in serverless environments
export const db = getFirestore(app);

// Lazy load storage to avoid permissions issues before authentication
let storageInstance: ReturnType<typeof getStorage> | null = null;

export const getStorageInstance = () => {
  if (!storageInstance) {
    storageInstance = getStorage(app);
  }
  return storageInstance;
};
