import type { NextConfig } from "next";
import path from "path";

// Vercel runs Next.js with its own deployment layout; `standalone` is for Docker/self-hosting.
// See https://nextjs.org/docs/app/api-reference/next-config-js/output
const isVercel = Boolean(process.env.VERCEL);

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer information leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed by this app
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  // Legacy XSS filter for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  // Strict mode catches unsafe lifecycle patterns and double-invokes effects in dev
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
