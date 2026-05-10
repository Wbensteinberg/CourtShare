"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isMockMode } from "@/lib/firebase";
import {
  getMockProfile,
  getMockReviewsForTarget,
  type MockReview,
} from "@/lib/mockData";
import { ArrowLeft, Star } from "lucide-react";

type PublicProfile = {
  uid: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner?: boolean;
  playerRating?: number | null;
  playerReviewCount?: number;
  ownerRating?: number | null;
  ownerReviewCount?: number;
};

type PublicReview = Pick<
  MockReview,
  "id" | "reviewerRole" | "targetType" | "rating" | "comment" | "createdAt"
>;

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const RatingSummary = ({
  label,
  rating,
  count,
}: {
  label: string;
  rating?: number | null;
  count?: number;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <div className="mt-2 flex items-center gap-2">
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      <span className="text-lg font-semibold text-slate-950">
        {rating ? rating.toFixed(1) : "New"}
      </span>
    </div>
    <p className="mt-1 text-sm text-slate-500">
      {count || 0} {(count || 0) === 1 ? "review" : "reviews"}
    </p>
  </div>
);

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      setLoading(true);
      setError("");

      try {
        if (isMockMode) {
          const mockProfile = getMockProfile(userId);
          if (!mockProfile) {
            setProfile(null);
            setReviews([]);
            return;
          }

          setProfile(mockProfile);
          setReviews(
            getMockReviewsForTarget(userId).sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
          );
          return;
        }

        const [profileRes, reviewsRes] = await Promise.all([
          fetch(`/api/public-profiles/${encodeURIComponent(userId)}`),
          fetch(`/api/reviews?targetUserId=${encodeURIComponent(userId)}`),
        ]);

        const profileData = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok) {
          throw new Error(profileData.error || "Failed to load profile");
        }

        const reviewData = await reviewsRes.json().catch(() => ({}));
        if (!reviewsRes.ok) {
          throw new Error(reviewData.error || "Failed to load reviews");
        }

        setProfile(profileData.profile);
        setReviews(reviewData.reviews || []);
      } catch (err: any) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const initials = useMemo(
    () =>
      (profile?.displayName || "CourtShare user")
        .trim()
        .charAt(0)
        .toUpperCase() || "U",
    [profile?.displayName]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="mb-5 px-0 text-slate-600 hover:bg-transparent hover:text-slate-950"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {loading ? (
          <p className="py-16 text-center text-sm font-medium text-slate-500">
            Loading profile...
          </p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : !profile ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">
              Profile not found
            </h1>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="rounded-[32px] border-slate-200 shadow-sm">
              <CardContent className="flex flex-col items-center p-8 text-center">
                <Avatar className="h-32 w-32 border-4 border-white shadow-md">
                  <AvatarImage
                    src={profile.profileImageUrl || undefined}
                    alt={profile.displayName}
                  />
                  <AvatarFallback className="bg-emerald-100 text-4xl font-bold text-emerald-800">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h1 className="mt-5 text-3xl font-bold text-slate-950">
                  {profile.displayName}
                </h1>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary">
                    {profile.isOwner ? "Court owner" : "Player"}
                  </Badge>
                  {profile.ownerReviewCount ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Host rating {profile.ownerRating?.toFixed(1)}
                    </Badge>
                  ) : null}
                </div>
                {profile.bio ? (
                  <p className="mt-5 text-sm leading-6 text-slate-600">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-5 text-sm leading-6 text-slate-500">
                    This member has not added a bio yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <RatingSummary
                  label="As a player"
                  rating={profile.playerRating}
                  count={profile.playerReviewCount}
                />
                <RatingSummary
                  label="As a host"
                  rating={profile.ownerRating}
                  count={profile.ownerReviewCount}
                />
              </div>

              <Card className="rounded-[32px] border-slate-200 shadow-sm">
                <CardHeader>
                  <h2 className="text-xl font-bold text-slate-950">Reviews</h2>
                  <p className="text-sm text-slate-500">
                    Feedback from completed CourtShare bookings.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      No reviews yet.
                    </p>
                  ) : (
                    reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-slate-950">
                              {review.rating}/5
                            </span>
                            <Badge variant="outline">
                              {review.targetType === "player"
                                ? "Player review"
                                : "Host and court review"}
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatDate(review.createdAt)}
                          </span>
                        </div>
                        {review.comment ? (
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {review.comment}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
