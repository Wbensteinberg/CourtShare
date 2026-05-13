"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isMockMode } from "@/lib/firebase";
import { getMockCourts } from "@/lib/mockData";

export type CourtListingHostPublicProfile = {
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner?: boolean;
  playerRating?: number | null;
  playerReviewCount?: number;
  ownerRating?: number | null;
  ownerReviewCount?: number;
  memberSince?: string | null;
  listingsCount?: number;
};

export type CourtListingHostReview = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: string | null;
};

const formatProfileReviewDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const getMonthCountFromMemberSince = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  );
};

const sortReviewsNewestFirst = (list: CourtListingHostReview[]) =>
  [...list].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

type CourtListingHostCardProps = {
  hostProfile: CourtListingHostPublicProfile | null;
  hostReviews: CourtListingHostReview[];
  ownerId?: string;
  /** Optional avatar URL when the parent already resolved the display image. */
  avatarImageUrl?: string;
  triggerVariant?: "card" | "none";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function CourtListingHostCard({
  hostProfile,
  hostReviews,
  ownerId,
  avatarImageUrl,
  triggerVariant = "card",
  open,
  onOpenChange,
}: CourtListingHostCardProps) {
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);

  const hostName =
    hostProfile?.displayName?.trim() || "Court host";
  const hostRatingSummary =
    hostProfile?.ownerRating != null ? hostProfile.ownerRating.toFixed(1) : "New";
  const hostReviewCountForCard = hostProfile?.ownerReviewCount ?? 0;
  const avatarSrc = avatarImageUrl || hostProfile?.profileImageUrl || undefined;

  const hostAboutMeStats = useMemo(() => {
    const reviewCount =
      typeof hostProfile?.ownerReviewCount === "number"
        ? hostProfile.ownerReviewCount
        : hostReviews.length;
    let listings = 0;
    if (typeof hostProfile?.listingsCount === "number") {
      listings = hostProfile.listingsCount;
    } else if (isMockMode && ownerId) {
      listings = getMockCourts().filter((c) => c.ownerId === ownerId).length;
    }
    const months = getMonthCountFromMemberSince(hostProfile?.memberSince ?? null);
    return { listings, reviews: reviewCount, months };
  }, [hostProfile, hostReviews.length, ownerId]);

  const sortedHostReviewsForDialog = useMemo(
    () => sortReviewsNewestFirst(hostReviews),
    [hostReviews]
  );
  const dialogOpen = open ?? internalDialogOpen;
  const setDialogOpen = onOpenChange ?? setInternalDialogOpen;

  return (
    <>
      {triggerVariant === "card" && (
        <Card className="border-0 shadow-elegant rounded-3xl">
          <CardContent className="p-6">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              aria-label={`View profile for ${hostName}`}
            >
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={avatarSrc} alt={hostName} />
                <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-800">
                  {hostName.trim().charAt(0).toUpperCase() || "H"}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug text-slate-900">
                <span className="font-semibold text-slate-700">Hosted by</span>
                <span className="font-bold text-slate-950">{hostName}</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                  {hostRatingSummary}
                </span>
                <span className="text-slate-600">
                  ({hostReviewCountForCard}{" "}
                  {hostReviewCountForCard === 1 ? "review" : "reviews"})
                </span>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-slate-200 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold text-slate-950">
              {hostName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <Card className="rounded-[32px] border-slate-200 shadow-sm">
              <CardContent className="grid gap-8 p-8 sm:grid-cols-[1fr_170px] sm:p-10">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-md md:h-32 md:w-32">
                    <AvatarImage src={avatarSrc} alt={hostName} />
                    <AvatarFallback className="bg-emerald-100 text-3xl font-bold text-emerald-800">
                      {hostName.trim().charAt(0).toUpperCase() || "H"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="mt-5 text-2xl font-bold text-slate-950 md:text-3xl">{hostName}</h2>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">
                      {hostProfile?.isOwner ? "Host" : "Player"}
                    </Badge>
                    {(hostProfile?.playerReviewCount ?? 0) > 0 &&
                    hostProfile?.playerRating != null ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Player rating {hostProfile.playerRating.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                  {hostProfile?.bio ? (
                    <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 md:text-base md:leading-7">
                      {hostProfile.bio}
                    </p>
                  ) : (
                    <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 md:text-base md:leading-7">
                      This member has not added a bio yet.
                    </p>
                  )}
                </div>

                <div className="grid content-center divide-y divide-slate-200">
                  <div className="py-4 first:pt-0">
                    <p className="text-3xl font-black text-slate-950">{hostAboutMeStats.listings}</p>
                    <p className="text-sm font-semibold text-slate-600">Listings</p>
                  </div>
                  <div className="py-4">
                    <p className="text-3xl font-black text-slate-950">{hostAboutMeStats.reviews}</p>
                    <p className="text-sm font-semibold text-slate-600">Reviews</p>
                  </div>
                  <div className="py-4">
                    <p className="text-3xl font-black text-slate-950">{hostAboutMeStats.months}</p>
                    <p className="text-sm font-semibold text-slate-600">Months on CourtShare</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-slate-200 shadow-sm">
              <CardHeader>
                <h3 className="text-xl font-bold text-slate-950">Host reviews</h3>
                <p className="text-sm text-slate-500">
                  Feedback from players after completed bookings.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortedHostReviewsForDialog.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    No host reviews yet.
                  </p>
                ) : (
                  sortedHostReviewsForDialog.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-slate-950">{review.rating}/5</span>
                          <Badge variant="outline">Host review</Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatProfileReviewDate(review.createdAt)}
                        </span>
                      </div>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-6 text-slate-700">{review.comment}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
