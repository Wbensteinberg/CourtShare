import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  formatCourtRating,
  getCourtForShareMetadata,
  getCourtMainImage,
} from "@/lib/courtShareMetadata";
import { DEFAULT_OG_IMAGE, getAbsoluteUrl } from "@/lib/shareMetadataConstants";

type CourtLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const court = await getCourtForShareMetadata(id);

  if (!court) {
    return {
      title: "CourtShare - Book Premium Tennis Courts",
      openGraph: {
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        images: [DEFAULT_OG_IMAGE],
      },
    };
  }

  const rating = formatCourtRating(court);
  const title = `${court.name} | CourtShare`;
  const description = [court.location, rating].filter(Boolean).join(" - ");
  const imageUrl = getCourtMainImage(court);

  return {
    title,
    description,
    alternates: {
      canonical: `/courts/${id}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/courts/${id}`,
      siteName: "CourtShare",
      images: [
        {
          url: imageUrl,
          alt: court.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl || getAbsoluteUrl(DEFAULT_OG_IMAGE)],
    },
  };
}

export default function CourtLayout({ children }: CourtLayoutProps) {
  return children;
}
