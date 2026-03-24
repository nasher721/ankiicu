import type { NextConfig } from "next";

// Vercel runs Next.js with its own deployment layout; `standalone` is for Docker/self-hosting.
// See https://nextjs.org/docs/app/api-reference/next-config-js/output
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
