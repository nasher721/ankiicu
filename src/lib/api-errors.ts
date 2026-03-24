import { NextResponse } from "next/server";

export function serverErrorResponse(
  publicMessage: string,
  err: unknown,
  status = 500,
): NextResponse {
  console.error(publicMessage, err);
  const isProd = process.env.NODE_ENV === "production";
  const body: { error: string; details?: string } = { error: publicMessage };
  if (!isProd && err instanceof Error) body.details = err.message;
  return NextResponse.json(body, { status });
}
