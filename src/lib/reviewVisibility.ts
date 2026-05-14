export type PublicReviewVisibilityInput = {
  targetType?: string;
  reviewerRole?: string;
  bookingId?: string;
};

export const shouldShowPublicReview = (
  review: PublicReviewVisibilityInput,
  pairedReviewExists: boolean
) => {
  if (review.targetType === "player") {
    return true;
  }

  return pairedReviewExists;
};
