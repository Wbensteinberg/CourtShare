import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const redirects: Record<string, string> = {
    "/courts": "/",
    "/dashboard/player": "/player-dashboard",
    "/dashboard/owner": "/owner-dashboard",
  };

  const target = redirects[pathname];
  if (!target) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/courts", "/dashboard/player", "/dashboard/owner"],
};
