"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type CourtListingGalleryCourt = {
  name: string;
  location: string;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  indoor?: boolean;
  surface?: string;
  rating?: number;
  reviewCount?: number;
  amenities?: string[];
};

type LatestCourtReview = {
  rating: number;
  comment?: string;
} | null;

type CourtListingGalleryCardProps = {
  /** Resets carousel when navigating between listings. */
  listingKey: string;
  court: CourtListingGalleryCourt;
  latestCourtReview?: LatestCourtReview;
  onOpenCourtReviews: () => void;
  /** When set, shows hourly rate under the rating row (court checkout page). */
  hourlyPriceDollars?: number;
  hideDescription?: boolean;
  hideLatestCourtReview?: boolean;
  hideAmenities?: boolean;
  /** When true, shows 3-line description preview + "See more" link instead of amenities */
  descriptionPreviewCourtId?: string;
  onTitleClick?: () => void;
};

export default function CourtListingGalleryCard({
  listingKey,
  court,
  latestCourtReview,
  onOpenCourtReviews,
  hourlyPriceDollars,
  hideDescription = false,
  hideLatestCourtReview = false,
  hideAmenities = false,
  descriptionPreviewCourtId,
  onTitleClick,
}: CourtListingGalleryCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  const courtImages = (
    court.imageUrls && court.imageUrls.length > 0 ? court.imageUrls : [court.imageUrl]
  ).filter(Boolean);
  const surfaceLabel = court.surface || "Hard Court";

  useEffect(() => {
    setCurrentImageIndex(0);
    setShowImageModal(false);
  }, [listingKey]);

  return (
    <>
      <Card className="shadow-elegant border-0 overflow-hidden rounded-3xl lg:min-w-0">
        <div className="relative h-64 md:h-80 bg-gradient-to-br from-emerald-100 to-teal-100">
          <Image
            src={courtImages[currentImageIndex] || court.imageUrl}
            alt={court.name}
            fill
            className="cursor-pointer object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            onClick={() => setShowImageModal(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-2">
            <Badge variant="secondary" className="border-0 bg-background/90 backdrop-blur-sm">
              {court.indoor ? "Indoor" : "Outdoor"}
            </Badge>
            <Badge variant="secondary" className="border-0 bg-background/90 backdrop-blur-sm">
              {surfaceLabel}
            </Badge>
          </div>

          {courtImages.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                onClick={() =>
                  setCurrentImageIndex((prev) =>
                    prev > 0 ? prev - 1 : courtImages.length - 1
                  )
                }
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                onClick={() =>
                  setCurrentImageIndex((prev) =>
                    prev < courtImages.length - 1 ? prev + 1 : 0
                  )
                }
              >
                ›
              </button>
            </>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5">
            {onTitleClick ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTitleClick();
                }}
                className="text-left text-xl font-bold text-white underline-offset-4 drop-shadow-lg transition hover:underline focus:outline-none focus:ring-2 focus:ring-white/70 md:text-2xl"
              >
                {court.name}
              </button>
            ) : (
              <h1 className="text-xl font-bold text-white drop-shadow-lg md:text-2xl">{court.name}</h1>
            )}
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-white/95">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{court.location}</span>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 p-6 md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-1 text-slate-900">
              <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">
                {court.rating != null ? court.rating.toFixed(1) : "New"}
              </span>
              <button
                type="button"
                onClick={onOpenCourtReviews}
                className="rounded-sm px-0.5 text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                ({court.reviewCount || 0}{" "}
                {(court.reviewCount || 0) === 1 ? "review" : "reviews"})
              </button>
            </div>

            {typeof hourlyPriceDollars === "number" && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-2xl font-bold text-[var(--site-accent)]">
                  ${hourlyPriceDollars}
                </span>
                <span className="text-sm text-slate-500">per hour</span>
              </div>
            )}

            {!hideDescription && (
              <p className="mt-3 text-sm leading-relaxed text-slate-700 md:text-base">
                {court.description}
              </p>
            )}
          </div>

          {descriptionPreviewCourtId ? (
            <div className="space-y-1.5">
              <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
                {court.description}
              </p>
              <a
                href={`/courts/${descriptionPreviewCourtId}`}
                className="text-xs font-semibold text-[var(--site-accent)] underline-offset-2 hover:underline"
              >
                See more on court page →
              </a>
            </div>
          ) : !hideAmenities && court.amenities && court.amenities.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-slate-700">Amenities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {court.amenities.map((a) => (
                  <Badge key={a} variant="secondary" className="bg-gray-100 text-gray-700">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {!hideLatestCourtReview && latestCourtReview?.comment && (
            <button
              type="button"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100"
              onClick={onOpenCourtReviews}
            >
              <div className="flex items-center gap-1 text-sm font-semibold text-slate-950">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {latestCourtReview.rating}/5
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                {latestCourtReview.comment}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">View all court reviews</p>
            </button>
          )}
        </CardContent>
      </Card>

      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-h-full max-w-4xl">
            <Image
              src={courtImages[currentImageIndex] || court.imageUrl}
              alt={court.name}
              width={800}
              height={600}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
