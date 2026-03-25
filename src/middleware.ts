import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/api-auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Never run auth (or touch the request) for multipart uploads: Next can break large bodies
  // when middleware runs first (see vercel/next.js#39262). Upload handler calls apiAuthOr401.
  if (path === "/api/upload" || path.startsWith("/api/upload/")) {
    return NextResponse.next();
  }

  const secret = process.env.APP_API_SECRET;
  if (!secret) return NextResponse.next();

  if (path.startsWith("/api/auth/")) return NextResponse.next();

  if (!(await isRequestAuthorized(request, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
