// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
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

// Validate configuration and log helpful errors
if (typeof window !== "undefined") {
  const missingVars: string[] = [];
  if (!firebaseConfig.apiKey) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.projectId)
    missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!firebaseConfig.authDomain)
    missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");

  if (missingVars.length > 0) {
    console.error(
      "❌ Firebase configuration error: Missing required environment variables:",
      missingVars.join(", "),
      "\n\nPlease ensure these are set in your Vercel project settings:",
      "\n- Go to Vercel Dashboard → Your Project → Settings → Environment Variables",
      "\n- Add all NEXT_PUBLIC_FIREBASE_* variables",
      "\n- Make sure they're enabled for 'Preview' and 'Production' environments",
      "\n- Redeploy after adding variables"
    );
  }
}

// Initialize Firebase (reuse existing app if already initialized)
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

// Lazy load storage to avoid permissions issues before authentication
let storageInstance: ReturnType<typeof getStorage> | null = null;

export const getStorageInstance = () => {
  if (!storageInstance) {
    storageInstance = getStorage(app);
  }
  return storageInstance;
};
