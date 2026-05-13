"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";

export type ReviewsListDialogReview = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: string | null;
  reviewerName?: string;
  reviewerProfileImageUrl?: string;
};

type ReviewsListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reviews: ReviewsListDialogReview[];
  emptyStateText?: string;
};

const formatReviewDate = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export default function ReviewsListDialog({
  open,
  onOpenChange,
  title,
  reviews,
  emptyStateText = "No reviews yet.",
}: ReviewsListDialogProps) {
  const sorted = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [reviews]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-slate-200 bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto pr-1">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              {emptyStateText}
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
	                  <div className="flex items-start justify-between gap-3">
	                    <div className="flex items-center gap-2">
	                      <Avatar className="h-9 w-9 border border-slate-200">
	                        <AvatarImage src={review.reviewerProfileImageUrl || undefined} />
	                        <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">
	                          {(review.reviewerName || "P").charAt(0).toUpperCase()}
	                        </AvatarFallback>
	                      </Avatar>
	                      <span className="text-sm font-bold text-slate-900">
	                        {review.reviewerName || "CourtShare player"}
	                      </span>
	                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <Star
                            key={v}
                            className="h-4 w-4"
                            fill={v <= review.rating ? "rgb(245 158 11)" : "transparent"}
                            color={v <= review.rating ? "rgb(245 158 11)" : "rgb(148 163 184)"}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {review.rating}/5
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{formatReviewDate(review.createdAt)}</span>
                  </div>

                  {review.comment?.trim() ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No comments.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
