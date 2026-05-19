import { adminDb } from "@/lib/firebase-admin";
import { createMockApiSeedData } from "@/lib/mockApiSeed";
import { DEFAULT_OG_IMAGE, getAbsoluteUrl } from "@/lib/shareMetadataConstants";

export type CourtSharePreviewCourt = {
  name: string;
  location?: string;
  imageUrl?: string;
  imageUrls?: string[];
  rating?: number;
  reviewCount?: number;
};

export function getCourtMainImage(court: CourtSharePreviewCourt): string {
  const imageUrl = court.imageUrls?.[0] || court.imageUrl || DEFAULT_OG_IMAGE;
  return imageUrl.startsWith("http") ? imageUrl : getAbsoluteUrl(DEFAULT_OG_IMAGE);
}

export function formatCourtRating(court: CourtSharePreviewCourt): string {
  if (typeof court.rating !== "number" || court.reviewCount === 0) {
    return "New!";
  }

  return `★${court.rating.toFixed(1)}`;
}

export async function getCourtForShareMetadata(
  courtId: string
): Promise<CourtSharePreviewCourt | null> {
  if (!courtId) return null;

  if (
    process.env.NODE_ENV !== "production" &&
    (process.env.MOCK_API === "true" ||
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true")
  ) {
    const court = createMockApiSeedData().courts.find((row) => row.id === courtId);
    return court || null;
  }

  if (!adminDb) return null;

  const courtDoc = await adminDb.collection("courts").doc(courtId).get();
  if (!courtDoc.exists) return null;

  const data = courtDoc.data() || {};
  return {
    name: typeof data.name === "string" ? data.name : "CourtShare court",
    location: typeof data.location === "string" ? data.location : undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    imageUrls: Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((url): url is string => typeof url === "string")
      : undefined,
    rating: typeof data.rating === "number" ? data.rating : undefined,
    reviewCount: typeof data.reviewCount === "number" ? data.reviewCount : undefined,
  };
}
