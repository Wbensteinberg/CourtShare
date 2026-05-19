export type StripeMode = "test" | "live";
export type StripeAccountSource =
  | "stripeTestAccountId"
  | "stripeLiveAccountId"
  | "stripeAccountId";

export function getStripeMode(secretKey = process.env.STRIPE_SECRET_KEY): StripeMode {
  return secretKey?.startsWith("sk_live_") ? "live" : "test";
}

export function getStripeAccountField(mode = getStripeMode()): StripeAccountSource {
  return mode === "live" ? "stripeLiveAccountId" : "stripeTestAccountId";
}

export function getStripeAccountIdForMode(
  userData: Record<string, any> | undefined | null,
  mode = getStripeMode()
): {
  accountId?: string;
  mode: StripeMode;
  source?: StripeAccountSource;
  isLegacy: boolean;
} {
  const modeField = getStripeAccountField(mode);
  const modeAccountId = userData?.[modeField];

  if (typeof modeAccountId === "string" && modeAccountId.trim()) {
    return {
      accountId: modeAccountId,
      mode,
      source: modeField,
      isLegacy: false,
    };
  }

  const legacyAccountId = userData?.stripeAccountId;
  if (typeof legacyAccountId === "string" && legacyAccountId.trim()) {
    return {
      accountId: legacyAccountId,
      mode,
      source: "stripeAccountId",
      isLegacy: true,
    };
  }

  return { mode, isLegacy: false };
}

export function getStripeAccountWriteFields(
  accountId: string,
  mode = getStripeMode()
): Record<string, string> {
  const modeField = getStripeAccountField(mode);

  return mode === "live"
    ? { [modeField]: accountId, stripeAccountId: accountId }
    : { [modeField]: accountId };
}

export function isStripeAccountReady(
  account: {
    charges_enabled?: boolean | null;
    payouts_enabled?: boolean | null;
    details_submitted?: boolean | null;
  } | null | undefined
) {
  return Boolean(
    account?.charges_enabled &&
      account?.payouts_enabled &&
      account?.details_submitted
  );
}
