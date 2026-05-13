export const DEFAULT_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co";

export const DEFAULT_OG_IMAGE = "/courtshare-og.png";

export function getAbsoluteUrl(pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, DEFAULT_SITE_URL).toString();
  }
}
