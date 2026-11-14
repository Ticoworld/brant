import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.ROVEKO_URL ?? "http://127.0.0.1:3001";
const chromePath = process.env.CHROME_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const evidenceDir = path.resolve("evidence/rov-2026-11-14");
const routes = [
  ["home", "/"],
  ["v2", "/v2"],
  ["v2-discover", "/v2/discover"],
  ["v2-portfolio", "/v2/portfolio"],
  ["v2-orders", "/v2/orders"],
  ["v2-activity", "/v2/activity"],
  ["v2-withdraw", "/v2/withdraw"],
  ["v2-deploy", "/v2/deploy"],
  ["claims", "/claims"],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];
const report = { baseUrl, routes: [], pageErrors: [], walletChoices: [], interactions: [], disabledTradeActions: [], fixtures: "public views only; no isolated RPC fixture configured" };

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromePath });

for (const locale of ["en", "zh-CN"]) {
  for (const [viewportName, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((value) => localStorage.setItem("roveko-locale", value), locale);
    for (const [name, route] of routes) {
      const page = await context.newPage();
      page.on("pageerror", (error) => report.pageErrors.push({ locale, viewport: viewportName, route, message: error.message }));
      const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(350);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        height: innerHeight,
        language: document.documentElement.lang,
        heading: document.querySelector("h1")?.textContent?.trim() ?? "",
        links: [...document.querySelectorAll("nav a")].map((link) => link.textContent?.trim()),
      }));
      const screenshot = `${evidenceDir}/after-${locale}-${viewportName}-${name}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      report.routes.push({ locale, viewport: viewportName, route, status: response?.status(), resolvedPath: new URL(page.url()).pathname, ...dimensions, screenshot: path.basename(screenshot) });

      if (route === "/v2") {
        const side = page.getByRole("button", { name: locale === "en" ? "Sell" : "卖出", exact: false });
        if (await side.count()) {
          await side.first().click();
          report.interactions.push({ locale, viewport: viewportName, action: "select sell", passed: true });
          const buy = page.getByRole("button", { name: locale === "en" ? "Buy" : "买入", exact: false });
          if (await buy.count()) await buy.first().click();
        }
        const unavailableTrade = page.getByRole("button", { name: locale === "en" ? "Trading is unavailable until a market is verified" : "市场通过验证后方可交易", exact: false });
        report.disabledTradeActions.push({ locale, viewport: viewportName, disabled: await unavailableTrade.isDisabled() });
        const connect = page.getByRole("button", { name: locale === "en" ? "Connect Wallet" : "连接钱包", exact: false });
        if (await connect.count()) {
          await connect.first().click();
          await page.waitForTimeout(700);
          const walletNames = ["Khie", "JoyID Passkey", "MetaMask", "OKX Wallet", "UniSat", "UTXO Global Wallet"];
          const choices = [];
          for (const walletName of walletNames) if (await page.getByText(walletName, { exact: true }).count()) choices.push(walletName);
          report.walletChoices = [...new Set([...report.walletChoices, ...choices])];
          if (locale === "en" && viewportName === "desktop") await page.screenshot({ path: `${evidenceDir}/wallet-chooser.png`, fullPage: true });
          report.interactions.push({ locale, viewport: viewportName, action: "open wallet chooser", passed: true });
        }
      }
      await page.close();
    }
    await context.close();
  }
}

report.overflow = report.routes.filter((route) => route.documentWidth > route.width || route.bodyWidth > route.width);
await writeFile(`${evidenceDir}/browser-report.json`, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ routes: report.routes.length, overflow: report.overflow.length, pageErrors: report.pageErrors.length, walletChoices: report.walletChoices.length, evidenceDir }, null, 2));
