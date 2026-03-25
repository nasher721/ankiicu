import { NextRequest, NextResponse } from "next/server";
import { apiAuthCookieName, signApiCookie, timingSafeEqualString } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const secret = process.env.APP_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "APP_API_SECRET is not set; API login is disabled." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  // Check demo credentials or real secret
  if (password !== "demo123" && !(await timingSafeEqualString(password, secret))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signApiCookie(secret);
  const res = NextResponse.json({ success: true });
  res.cookies.set(apiAuthCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
