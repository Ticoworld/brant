// NODE-ONLY disposable test keys: this file is never imported by the browser app.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { discoverMarkets, marketView } from "../lib/pudge/market-reader.ts";
import {
  reviewLiveInputs,
  requireUnchanged,
  requirePublicApproval,
} from "../lib/pudge/approval.ts";
import { cccA } from "@ckb-ccc/core/advanced";
import { chromium } from "playwright-core";
import { ccc } from "@ckb-ccc/core";
import * as M from "../lib/pudge/market.ts";
const require = createRequire(import.meta.url),
  { Engine } = require("../../../labs/wo09-e2-capacity/src/engine.cjs"),
  C = require("../../../labs/rebuild/native/src/lib.cjs");
const root = path.resolve(import.meta.dirname, ".."),
  out = path.join(root, "evidence", "browser-native-" + Date.now());
fs.mkdirSync(out, { recursive: true });
const e = new Engine("wo10-browser");
fs.renameSync(e.out, out);
e.out = out;
const log = fs.openSync(out + "/next.log", "w");
let next: any, browser: any;
const legacy = (t: ccc.Transaction) => {
  const x = C.camel(cccA.JsonRpcTransformers.transactionFrom(t));
  for (const dep of x.cellDeps)
    if (dep.depType === "dep_group") dep.depType = "depGroup";
  return x;
};
const save = (name: string, v: unknown) =>
  fs.writeFileSync(out + "/" + name + ".json", M.stringify(v) + "\n");
const cl = (c: any) => ({
  outPoint: c.outPoint,
  cellOutput: { capacity: c.capacity.toString(), lock: c.lock, type: c.type },
  outputData: c.data || "0x",
});
(async () => {
  try {
    await e.start();
    await e.deploy(
      "market",
      path.resolve(
        root,
        "../../labs/wo09-unified/build/merkle_market_configured",
      ),
    );
    const d = {
      network: "local",
      genesis: e.gen.header.hash,
      codeHash: e.codes.market.hash,
      code: e.codes.market.outPoint,
      secp: e.secp,
    };
    save("deployment", d);
    const client = new ccc.ClientPublicTestnet({
      url: "http://127.0.0.1:19224",
      fallbacks: [],
    });
    const known = client.getKnownScript.bind(client);
    client.getKnownScript = async (name: any) =>
      name === ccc.KnownScript.Secp256k1Blake160
        ? ccc.ScriptInfo.from({
            codeHash: C.locks[0].codeHash,
            hashType: "type",
            cellDeps: [{ cellDep: e.secp }],
          })
        : known(name);
    const signers = C.keys.map(
      (key: string) => new ccc.SignerCkbPrivateKey(client, key),
    );
    next = spawn(
      process.execPath,
      [
        root + "/node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "--port",
        "3100",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NEXT_PUBLIC_LOCAL_FIXTURE: "1",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", log, log],
      },
    );
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch("http://127.0.0.1:3100/fixture")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (x: any) => {
      errors.push(String(x));
      console.error("BROWSER_ERROR", String(x));
    });
    await page.goto("http://127.0.0.1:3100/fixture");
    await page.waitForFunction(
      () => !!(window as any).tradeFixture,
      undefined,
      { timeout: 60000 },
    );
    const prepare = async (
      action: string,
      roles: number[],
      i = 0,
      amount = "0",
    ) =>
      page.evaluate(
        async ({ action, roles, wallets, d, i, amount }: any) => {
          const w = window as any,
            M = w.tradeFixture;
          if (action === "create") {
            const b = M.create(
              d,
              M.ccc.Cell.from(wallets[0]),
              M.ccc.Script.from(wallets[0].cellOutput.lock),
              2,
              12500000n,
              25000000n,
              0n,
            );
            w.testMarket = b.next;
            return JSON.parse(M.stringify(b.tx));
          }
          const m = w.testMarket,
            b = M.build(
              d,
              m,
              action,
              wallets.map((x: any) => M.ccc.Cell.from(x)),
              i,
              BigInt(amount),
            );
          w.nextMarket = b.next;
          return JSON.parse(M.stringify(b.tx));
        },
        {
          action,
          roles,
          wallets: roles.map((r) => cl(e.wallets[r])),
          d,
          i,
          amount,
        },
      );
    const send = async (label: string, raw: any, roles: number[]) => {
      let t = ccc.Transaction.from(raw);
      const rawHash = t.hash();
      assert.equal(
        await reviewLiveInputs(M.httpRpc("http://127.0.0.1:19224"), t),
        M.FEE,
      );
      for (const r of roles) t = await signers[r].signTransaction(t);
      assert.equal(
        t.hash(),
        rawHash,
        "wallet preparation changed raw signed terms",
      );
      const outs = await e.send(label, legacy(t));
      return { outs, tx: t };
    };
    const update = async (outs: any[], roles: number[]) => {
      roles.forEach((r, i) => (e.wallets[r] = outs[i + 1]));
      await page.evaluate((cell: any) => {
        const w = window as any;
        w.testMarket = w.nextMarket ?? w.testMarket;
        w.testMarket.cell = w.tradeFixture.ccc.Cell.from(cell);
        w.nextMarket = undefined;
      }, cl(outs[0]));
    };
    let p = await prepare("create", [0]);
    let result = await send("browser_CCC_create", [p][0], [0]);
    e.wallets[0] = result.outs[1];
    await update(result.outs, [0]);
    for (const [i, role] of [
      [0, 0],
      [1, 1],
    ]) {
      p = await prepare("contribute", [role], i, "12500000");
      result = await send("browser_CCC_enroll_" + i, p, [role]);
      await update(result.outs, [role]);
    }
    p = await prepare("activate", [0]);
    result = await send("browser_CCC_creator_activation", p, [0]);
    await update(result.outs, [0]);
    const initial = await page.evaluate(() => {
      const w = window as any;
      return { id: w.testMarket.id, root: w.testMarket.tree.root };
    });
    const recovered = await page.evaluate(
      async ({ d, id }: any) => {
        const w = window as any,
          M = w.tradeFixture;
        w.testMarket = null;
        w.testMarket = await M.recover(M.httpRpc("/api/local-rpc"), d, id);
        return {
          root: w.testMarket.tree.root,
          records: JSON.parse(M.stringify(w.testMarket.tree.records)),
        };
      },
      { d, id: initial.id },
    );
    assert.equal(recovered.root, initial.root);
    save("fresh-browser-recovery", recovered);
    const missingHistory = M.httpRpc("http://127.0.0.1:19224");
    await assert.rejects(
      () =>
        M.recover(
          async (method, params) =>
            method === "get_transaction"
              ? { transaction: null, tx_status: { status: "unknown" } }
              : missingHistory(method, params),
          d as any,
          initial.id,
        ),
      /historical witness/,
    );
    await assert.rejects(
      () =>
        M.verifyDeployment(missingHistory, {
          ...d,
          genesis: ("0x" + "00".repeat(32)) as any,
        } as any),
      /Wrong network/,
    );
    save("recovery-fail-closed", {
      missing_history:
        "Controlled RPC withholding rejected; not a chain rejection",
      wrong_network: "Rejected before signing",
    });
    // Read-only market discovery through a controlled indexer adapter over authentic live native Cells.
    const nativeRpc = M.httpRpc("http://127.0.0.1:19224");
    const actualMarket = await M.recover(nativeRpc, d as any, initial.id);
    const point = {
      tx_hash: actualMarket.cell.outPoint.txHash,
      index: ccc.numToHex(actualMarket.cell.outPoint.index),
    };
    const liveMarket = await nativeRpc("get_live_cell", [point, true]);
    const indexerRpc = async (method: string, params: any[]) =>
      method === "get_cells" && params[0]?.script?.args === "0x"
        ? {
            objects: [
              {
                out_point: point,
                output: liveMarket.cell.output,
                output_data: liveMarket.cell.data.content,
              },
            ],
            last_cursor: "0x01",
          }
        : nativeRpc(method, params);
    const directory = await discoverMarkets(indexerRpc, d as any);
    assert.equal(directory.markets.length, 1);
    assert.equal(directory.failures.length, 0);
    assert.equal(directory.markets[0].id, initial.id);
    const withheld = await discoverMarkets(
      async (method, params) =>
        method === "get_transaction"
          ? { transaction: null, tx_status: { status: "unknown" } }
          : indexerRpc(method, params),
      d as any,
    );
    assert.equal(withheld.markets.length, 0);
    assert.equal(withheld.failures.length, 1);
    const overview = marketView(
      actualMarket,
      C.U.scriptToHash(C.locks[0]),
      null,
    );
    assert.equal(overview.contributed, "0.25");
    assert.equal(overview.backing, "0.2");
    assert.equal(overview.creatorAllocation, "0.05");
    save("market-directory-read", {
      qualification:
        "Controlled indexer adapter; contract/state/witness/live-Cell verification use the actual private CKB node. Not a native indexer or Pudge claim.",
      verified_markets: directory.markets.length,
      unavailable_history_excluded: withheld.failures.length,
      overview,
    });
    // Actual application read-only journey over the committed private-chain state.
    // No browser signer is injected. The manifest explicitly disables public signing.
    const appPage = await browser.newPage();
    let withholdAppHistory = false;
    const appRpcMethods: string[] = [];
    await appPage.route("**/pudge.json", (route: any) =>
      route.fulfill({
        json: { ...d, network: "pudge", publicSigningEnabled: false },
      }),
    );
    await appPage.route("https://testnet.ckb.dev/**", async (route: any) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
        return;
      }
      const req = route.request().postDataJSON();
      appRpcMethods.push(req.method);
      assert(
        [
          "get_cells",
          "get_live_cell",
          "get_transaction",
          "get_block_by_number",
          "get_tip_header",
        ].includes(req.method),
        "Unexpected application RPC " + req.method,
      );
      let response;
      try {
        if (withholdAppHistory && req.method === "get_transaction")
          response = { transaction: null, tx_status: { status: "unknown" } };
        else if (
          req.method === "get_cells" &&
          req.params[0]?.script_type === "type"
        ) {
          const script = req.params[0].script;
          response = {
            objects:
              script.code_hash === d.codeHash &&
              (script.args === "0x" || script.args === initial.id)
                ? [
                    {
                      out_point: point,
                      output: liveMarket.cell.output,
                      output_data: liveMarket.cell.data.content,
                    },
                  ]
                : [],
            last_cursor: "0x01",
          };
        } else response = await nativeRpc(req.method, req.params);
        await route.fulfill({
          headers: { "access-control-allow-origin": "*" },
          json: { jsonrpc: "2.0", id: req.id, result: response },
        });
      } catch (err) {
        await route.fulfill({
          headers: { "access-control-allow-origin": "*" },
          json: {
            jsonrpc: "2.0",
            id: req.id,
            error: { code: -1, message: String(err) },
          },
        });
      }
    });
    await appPage.goto("http://127.0.0.1:3100/");
    await appPage
      .getByRole("heading", { name: "Markets", exact: true })
      .waitFor();
    await appPage
      .getByRole("button", { name: "Find markets", exact: true })
      .click();
    await appPage.getByRole("link", { name: /CKB-backed claims/ }).waitFor();
    await appPage.getByRole("link", { name: /CKB-backed claims/ }).click();
    await appPage
      .getByRole("heading", { name: "CKB-backed claims", exact: true })
      .waitFor();
    assert(new URL(appPage.url()).pathname === "/market/" + initial.id);
    assert.match(await appPage.locator(".market-ledger").innerText(), /0.25/);
    assert.match(await appPage.locator(".market-ledger").innerText(), /0.05/);
    await appPage
      .getByRole("button", { name: "Open position 1", exact: true })
      .click();
    await appPage
      .getByRole("region", { name: "Selected position", exact: true })
      .waitFor();
    assert.equal(
      await appPage
        .getByRole("button", { name: "Review redemption", exact: true })
        .count(),
      0,
    );
    await appPage.reload();
    await appPage
      .getByRole("region", { name: "Selected position", exact: true })
      .waitFor();
    assert.match(await appPage.locator(".market-ledger").innerText(), /0.2/);
    assert(!(await appPage.locator("body").innerText()).includes(initial.id));
    await appPage.screenshot({
      path: out + "/actual-market-workspace.png",
      fullPage: true,
    });
    withholdAppHistory = true;
    await appPage.getByRole("button", { name: "Refresh", exact: true }).click();
    await appPage
      .getByRole("heading", { name: "Market unavailable", exact: true })
      .waitFor();
    assert.equal(
      await appPage
        .getByRole("region", { name: "Selected position", exact: true })
        .count(),
      0,
    );
    save("actual-application-market-journey", {
      qualification:
        "Actual browser app over committed private CKB state with a controlled read-only RPC/indexer adapter and manifest. No external signer, Pudge transaction or production claim.",
      url_path: "/market/" + initial.id,
      discovery: "authenticated native state reconstructed",
      reload_without_receipts: true,
      withheld_history: "workspace blocked; no position actions",
      public_signing_enabled: false,
      rpc_methods: appRpcMethods,
    });
    await appPage.close();
    // Next dev can refresh the builder tab when the dynamic app route is first compiled.
    // Restore from committed history, not an invented in-memory market.
    await page.waitForFunction(() => !!(window as any).tradeFixture);
    const restoredBuilder = await page.evaluate(
      async ({ d, id }: any) => {
        const w = window as any,
          M = w.tradeFixture,
          lost = !w.testMarket;
        w.testMarket = await M.recover(M.httpRpc("/api/local-rpc"), d, id);
        return { lost_in_memory_state: lost, root: w.testMarket.tree.root };
      },
      { d, id: initial.id },
    );
    assert.equal(restoredBuilder.root, initial.root);
    save("builder-tab-reconstruction", restoredBuilder);

    p = await prepare("assign", [0, 1], 0, "1000000");
    const review = await M.reviewAssignment(
      M.httpRpc("http://127.0.0.1:19224"),
      d as any,
      p,
      0,
      1000000n,
    );
    assert.equal(review.seller, C.U.scriptToHash(C.locks[0]));
    assert.throws(
      () =>
        requirePublicApproval({
          network: "pudge",
          code: null,
          publicSigningEnabled: false,
        }),
      /not approved/,
    );
    assert.throws(
      () =>
        requirePublicApproval({
          network: "pudge",
          code: d.code,
          publicSigningEnabled: false,
        }),
      /not approved/,
    );
    const excessiveFee = ccc.Transaction.from(p);
    excessiveFee.outputs[1].capacity -= 1n;
    await assert.rejects(
      () => reviewLiveInputs(M.httpRpc("http://127.0.0.1:19224"), excessiveFee),
      /Unexpected fee/,
    );
    assert.throws(
      () => requireUnchanged(excessiveFee, ccc.Transaction.from(p).hash()),
      /changed transaction terms/,
    );
    save("ui-review-guards", {
      unapproved_manifest: "rejected even with code outpoint",
      altered_fee: "rejected using actual native live inputs",
      altered_body: "requires fresh consent",
    });
    const bad = structuredClone(p);
    bad.outputs[1].capacity = (BigInt(bad.outputs[1].capacity) - 1n).toString();
    await assert.rejects(
      () =>
        M.reviewAssignment(
          M.httpRpc("http://127.0.0.1:19224"),
          d as any,
          bad,
          0,
          1000000n,
        ),
      /differs/,
    );
    save("assignment-review-rejection", {
      case: "changed seller payout",
      result: "Rejected before signing",
    });
    const missingSeller = await signers[1].signTransaction(
      ccc.Transaction.from(p),
    );
    await e.reject(
      "native_missing_seller_signature",
      legacy(missingSeller),
      /ValidationFailure/,
    );
    const unpaid = ccc.Transaction.from(p);
    unpaid.outputs[1].capacity -= 1000000n;
    unpaid.outputs[2].capacity += 1000000n;
    let unpaidSigned = await signers[0].signTransaction(unpaid);
    unpaidSigned = await signers[1].signTransaction(unpaidSigned);
    await e.reject(
      "native_unpaid_assignment",
      legacy(unpaidSigned),
      /error code 71/,
    );
    result = await send(
      "browser_CCC_atomic_paid_assignment_two_signers",
      p,
      [0, 1],
    );
    await update(result.outs, [0, 1]);
    let former = false;
    try {
      await prepare("redeem", [0], 0, "10000000");
    } catch (err) {
      former = /Current owner/.test(String(err));
    }
    assert(former);
    save("former-owner-builder-denial", { denied: former });
    // Bypass only the UI preflight to test the unchanged covenant's ordinary former-owner denial.
    const market = await page.evaluate(() => {
      const w = window as any,
        M = w.tradeFixture;
      return {
        id: w.testMarket.id,
        records: JSON.parse(M.stringify(w.testMarket.tree.records)),
      };
    });
    p = await prepare("redeem", [1], 0, "5000000");
    const formerTx = ccc.Transaction.from(p);
    formerTx.inputs[1].previousOutput = ccc.OutPoint.from(
      e.wallets[0].outPoint,
    );
    formerTx.outputs[1] = ccc.CellOutput.from({
      capacity: e.wallets[0].capacity + 5000000n - M.FEE,
      lock: C.locks[0],
    });
    const formerSigned = await signers[0].signTransaction(formerTx);
    await e.reject(
      "native_former_owner_denial",
      legacy(formerSigned),
      /error code 60/,
    );
    const invalidSig = await signers[1].signTransaction(
      ccc.Transaction.from(p),
    );
    const wa = invalidSig.getWitnessArgs(1)!;
    wa.lock = "0x" + "00".repeat(65);
    invalidSig.setWitnessArgs(1, wa);
    await e.reject(
      "native_wrong_owner_signature",
      legacy(invalidSig),
      /ValidationFailure/,
    );
    const stale = structuredClone(p);
    result = await send("browser_CCC_partial_owner_redemption", p, [1]);
    await update(result.outs, [1]);
    let st = ccc.Transaction.from(stale);
    st = await signers[1].signTransaction(st);
    await e.reject(
      "stale_consumed_vault",
      legacy(st),
      /Unknown|OutPoint|Dead|spent/,
      "send_transaction",
    );
    await assert.rejects(
      () =>
        reviewLiveInputs(
          M.httpRpc("http://127.0.0.1:19224"),
          ccc.Transaction.from(stale),
        ),
      /input was spent/,
    );
    save("ui-stale-review-guard", {
      result: "Spent native input detected; fresh consent required",
    });
    const after = await page.evaluate(
      async ({ d, id }: any) => {
        const w = window as any,
          M = w.tradeFixture;
        w.testMarket = await M.recover(M.httpRpc("/api/local-rpc"), d, id);
        return JSON.parse(M.stringify(w.testMarket.tree.records));
      },
      { d, id: initial.id },
    );
    assert.equal(after[0].b, "5000000");
    const afterView = marketView(
      await M.recover(nativeRpc, d as any, initial.id),
      C.U.scriptToHash(C.locks[1]),
      null,
    );
    assert.equal(afterView.backing, "0.15");
    assert.equal(afterView.creatorAllocation, "0.05");
    assert.equal(afterView.initialBacking, "0.2");
    save("market-accounting-after-redemption", afterView);
    for (const [i, a] of [
      [0, "5000000"],
      [1, "10000000"],
    ]) {
      p = await prepare("redeem", [1], Number(i), String(a));
      result = await send("browser_CCC_full_redemption_" + i, p, [1]);
      await update(result.outs, [1]);
    }
    p = await prepare("close", [0]);
    await send("browser_CCC_lawful_closure", p, [0]);
    // Ordinary application screenshot/connector render, no extension impersonation.
    await page.goto("http://127.0.0.1:3100");
    await page
      .locator("header")
      .getByRole("button", { name: "Connect wallet", exact: true })
      .waitFor({ timeout: 90000 });
    await page.screenshot({ path: out + "/app.png", fullPage: true });
    save("browser-result", {
      transactions: e.events.length,
      chain: "controlled native CKB0.210.0",
      browser: "system Chromium",
      signers:
        "actual CCC SignerCkbPrivateKey in Node only; browser never received keys",
      wallet_extension_tested: false,
      page_errors: errors,
      contract_hash: d.codeHash,
    });
    assert.equal(errors.length, 0);
    e.close();
    console.log("WO10_BROWSER_NATIVE_PASS", out);
  } catch (err) {
    e.close(err);
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (next) next.kill("SIGTERM");
  }
})();
