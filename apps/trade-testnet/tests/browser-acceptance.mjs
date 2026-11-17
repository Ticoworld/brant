import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, ".."),
  evidenceRoot = path.join(root, "evidence", "roveko-ui-transplant-2026-11-17"),
  output = path.join(evidenceRoot, `browser-acceptance-${Date.now()}`),
  base = process.env.ROVEKO_URL || "http://127.0.0.1:3000",
  marketId = "0x3d313a3ddcc655d2fd30344b0d97d0bdf845da2ca33bc067c783cf8ad63d30a6",
  browserPaths = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean),
  executablePath = browserPaths.find((candidate) => fs.existsSync(candidate));

if (!executablePath) throw Error("Set CHROME_PATH to a local Chrome executable.");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});
const report = {
  capturedAt: new Date().toISOString(),
  base,
  qualification: "Anonymous UI checks only; no wallet connection or transaction request.",
  routes: [],
  pageErrors: [],
};

async function capture(page, route, width, height, name, ready, locale) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => performance.clearResourceTimings());
  const started = Date.now();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  const apiCalls = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/api/pudge/"))
    .map((entry) => ({ path: new URL(entry.name).pathname, durationMs: Math.round(entry.duration) })));
  assert(layout.document <= layout.viewport, `${route} overflows at ${width}px: ${JSON.stringify(layout)}`);
  const screenshot = `${name}.png`;
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
  report.routes.push({ locale, route, width, height, elapsedMs: Date.now() - started, apiCalls, screenshot, horizontalOverflow: false });
}

try {
  for (const locale of ["en", "zh-CN"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript((savedLocale) => localStorage.setItem("roveko-locale", savedLocale), locale);
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on("pageerror", (error) => report.pageErrors.push(`${locale}: ${String(error)}`));
    const discoveryReady = async (p) => {
      await p.getByRole("heading", { name: locale === "en" ? "Markets" : "市场", exact: true }).waitFor();
      await p.getByText(locale === "en" ? "Pudge backed claims" : "Pudge 担保债权", { exact: true }).first().waitFor();
      await p.getByText("0.2 CKB", { exact: true }).waitFor();
    };
    const marketReady = async (p) => {
      await p.getByText(locale === "en" ? "Market reconstructed from committed history and its live Cell." : "已根据已提交的历史记录和当前链上 Cell 重建市场。", { exact: true }).waitFor();
      await p.getByText(locale === "en" ? "No confirmed price history" : "暂无已确认的价格历史", { exact: true }).waitFor();
    };

    for (const [width, height, prefix] of [[1440, 1000, "desktop"], [390, 844, "mobile"]]) {
      await capture(page, "/", width, height, `${locale}-${prefix}-discover`, discoveryReady, locale);
      await capture(page, `/market/${marketId}`, width, height, `${locale}-${prefix}-market`, marketReady, locale);

      await capture(page, "/portfolio", width, height, `${locale}-${prefix}-portfolio`, async (p) => {
        await p.getByRole("heading", { name: locale === "en" ? "Portfolio" : "资产组合", exact: true }).waitFor();
        await p.getByText(locale === "en" ? "Wallet CKB balance" : "CKB 钱包余额", { exact: true }).waitFor();
        const connect = locale === "en" ? "Connect wallet" : "连接钱包";
        await p.getByRole("button", { name: connect, exact: true }).last().waitFor();
      }, locale);
      await capture(page, "/activity", width, height, `${locale}-${prefix}-activity`, async (p) => {
        await p.getByRole("heading", { name: locale === "en" ? "Activity" : "动态", exact: true }).waitFor();
        await p.getByRole("heading", { name: locale === "en" ? "No activity yet" : "暂无动态", exact: true }).waitFor();
      }, locale);
      await capture(page, "/launch", width, height, `${locale}-${prefix}-launch`, async (p) => {
        await p.getByRole("heading", { name: locale === "en" ? "Create Market" : "创建市场", exact: true }).waitFor();
        const review = p.getByRole("button", { name: locale === "en" ? "Review market creation" : "审核市场创建", exact: true });
        assert(await review.isDisabled(), "Market creation must remain disabled before wallet verification.");
      }, locale);
    }

    for (const retired of ["/v2", "/claims", "/fixture", "/experience-fixture", "/r7", "/r7-assignment", "/r7-wallet-check"]) {
      const response = await context.request.get(base + retired);
      assert.equal(response.status(), 404, `${retired} should no longer be a public route.`);
    }
    for (const retired of ["/api/v2", "/api/v2/orders", "/api/v2/pudge-proof"]) {
      const response = await context.request.get(base + retired);
      assert.equal(response.status(), 404, `${retired} should no longer be a public endpoint.`);
    }
    await context.close();
  }

  assert.deepEqual(report.pageErrors, [], "Browser page errors were reported.");
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(`BROWSER_ACCEPTANCE_PASS ${output}`);
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
