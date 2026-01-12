// Server-side Firebase Admin SDK initialization
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

// Initialize Firebase Admin (server-side only)
let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let adminAuth: Auth | undefined;

try {
  // Check if already initialized
  if (getApps().length === 0) {
    // In production (Vercel), require explicit credentials - don't use default credentials
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === "production";
    
    // Try to initialize with service account from environment variables
    // For Vercel, you can set these as environment variables
    // Or use a service account JSON file
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
      console.log("[FIREBASE ADMIN] Initialized with environment variables");
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Alternative: Use service account JSON as string
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[FIREBASE ADMIN] Initialized with service account JSON");
    } else if (!isProduction) {
      // Only try default credentials in local development
      // This will work if you have Application Default Credentials set up
      try {
        adminApp = initializeApp({
          projectId:
            process.env.FIREBASE_PROJECT_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log("[FIREBASE ADMIN] Initialized with default credentials (local dev)");
      } catch (defaultCredError: any) {
        console.warn("[FIREBASE ADMIN] Default credentials not available:", defaultCredError.message);
        throw new Error(
          "Firebase Admin not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
        );
      }
    } else {
      // Production without credentials - fail fast with clear error
      throw new Error(
        "Firebase Admin not initialized. Missing required environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be set in Vercel."
      );
    }
  } else {
    adminApp = getApps()[0];
    console.log("[FIREBASE ADMIN] Using existing app instance");
  }

  if (adminApp) {
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    console.log("[FIREBASE ADMIN] Firebase Admin SDK ready");
  }
} catch (error: any) {
  console.error("[FIREBASE ADMIN] Failed to initialize:", error.message);
  // In production, log but don't throw to prevent app crash
  // API routes will check for adminDb/adminAuth and return proper errors
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    console.error("[FIREBASE ADMIN] This will cause API routes to fail. Please set Firebase Admin environment variables in Vercel.");
  }
}

export { adminDb, adminAuth };
