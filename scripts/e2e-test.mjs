import { chromium } from "playwright";
import assert from "node:assert/strict";

// Minimal expect shim for the assertions used in this script.
function expect(actual, msg) {
  return {
    toBe(expected) {
      assert.equal(actual, expected, msg ?? `Expected ${actual} to be ${expected}`);
    },
    toBeGreaterThan(n) {
      assert.ok(actual > n, msg ?? `Expected ${actual} to be > ${n}`);
    },
  };
}
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sourceFile = path.join(
  root,
  "upload",
  "Neurocritical Care Board Review_ Questions and Answers-Demos Medical (2018).pdf.md",
);

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const screenshotDir = path.join(root, "e2e-screenshots");
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

// Embedded Postgres used by `node scripts/dev-local.mjs`.
const defaultEmbeddedDbUrl = "postgresql://postgres:postgres@127.0.0.1:5433/ankiicu";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultEmbeddedDbUrl;
process.env.DATABASE_URL_UNPOOLED =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

async function take(page, filename) {
  await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
}

async function prismaWipe(prisma) {
  // Deterministic runs: wipe cards + uploaded file + progress.
  await prisma.ankiCard.deleteMany();
  await prisma.generationProgress.deleteMany();
  await prisma.sourceFile.deleteMany();
}

async function runTest() {
  if (!openAiApiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. E2E generation requires a real key (401 if absent).",
    );
  }

  await import("node:fs/promises").then(async ({ mkdir }) => {
    await mkdir(screenshotDir, { recursive: true });
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:postgres@127.0.0.1:5433/ankiicu" } },
  });

  console.log("Starting E2E test...");
  // Give dev-local a moment to fully start listening.
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await prismaWipe(prisma);
      break;
    } catch (e) {
      if (attempt === 10) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  let browser;
  const genResponseTimeoutMs = Number(process.env.E2E_GENERATE_TIMEOUT_MS ?? 300000); // 5 min

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--no-proxy-server",        // bypass any system proxy for localhost
        "--disable-dev-shm-usage",  // avoid /dev/shm OOM on constrained machines
      ],
    });
    const context = await browser.newContext();

    // Avoid the API key modal by seeding the hook's localStorage key.
    context.addInitScript((key) => {
      localStorage.setItem("openai_api_key", key);
    }, openAiApiKey);

    const page = await context.newPage();
    // Generous timeouts — machine may be under memory pressure.
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(60000);

    async function ensureAuthed() {
      // Wait for either a /login redirect OR the page to go network-idle,
      // so client-side auth redirects complete before we inspect the DOM.
      await Promise.race([
        page.waitForURL("**/login", { timeout: 8000 }),
        page.waitForLoadState("networkidle", { timeout: 8000 }),
      ]).catch(() => {});

      const password = page.locator("#password");
      if (await password.isVisible().catch(() => false)) {
        await page.fill("#password", "demo123");
        await page.getByRole("button", { name: /Sign in/i }).click();
        await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      }
    }

    // 1) Upload File
    console.log("Navigating to upload page...");
    await page.goto(`${baseUrl}/upload`, { waitUntil: "domcontentloaded" });
    await ensureAuthed();
    // Re-navigate to /upload in case login redirected us elsewhere.
    if (!page.url().includes("/upload")) {
      console.log(`Redirected to ${page.url()}, re-navigating to /upload...`);
      await page.goto(`${baseUrl}/upload`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    }
    await page.waitForSelector('input[type="file"]', { state: "attached", timeout: 30000 });
    await take(page, "01_upload_page.png");

    console.log("Uploading file...");
    await page.locator('input[type="file"]').setInputFiles(sourceFile);

    console.log("Waiting for upload success...");
    await page.waitForSelector('text=File uploaded successfully!', { timeout: 60000 });
    await take(page, "02_upload_success.png");

    // Verify chapters were detected (API-level check).
    const uploadRes = await page.request.get(`${baseUrl}/api/upload`);
    expect(uploadRes.status(), "Expected /api/upload to succeed").toBe(200);
    const uploadData = await uploadRes.json();
    const chaptersLen = uploadData.file?.chapters?.length ?? 0;
    expect(chaptersLen, "Expected detected chapters").toBeGreaterThan(0);
    console.log(`Detected ${uploadData.file.chapters.length} chapters`);

    // 2) Navigate to Generate
    console.log("Navigating to generate page...");
    await page.goto(`${baseUrl}/generate`, { waitUntil: "domcontentloaded" });
    await ensureAuthed();
    await page.waitForSelector("text=Generation Progress", { timeout: 20000 });
    await take(page, "03_generate_page.png");

    // 3) Start Generating - one batch only ("Generate 5")
    const generateButton = page.getByRole("button", { name: /Generate\s*5/i });
    await generateButton.waitFor({ state: "visible", timeout: 15000 });

    const genResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/generate") && resp.request().method() === "POST",
      { timeout: genResponseTimeoutMs },
    );

    console.log('Clicking "Generate 5"...');
    await generateButton.click();

    // Fallback: if modal appears, fill it and continue.
    const apiKeyInput = page.locator("#apiKey");
    if (await apiKeyInput.isVisible().catch(() => false)) {
      console.log("API key modal detected; saving key...");
      await apiKeyInput.fill(openAiApiKey);
      await page.getByRole("button", { name: /Save & Continue/i }).click();
    }

    console.log("Waiting for /api/generate to complete...");
    const genResponse = await genResponsePromise;
    expect(genResponse.status()).toBe(200);
    const genJson = await genResponse.json();
    expect(genJson.success).toBe(true);
    console.log(`Generation success; savedCount=${genJson.savedCount ?? "?"}`);

    await take(page, "04_generation_response.png");

    // 4) Verify cards are displayed + exist in DB
    console.log("Navigating to cards page...");
    await page.goto(`${baseUrl}/cards`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Card Library", { timeout: 20000 });
    await take(page, "05_cards_page.png");

    const cardsRes = await page.request.get(`${baseUrl}/api/cards?limit=50`);
    expect(cardsRes.status()).toBe(200);
    const cardsData = await cardsRes.json();
    expect(cardsData.total, "Expected cards total > 0").toBeGreaterThan(0);
    console.log(`API reports ${cardsData.total} cards`);

    // Assert via direct DB count too.
    const dbCount = await prisma.ankiCard.count();
    expect(dbCount).toBeGreaterThan(0);
    console.log(`DB reports ${dbCount} cards`);

    // UI sanity: should not show the empty-state heading.
    const noCardsCount = await page.getByRole("heading", { name: /No Cards Yet/i }).count();
    assert.equal(noCardsCount, 0, "Expected 'No Cards Yet' heading to not be present");

    console.log("E2E test passed.");
  } catch (error) {
    console.error("Test failed:", error);
    // Best-effort screenshot.
    try {
      if (browser) {
        const context = browser.contexts()[0];
        const page = context?.pages?.()[0];
        if (page) await take(page, "99_failure.png");
      }
    } catch {
      /* ignore screenshot failure */
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    console.log("Done.");
  }
}

runTest();
