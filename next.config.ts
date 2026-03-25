import type { NextConfig } from "next";
import path from "path";

// Vercel runs Next.js with its own deployment layout; `standalone` is for Docker/self-hosting.
// See https://nextjs.org/docs/app/api-reference/next-config-js/output
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // If a lockfile exists above this app (e.g. user home), Next may pick the wrong tracing root
  // and omit deps from the serverless bundle — set explicitly for reliable Vercel/serverless runs.
  outputFileTracingRoot: path.join(process.cwd()),
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
