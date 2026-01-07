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
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Alternative: Use service account JSON as string
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // Fallback: Try to use default credentials (for local development with gcloud)
      // This will work if you have Application Default Credentials set up
      adminApp = initializeApp({
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } else {
    adminApp = getApps()[0];
  }

  if (adminApp) {
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
  }
} catch (error: any) {
  console.error("[FIREBASE ADMIN] Failed to initialize:", error.message);
  // Don't throw - allow the app to continue, but admin operations will fail
}

export { adminDb, adminAuth };
