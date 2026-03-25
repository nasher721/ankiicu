import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "ankiicu_api_auth";
const HMAC_MESSAGE = "ankiicu-session-v1";

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isApiAuthConfigured(): boolean {
  const s = process.env.APP_API_SECRET;
  return typeof s === "string" && s.length > 0;
}

export function apiAuthCookieName(): string {
  return COOKIE_NAME;
}

export async function signApiCookie(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(HMAC_MESSAGE));
  return bufferToHex(sig);
}

export async function verifyApiCookie(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await signApiCookie(secret);
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function isRequestAuthorized(request: NextRequest, secret: string): Promise<boolean> {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ") && bearer.slice(7) === secret) return true;
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  return verifyApiCookie(cookie, secret);
}

/** When APP_API_SECRET is set, require Bearer or auth cookie; otherwise no-op. */
export async function apiAuthOr401(request: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.APP_API_SECRET;
  if (!secret) return null;
  if (!(await isRequestAuthorized(request, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
