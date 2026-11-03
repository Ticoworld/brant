// Controlled presentation tests; never injects a wallet or constructs/broadcasts a Pudge transaction.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  out = path.resolve(
    root,
    "../../labs/wo13-trade-experience/evidence/browser-" + Date.now(),
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
async function scan(p, label) {
  await p.addScriptTag({ content: axe });
  const a = await p.evaluate(
    async () =>
      await window.axe.run(document.querySelector(".app-shell"), {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      }),
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
  for (const width of [1440, 768, 375]) {
    await p.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await p.goto(base);
    await p.getByRole("heading", { name: "Markets", exact: true }).waitFor();
    await p.getByText("Deployment not approved", { exact: true }).waitFor();
    await p.screenshot({ path: out + `/markets-${width}.png`, fullPage: true });
    await reflow(p, "markets " + width);
    await scan(p, "markets " + width);
    for (const tab of ["My Positions", "Create Market", "Activity"]) {
      await p
        .getByRole("navigation")
        .getByRole("button", { name: tab, exact: true })
        .click();
      await p.getByRole("heading", { name: tab, exact: true }).waitFor();
      await reflow(p, tab + " " + width);
      await scan(p, tab + " " + width);
      await p.screenshot({
        path:
          out + "/" + tab.replaceAll(" ", "-").toLowerCase() + `-${width}.png`,
        fullPage: true,
      });
      if (tab === "Create Market")
        assert(
          await p
            .getByRole("button", {
              name: "Review market creation",
              exact: true,
            })
            .isDisabled(),
        );
    }
  }
  await p.goto(base);
  await p.getByLabel("Market link or identity").fill("0x" + "12".repeat(32));
  await p.getByRole("button", { name: "Open market", exact: true }).click();
  await p
    .getByRole("alert")
    .filter({ hasText: "Deployment is not approved" })
    .waitFor();
  check(
    "Unapproved manifest rejects recovery/signing before any wallet request",
  );
  await p.goto(base + "/experience-fixture");
  await p.getByRole("heading", { name: "Local UI fixture disabled" }).waitFor();
  check("Production UI fixtures disabled");
  assert(!evidence.rpcMethods.includes("send_transaction"));
  await stop();
  await start("fixture");
  for (const state of [
    "active",
    "funding",
    "unsupported",
    "maturity",
    "pending",
    "committed",
    "rpc",
    "stale",
    "loading",
    "nodeploy",
  ]) {
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto(base + "/experience-fixture?state=" + state);
    await p
      .getByText("CONTROLLED LOCAL UI FIXTURE", { exact: false })
      .waitFor();
    if (["active", "funding", "maturity"].includes(state)) {
      await p
        .getByRole("navigation")
        .getByRole("button", { name: "My Positions", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "My Positions", exact: true })
        .waitFor();
      await reflow(p, state);
      await scan(p, state);
      if (state === "maturity")
        assert(
          await p
            .getByRole("button", { name: "Review redemption" })
            .isDisabled(),
        );
    }
    if (["pending", "committed", "stale"].includes(state)) {
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
    if (["unsupported", "rpc", "stale"].includes(state))
      assert(await p.locator(".status-bar[role=alert]").isVisible());
    if (state === "loading")
      assert.equal(await p.locator("main").getAttribute("aria-busy"), "true");
    await reflow(p, state + " fixture");
    await p.screenshot({
      path: out + "/fixture-" + state + "-375.png",
      fullPage: true,
    });
    check(state + " labelled presentation state");
  }
  await p.goto(base + "/experience-fixture?state=active");
  await p
    .getByRole("navigation")
    .getByRole("button", { name: "My Positions", exact: true })
    .click();
  await p.getByRole("button", { name: "Prepare offer", exact: true }).click();
  await p.getByText("Offer file ready", { exact: true }).waitFor();
  const download = p.waitForEvent("download");
  await p.getByRole("button", { name: "Save offer file" }).click();
  const dl = await download;
  const file = await dl.path();
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).neverSubmit, true);
  check("Offer file export (nontransaction fixture)");
  await p
    .getByRole("button", { name: "2. Import & sign", exact: true })
    .click();
  await p.locator("input[type=file]").setInputFiles({
    name: "offer.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"fixture":true,"neverSubmit":true}'),
  });
  await p
    .getByRole("button", { name: "Review & add signature", exact: true })
    .click();
  await p.getByRole("dialog").waitFor();
  await scan(p, "assignment review dialog");
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
  check("Native dialog Escape and focus return");
  await p.getByRole("button", { name: "Review & submit", exact: true }).click();
  await p.getByRole("button", { name: "Confirm UI fixture" }).click();
  await p.getByText("Fixture review confirmed.", { exact: false }).waitFor();
  check("Assignment review confirmation (no signing)");
  // Fresh captures avoid leaving axe's temporary focus styling in presentation screenshots.
  await p.goto(base + '/experience-fixture?state=active');
  await p.getByRole('navigation').getByRole('button',{name:'My Positions',exact:true}).click();
  await p.setViewportSize({width:1440,height:1000});
  await p.screenshot({path:out+'/positions-1440.png',fullPage:true});
  await p.getByRole('navigation').getByRole('button',{name:'Create Market',exact:true}).click();
  await p.getByRole('button',{name:'Review market creation',exact:true}).click();
  await p.getByRole('dialog').waitFor();
  await p.getByRole('dialog').getByText('322 CKB',{exact:true}).waitFor();
  await p.screenshot({path:out+'/create-review-1440.png',fullPage:false});
  await p.keyboard.press('Escape');
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
