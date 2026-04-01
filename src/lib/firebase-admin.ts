import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

const IS_PRODUCTION =
  process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

const debugLog = (...args: unknown[]) => {
  if (!IS_PRODUCTION) {
    console.log(...args);
  }
};

let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let adminAuth: Auth | undefined;

const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;

function normalizePrivateKey(rawKey: string): string {
  return rawKey
    .replace(/\\\\\\n/g, "\n")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

try {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    debugLog("[FIREBASE ADMIN] Using existing app instance");
  } else if (hasProjectId && hasClientEmail && hasPrivateKey) {
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY!);
    if (
      !privateKey.includes("BEGIN PRIVATE KEY") &&
      !privateKey.includes("BEGIN RSA PRIVATE KEY")
    ) {
      throw new Error("FIREBASE_PRIVATE_KEY is malformed");
    }

    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey,
      }),
    });
    debugLog("[FIREBASE ADMIN] Initialized with environment credentials");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
    debugLog("[FIREBASE ADMIN] Initialized with FIREBASE_SERVICE_ACCOUNT");
  } else if (!IS_PRODUCTION) {
    adminApp = initializeApp({
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    debugLog("[FIREBASE ADMIN] Initialized with local default credentials");
  } else {
    const missingVars: string[] = [];
    if (!hasProjectId) missingVars.push("FIREBASE_PROJECT_ID");
    if (!hasClientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL");
    if (!hasPrivateKey) missingVars.push("FIREBASE_PRIVATE_KEY");
    throw new Error(
      `Missing required Firebase Admin environment variables: ${missingVars.join(
        ", "
      )}`
    );
  }

  if (adminApp) {
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
  }
} catch (error: any) {
  // Keep prod logs concise and avoid leaking credential formatting details.
  console.error("[FIREBASE ADMIN] Initialization failed:", error?.message || error);
}

export { adminDb, adminAuth };
