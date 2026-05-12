import { isMockApiMode } from "@/lib/mockApiMode";

/** Matches `getMockAuthUser().getIdToken()` in [src/lib/mockData.ts](src/lib/mockData.ts). */
export const MOCK_FIREBASE_ID_TOKEN = "mock-id-token";

export const MOCK_PRIMARY_USER_UID = "mock-user-1";

/**
 * Resolves the signed-in user id for mock API routes.
 * Returns null if not mock mode, wrong token, or missing header.
 */
export const tryGetMockApiUserId = (authHeader: string | null): string | null => {
  if (!isMockApiMode()) return null;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (token !== MOCK_FIREBASE_ID_TOKEN) return null;
  return MOCK_PRIMARY_USER_UID;
};
