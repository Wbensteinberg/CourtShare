import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

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
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const profileDoc = await adminDb.collection("users").doc(userId).get();
    if (!profileDoc.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: getPublicProfile(profileDoc.id, profileDoc.data() || {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load profile" },
      { status: 500 }
    );
  }
}
