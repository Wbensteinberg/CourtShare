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
    const isProduction =
      process.env.VERCEL || process.env.NODE_ENV === "production";

    // Try to initialize with service account from environment variables
    // For Vercel, you can set these as environment variables
    // Or use a service account JSON file
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;

    if (isProduction) {
      console.log("[FIREBASE ADMIN] Production environment detected");
      console.log("[FIREBASE ADMIN] Env vars check:", {
        FIREBASE_PROJECT_ID: hasProjectId ? "✓" : "✗",
        FIREBASE_CLIENT_EMAIL: hasClientEmail ? "✓" : "✗",
        FIREBASE_PRIVATE_KEY: hasPrivateKey ? "✓" : "✗",
      });
    }

    if (hasProjectId && hasClientEmail && hasPrivateKey) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(
          /\\n/g,
          "\n"
        );
        // Validate private key format
        if (
          !privateKey.includes("BEGIN PRIVATE KEY") &&
          !privateKey.includes("BEGIN RSA PRIVATE KEY")
        ) {
          throw new Error(
            "FIREBASE_PRIVATE_KEY appears to be malformed - missing BEGIN/END markers"
          );
        }

        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: privateKey,
          }),
        });
        console.log("[FIREBASE ADMIN] Initialized with environment variables");
      } catch (initError: any) {
        console.error(
          "[FIREBASE ADMIN] Error during initialization:",
          initError.message
        );
        console.error("[FIREBASE ADMIN] Error details:", {
          hasProjectId,
          hasClientEmail,
          hasPrivateKey:
            hasPrivateKey && process.env.FIREBASE_PRIVATE_KEY!.length > 0,
          privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
          privateKeyStartsWith:
            process.env.FIREBASE_PRIVATE_KEY?.substring(0, 30) || "N/A",
        });
        throw initError; // Re-throw to be caught by outer catch
      }
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
        console.log(
          "[FIREBASE ADMIN] Initialized with default credentials (local dev)"
        );
      } catch (defaultCredError: any) {
        console.warn(
          "[FIREBASE ADMIN] Default credentials not available:",
          defaultCredError.message
        );
        throw new Error(
          "Firebase Admin not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
        );
      }
    } else {
      // Production without credentials - fail fast with clear error
      const missingVars: string[] = [];
      if (!hasProjectId) missingVars.push("FIREBASE_PROJECT_ID");
      if (!hasClientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
      if (!hasPrivateKey) missingVars.push("FIREBASE_PRIVATE_KEY");

      const errorMsg = `Firebase Admin not initialized. Missing required environment variables: ${missingVars.join(
        ", "
      )}. These must be set in Vercel project settings.`;
      console.error(`[FIREBASE ADMIN] ${errorMsg}`);
      throw new Error(errorMsg);
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
  console.error("[FIREBASE ADMIN] Error stack:", error.stack);
  // In production, log but don't throw to prevent app crash
  // API routes will check for adminDb/adminAuth and return proper errors
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    console.error(
      "[FIREBASE ADMIN] This will cause API routes to fail. Please set Firebase Admin environment variables in Vercel:",
      "\n1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables",
      "\n2. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY",
      "\n3. Make sure they're enabled for 'Preview' and 'Production' environments",
      "\n4. For FIREBASE_PRIVATE_KEY, paste the entire key including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----",
      "\n5. Redeploy after adding variables"
    );
  }
}

export { adminDb, adminAuth };
