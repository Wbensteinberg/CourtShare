import { NextRequest, NextResponse } from "next/server";
import type { Auth } from "firebase-admin/auth";
import { checkRateLimit } from "../../app/api/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type AuthenticatedRequestContext = {
  uid: string;
};

export function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  identifier?: string
) {
  const key = `${scope}:${identifier || getClientIp(req)}:${req.headers.get("user-agent") || "unknown"}`;
  const result = await checkRateLimit(key);

  if (result.allowed) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetTime - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetTime),
      },
    }
  );
}

export function validateMutationOrigin(req: NextRequest) {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const origin = req.headers.get("origin");
  if (!origin) return null;

  const expectedOrigin = req.nextUrl.origin;
  if (origin === expectedOrigin) return null;

  return NextResponse.json(
    { error: "Invalid request origin" },
    { status: 403 }
  );
}

export async function requireFirebaseUser(
  req: NextRequest,
  adminAuth: Auth | undefined | null
): Promise<AuthenticatedRequestContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  if (!adminAuth) {
    return NextResponse.json(
      { error: "Authentication service not initialized" },
      { status: 500 }
    );
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(
      authHeader.split("Bearer ")[1],
      true
    );
    return { uid: decodedToken.uid };
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
