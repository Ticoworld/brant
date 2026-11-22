// Controlled presentation tests; never injects a wallet or constructs/broadcasts a Pudge transaction.
import { verifyTradeNavigation } from "./trade-navigation.mjs";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.resolve(
    root,
    "../../labs/wo13-trade-experience/market-journey/browser-" + Date.now(),
  );
fs.mkdirSync(out, { recursive: true });
const axeURL =
    "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js",
  axeHash = "880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb";
const axe = process.env.AXE_PATH
  ? fs.readFileSync(process.env.AXE_PATH, "utf8")
  : await fetch(axeURL).then((r) => {
      if (!r.ok) throw Error("axe download " + r.status);
      return r.text();
    });
assert.equal(crypto.createHash("sha256").update(axe).digest("hex"), axeHash);
const evidence = {
  at: new Date().toISOString(),
  qualification: "UI PRESENTATION FIXTURES ARE NOT WALLET OR CHAIN EXECUTION",
  axe: { url: axeURL, sha256: axeHash },
  checks: [],
  accessibility: [],
  pageErrors: [],
  rpcMethods: [],
};
let server, browser;
const base = "http://127.0.0.1:3101";
const save = () =>
  fs.writeFileSync(out + "/result.json", JSON.stringify(evidence, null, 2));
async function start(mode) {
  const log = fs.openSync(out + "/" + mode + ".log", "w");
  server = spawn(
    process.execPath,
    [
      root + "/node_modules/next/dist/bin/next",
      mode === "production" ? "start" : "dev",
      ...(mode === "production" ? [] : ["--webpack"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_LOCAL_FIXTURE: mode === "fixture" ? "1" : "0",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", log, log],
    },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error("Server not ready");
}
async function stop() {
  if (!server) return;
  const p = server;
  server = null;
  await new Promise((resolve) => {
    p.once("exit", resolve);
    p.kill("SIGTERM");
  });
}
const check = (name) => {
  evidence.checks.push(name);
  save();
};
async function scan(p, label, scope = ".app-shell") {
  await p.addScriptTag({ content: axe });
  const a = await p.evaluate(
    async (selector) =>
      await window.axe.run(document.querySelector(selector), {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      }),
    scope,
  );
  evidence.accessibility.push({
    label,
    violations: a.violations,
    incomplete: a.incomplete.map((x) => ({ id: x.id, impact: x.impact })),
    passes: a.passes.length,
  });
  save();
  assert.equal(
    a.violations.length,
    0,
    "Accessibility " + label + ": " + a.violations.map((x) => x.id).join(","),
  );
}
async function reflow(p, label) {
  const x = await p.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  assert(
    x.width <= x.viewport,
    label + " horizontal overflow " + JSON.stringify(x),
  );
  check(label + " reflow");
}
try {
  await start("production");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await browser.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => {
    evidence.pageErrors.push(String(e));
    save();
  });
  p.on("request", (r) => {
    if (r.method() === "POST") {
      try {
        const j = r.postDataJSON();
        if (j?.method) evidence.rpcMethods.push(j.method);
      } catch {}
    }
  });
  // Retired WO13 production assumptions: empty market directory, disabled discovery,
  // button-based tabs, and claim-based position regions. WO13 fixture checks remain below.
  const id = "0x" + "12".repeat(32);
  await verifyTradeNavigation(browser, base);
  for (const width of [1440, 768, 375]) {
    await p.setViewportSize({width, height: width === 375 ? 812 : 1000});
    for (const [route, label, scope] of [
      ["/", "Markets", "main"],
      ["/market/pudge-xudt", "Trade", ".trade-preview"],
      ["/portfolio", "Portfolio", "main"],
      ["/launch", "Launch", "main"],
      ["/activity", "Activity", "main"],
    ]) {
      await p.goto(base + route);
      await p.getByRole("main").first().waitFor();
      await reflow(p, label + width);
      await scan(p, label + width, scope);
    }
  }
  await p.goto(base + "/market/unknown?claim=0");
  for (const reload of [false, true]) {
    if (reload) await p.reload();
    await p.getByText("Market data is temporarily unavailable", {exact: true}).waitFor();
    assert.equal(await p.getByRole("button", {name: /Buy Token|Sell Token|Buy RVK|Sell RVK/}).count(), 0);
  }
  check("Unknown market fails closed after direct navigation and reload");
  await p.goto(base + "/experience-fixture");
  await p.getByRole("heading", { name: "Local UI fixture disabled" }).waitFor();
  check(
    "Production fixtures disabled; creation and discovery unavailable without deployment",
  );
  await stop();
  await start("fixture");
  const fixture = async (state = "active", query = "") => {
    await p.goto(base + "/experience-fixture?state=" + state + query);
    await p
      .getByText("CONTROLLED LOCAL UI FIXTURE", { exact: false })
      .waitFor();
  };
  const firstMarket = () =>
    p.getByRole("button", { name: "Open market " + id, exact: true });
  const position = (n) =>
    p.getByRole("button", { name: "Open position " + n, exact: true });
  for (const width of [1440, 768, 375]) {
    await p.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await fixture();
    assert.equal(await p.locator(".market-table tbody tr").count(), 2);
    await p.screenshot({ path: out + `/markets-${width}.png`, fullPage: true });
    await scan(p, "fixture directory " + width);
    await firstMarket().click();
    await p
      .getByRole("heading", { name: "CKB-backed claims", exact: true })
      .waitFor();
    assert.equal(
      await p.getByRole("region", { name: "Selected position" }).count(),
      0,
    );
    await p.screenshot({ path: out + `/market-${width}.png`, fullPage: true });
    await reflow(p, "market " + width);
    await scan(p, "market " + width);
    await position(1).click();
    await p.waitForFunction(
      () => document.activeElement?.id === "position-actions",
    );
    assert(
      !(await p
        .getByRole("button", { name: "Review redemption" })
        .isDisabled()),
    );
    assert.equal(
      await p.locator(".action-accounting .total dd").innerText(),
      "0.099 CKB",
    );
    await p.screenshot({
      path: out + `/position-${width}.png`,
      fullPage: true,
    });
    await reflow(p, "selected position " + width);
    await scan(p, "selected position " + width);
    assert(!(await p.locator("main").innerText()).includes(id));
    await position(2).click();
    await p.getByRole("heading", { name: "Acquire with an offer" }).waitFor();
    assert.equal(
      await p.getByRole("button", { name: "Review redemption" }).count(),
      0,
    );
    assert.equal(
      await p.getByRole("button", { name: "Sell", exact: true }).count(),
      0,
    );
    await p.getByRole("button", { name: "Close position" }).click();
    assert.equal(
      await p.getByRole("region", { name: "Selected position" }).count(),
      0,
    );
    check(
      "Market → own position / other owner, exact fee, focus and reflow " +
        width,
    );
  }
  await fixture();
  await p
    .getByRole("button", {
      name: "Open market 0x" + "ab".repeat(32),
      exact: true,
    })
    .click();
  assert.match(
    await p.getByRole("region", { name: "Market financial state" }).innerText(),
    /0\.025/,
  );
  await position(1).click();
  await p.getByRole("button", { name: "Review refund" }).waitFor();
  assert.equal(
    await p.getByRole("button", { name: "Review redemption" }).count(),
    0,
  );
  await position(2).click();
  await p.getByRole("button", { name: "Review contribution" }).waitFor();
  check(
    "Distinct market uses its own funding state; owner refund and empty-slot contribution are contextual",
  );
  for (const state of [
    "disconnected",
    "unsupported",
    "nodeploy",
    "empty",
    "loading",
    "rpc",
    "stale",
    "missing-history",
    "pending",
    "committed",
    "funding-ready",
    "settled",
    "maturity",
    "partial",
  ]) {
    await p.setViewportSize({ width: 375, height: 812 });
    await fixture(state, state === "loading" ? "&view=market" : "");
    if (
      ["disconnected", "unsupported", "maturity", "partial"].includes(state)
    ) {
      await firstMarket().click();
      await position(1).click();
      if (["disconnected", "unsupported"].includes(state))
        assert.equal(
          await p.getByRole("button", { name: "Review redemption" }).count(),
          0,
        );
      if (state === "maturity") {
        assert.equal(
          await p.getByRole("button", { name: "Review redemption" }).count(),
          0,
        );
        await p
          .getByText("Redemption opens at block", { exact: false })
          .waitFor();
        await p.getByRole("button", { name: "Sell", exact: true }).click();
        await p.getByRole("button", { name: "Prepare offer" }).waitFor();
      }
      if (state === "partial")
        assert.match(
          await p
            .getByRole("region", { name: "Market financial state" })
            .innerText(),
          /0\.05/,
        );
    }
    if (["rpc", "stale", "missing-history"].includes(state)) {
      await firstMarket().click();
      await p.getByRole("heading", { name: "Market unavailable" }).waitFor();
      assert.equal(
        await p.getByRole("region", { name: "Selected position" }).count(),
        0,
      );
    }
    if (state === "nodeploy") {
      assert(
        await p
          .getByRole("button", { name: "Find markets", exact: true })
          .isDisabled(),
      );
      await p.getByLabel("Market link or identity").fill(id);
      await p.getByRole("button", { name: "Open market", exact: true }).click();
      await p.getByRole("heading", { name: "Market unavailable" }).waitFor();
    }
    if (state === "empty") {
      await p
        .getByRole("heading", { name: "No verified markets yet" })
        .waitFor();
      await p
        .getByRole("button", { name: "Find markets", exact: true })
        .click();
      assert.equal(await p.locator(".market-table tbody tr").count(), 2);
    }
    if (["pending", "committed"].includes(state)) {
      await p
        .getByRole("navigation")
        .getByRole("button", { name: "Activity", exact: true })
        .click();
      await p
        .getByText("Controlled assignment fixture", { exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("link", { name: /View transaction on explorer/ })
          .count(),
        0,
      );
    }
    if (state === "funding-ready") {
      await firstMarket().click();
      await p.getByRole("button", { name: "Review activation" }).waitFor();
      assert.equal(
        await p.getByRole("button", { name: "Review closure" }).count(),
        0,
      );
    }
    if (state === "settled") {
      await firstMarket().click();
      await p.getByRole("button", { name: "Review closure" }).waitFor();
      await position(1).click();
      assert.equal(
        await p.getByRole("button", { name: "Review redemption" }).count(),
        0,
      );
    }
    if (state === "loading")
      assert.equal(await p.locator("main").getAttribute("aria-busy"), "true");
    await reflow(p, state);
    await scan(p, state);
    await p.screenshot({
      path: out + `/state-${state}-375.png`,
      fullPage: true,
    });
    check(state + " bounded presentation state");
  }
  await fixture();
  await firstMarket().click();
  await position(1).click();
  await p.getByRole("button", { name: "Sell", exact: true }).click();
  await p.getByLabel("Buyer address").fill("ckt1_controlled_buyer_fixture");
  await p.getByRole("button", { name: "Prepare offer", exact: true }).click();
  await p.getByText("Offer file ready", { exact: true }).waitFor();
  const download = p.waitForEvent("download");
  await p.getByRole("button", { name: "Save offer file" }).click();
  assert.equal(
    JSON.parse(fs.readFileSync(await (await download).path(), "utf8"))
      .neverSubmit,
    true,
  );
  await p.getByRole("button", { name: "Import offer", exact: true }).click();
  await p.locator("input[type=file]").setInputFiles({
    name: "offer.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"fixture":true,"neverSubmit":true}'),
  });
  await p
    .getByRole("button", { name: "Review & add signature", exact: true })
    .click();
  await p.getByRole("dialog").waitFor();
  await scan(p, "paid assignment review");
  await p.screenshot({
    path: out + "/assignment-review-375.png",
    fullPage: false,
  });
  assert(
    await p
      .getByRole("button", { name: "Close transaction review" })
      .evaluate((el) => el === document.activeElement),
  );
  await p.keyboard.press("Escape");
  assert.equal(await p.getByRole("dialog").count(), 0);
  assert(
    await p
      .getByRole("button", { name: "Review & add signature" })
      .evaluate((el) => el === document.activeElement),
  );
  await p.getByRole("button", { name: "Review & submit", exact: true }).click();
  await p.getByRole("button", { name: "Confirm UI fixture" }).click();
  await p.getByText("Fixture review confirmed.", { exact: false }).waitFor();
  check(
    "Offer file exchange and exact review dialog/focus (labelled fixture, no signing)",
  );
  await p
    .getByRole("navigation")
    .getByRole("button", { name: "Create market", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Review market creation", exact: true })
    .click();
  await p.getByRole("dialog").getByText("322 CKB", { exact: true }).waitFor();
  await p.screenshot({ path: out + "/create-review-375.png", fullPage: false });
  await p.keyboard.press("Escape");
  assert.equal(evidence.pageErrors.length, 0);
  assert(!evidence.rpcMethods.includes("send_transaction"));
  check("No page errors or public broadcast");
  evidence.complete = true;
  save();
  console.log("WO13_BROWSER_PASS", out);
} catch (e) {
  evidence.failure = String(e);
  save();
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stop();
}
