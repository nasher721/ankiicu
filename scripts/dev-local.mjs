/**
 * Starts embedded Postgres (no Docker), runs migrations, then Next.js dev server.
 * Stop with Ctrl+C (shuts down Postgres cleanly on Unix; on Windows the port may linger briefly).
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, ".embedded-postgres");
const PORT = 5433;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  port: PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  // Windows defaults to a non-UTF8 server encoding; force UTF-8 for Unicode card/content text
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => console.error("[embedded-postgres]", e),
});

const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${PORT}/ankiicu`;
const dbEnv = {
  ...process.env,
  DATABASE_URL: dbUrl,
  DATABASE_URL_UNPOOLED: dbUrl,
};

function versionFile() {
  return path.join(dataDir, "PG_VERSION");
}

async function ensureClusterAndDb() {
  if (!fs.existsSync(versionFile())) {
    await fs.promises.mkdir(dataDir, { recursive: true });
    console.log("Initializing embedded Postgres (first run may take a minute)…");
    await pg.initialise();
  }
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const { rows } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'ankiicu'",
  );
  await client.end();
  if (rows.length === 0) {
    await pg.createDatabase("ankiicu");
    console.log("Created database ankiicu.");
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: dbEnv,
      cwd: root,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → ${code}`)),
    );
  });
}

async function main() {
  await ensureClusterAndDb();
  console.log(`Database ready: ${dbUrl}`);
  await run("npx", ["prisma", "migrate", "deploy"]);

  const next = spawn("npx", ["next", "dev", "-p", "3000"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: dbEnv,
    cwd: root,
  });

  const stopPg = async () => {
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
  };

  next.on("exit", async (code) => {
    await stopPg();
    process.exit(code ?? 0);
  });

  process.on("SIGINT", async () => {
    next.kill("SIGINT");
    await stopPg();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    next.kill("SIGTERM");
    await stopPg();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error(err);
  await pg.stop().catch(() => {});
  process.exit(1);
});
