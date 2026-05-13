const CANCEL_REASON_LABELS: Record<string, string> = {
  host_cancellation: "The host cancelled this booking.",
  player_cancellation: "The player cancelled this booking.",
  host_rejection: "The host declined this booking request.",
  host_acceptance_window_expired:
    "The host did not respond within the 24-hour acceptance window.",
};

export const formatBookingCancelReason = (reason?: string | null) => {
  const normalizedReason = reason?.trim();

  if (!normalizedReason) {
    return "";
  }

  const knownLabel = CANCEL_REASON_LABELS[normalizedReason];

  if (knownLabel) {
    return knownLabel;
  }

  if (/[_-]/.test(normalizedReason)) {
    const readableReason = normalizedReason.replace(/[_-]+/g, " ");
    return readableReason.charAt(0).toUpperCase() + readableReason.slice(1);
  }

  return normalizedReason;
};
