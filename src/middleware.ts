import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/api-auth";

export async function middleware(request: NextRequest) {
  const secret = process.env.APP_API_SECRET;
  if (!secret) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/auth/")) return NextResponse.next();

  if (!(await isRequestAuthorized(request, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
