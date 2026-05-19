import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockPublicProfileGET } from "@/lib/mockApiServer";
import { enforceRateLimit } from "@/lib/apiSecurity";

const serializeMemberSince = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { seconds?: number }).seconds === "number"
  ) {
    const d = new Date(
      (value as { seconds: number }).seconds * 1000 +
        Math.floor(((value as { nanoseconds?: number }).nanoseconds || 0) / 1_000_000)
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
};

const getPublicProfile = (id: string, data: Record<string, any>) => ({
  uid: id,
  displayName:
    typeof data.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim()
      : "CourtShare user",
  bio: typeof data.bio === "string" ? data.bio : "",
  profileImageUrl:
    typeof data.profileImageUrl === "string" ? data.profileImageUrl : "",
  isOwner: Boolean(data.isOwner),
  playerRating:
    typeof data.playerRating === "number" ? data.playerRating : null,
  playerReviewCount:
    typeof data.playerReviewCount === "number" ? data.playerReviewCount : 0,
  ownerRating: typeof data.ownerRating === "number" ? data.ownerRating : null,
  ownerReviewCount:
    typeof data.ownerReviewCount === "number" ? data.ownerReviewCount : 0,
  /** ISO timestamp for account age (same sources as private profile). */
  memberSince: serializeMemberSince(data.createdAt ?? data.memberSince),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId || typeof userId !== "string" || userId.trim().length === 0 || userId.length > 200) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (isMockApiMode()) {
      return mockPublicProfileGET(userId);
    }

    const rateLimitError = await enforceRateLimit(req, "public-profile", userId);
    if (rateLimitError) return rateLimitError;

    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const profileDoc = await adminDb.collection("users").doc(userId).get();
    if (!profileDoc.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const raw = profileDoc.data() || {};
    const profile = getPublicProfile(profileDoc.id, raw);

    const bookingsSnap = await adminDb
      .collection("bookings")
      .where("userId", "==", userId)
      .get();
    const confirmedBookingsCount = bookingsSnap.docs.filter(
      (d) => d.data()?.status === "confirmed"
    ).length;

    const listingsSnap = await adminDb
      .collection("courts")
      .where("ownerId", "==", userId)
      .get();
    const listingsCount = listingsSnap.size;

    return NextResponse.json({
      profile: {
        ...profile,
        confirmedBookingsCount,
        listingsCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load profile" },
      { status: 500 }
    );
  }
}
