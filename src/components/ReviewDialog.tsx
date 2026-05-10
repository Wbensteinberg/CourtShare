"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ReviewDialogProps = {
  open: boolean;
  title: string;
  description: string;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (review: { rating: number; comment: string }) => Promise<void>;
};

export default function ReviewDialog({
  open,
  title,
  description,
  submitting = false,
  onOpenChange,
  onSubmit,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
    }
  }, [open]);

  const submitReview = async () => {
    await onSubmit({ rating, comment: comment.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="rounded-full p-1 text-amber-400 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  onClick={() => setRating(value)}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7",
                      value <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-slate-300"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="review-comment"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Notes
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="Share a few helpful details..."
              className="min-h-28 rounded-2xl border-slate-200"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={submitReview}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
