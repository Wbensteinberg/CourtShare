import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  const csp = [
    "default-src 'self'",
    [
      "script-src",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Fallbacks: strict-dynamic browsers ignore these; older browsers use them
      "https://js.stripe.com",
      "https://maps.googleapis.com",
      "https://maps.gstatic.com",
      "https://apis.google.com",
      "https://accounts.google.com",
      "'unsafe-inline'", // ignored by browsers that honour the nonce
      process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleapis.com https://*.gstatic.com https://maps.gstatic.com https://placehold.co https://*.tile.openstreetmap.org",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://api.stripe.com https://maps.googleapis.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://www.google.com https://accounts.google.com https://*.firebaseapp.com https://www.openstreetmap.org",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.png).*)",
};
