/**
 * Vercel / CI: Prisma schema requires DATABASE_URL_UNPOOLED (directUrl).
 * Neon sets both; single-URL Postgres setups often only define DATABASE_URL.
 * Mirror DATABASE_URL so migrate deploy and generate succeed.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for build.");
  process.exit(1);
}
if (!process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

const steps = [
  ["npx", "prisma", "migrate", "deploy"],
  ["npx", "prisma", "generate"],
  ["npx", "next", "build", "--webpack"],
];

for (const args of steps) {
  const result = spawnSync(args[0], args.slice(1), {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
