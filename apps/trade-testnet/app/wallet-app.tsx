"use client";
import { Provider, useCcc, useSigner } from "@ckb-ccc/connector-react";
import { ccc } from "@ckb-ccc/core";
import { useEffect, useRef, useState } from "react";
import * as M from "../lib/pudge/market";
import {
  requirePublicApproval,
  requireUnchanged,
  reviewLiveInputs,
} from "../lib/pudge/approval";
import {
  marketIdentity,
  routeFromUrl,
  routeUrl,
  marketView,
} from "../lib/pudge/market-reader";
import type {
  Activity,
  Fields,
  MarketView,
  PageRoute,
  Review,
} from "../lib/pudge/types";
import PudgeExperience from "./pudge-experience";
const connection = ccc.ClientPublicTestnet.open({
  urls: ["https://testnet.ckb.dev/", "https://testnet.ckbapp.dev/"],
});
const client = connection.value,
  rpc = M.httpRpc("https://testnet.ckb.dev/");
const initial: Fields = {
  id: "",
  creator: "",
  slots: "2",
  maturity: "0",
  index: "0",
  amount: "0.125",
  buyer: "",
  price: "0.01",
  envelope: "",
};
const sh = (s: string) => {
  if (!/^\d+(\.\d{1,8})?$/.test(s))
    throw Error("Enter a CKB amount with up to 8 decimal places.");
  const [a, b = ""] = s.split(".");
  return BigInt(a) * M.UNIT + BigInt(b.padEnd(8, "0"));
};
const fmt = (n: bigint) =>
  (n < 0n ? "−" : "") + M.formatCkb(n < 0n ? -n : n).replace(/\.?0+$/, "");
export default function WalletApp({
  initialMarketId,
  initialView = "Markets",
}: {
  initialMarketId?: string;
  initialView?: "Markets" | "My Positions" | "Create Market" | "Activity";
}) {
  return (
    <Provider
      name="ROVEKO"
      defaultClient={client}
      clientOptions={[{ name: "CKB Pudge (testnet)", client }]}
    >
      <Journey initialMarketId={initialMarketId} initialView={initialView} />
    </Provider>
  );
}
function Journey({
  initialMarketId,
  initialView,
}: {
  initialMarketId?: string;
  initialView: "Markets" | "My Positions" | "Create Market" | "Activity";
}) {
  const conn = useCcc(),
    signer = useSigner();
  const [fields, setFields] = useState<Fields>(initial),
    [address, setAddress] = useState(""),
    [ownerHash, setOwnerHash] = useState(""),
    [manifest, setManifest] = useState<M.Deployment | null>(null),
    [market, setMarket] = useState<M.Market | null>(null),
    [tip, setTip] = useState<string | null>(null),
    [status, setStatus] = useState(
      "Connect a supported testnet wallet, or open a known market to inspect it.",
    ),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [deploymentState, setDeploymentState] = useState<
      "Checking" | "Not deployed" | "Configured" | "Unavailable"
    >("Checking"),
    [activity, setActivity] = useState<Activity[]>([]),
    [review, setReview] = useState<Review | null>(null);
  const [route, setRoute] = useState<PageRoute>(
      initialMarketId
        ? { view: "Market", id: initialMarketId }
        : { view: initialView },
    ),
    [known, setKnown] = useState<Record<string, M.Market>>({}),
    [publicMarkets, setPublicMarkets] = useState<Record<string, MarketView>>({}),
    [reading, setReading] = useState(false),
    [refreshKey, setRefreshKey] = useState(0),
    [discovery, setDiscovery] = useState<{
      state: "idle" | "complete" | "partial" | "unavailable";
      message: string;
      scanned: number;
      next?: string;
    }>({
      state: "idle",
      message: "Search the verified deployment or open a market link.",
      scanned: 0,
    });
  const routeRef = useRef(route);
  routeRef.current = route;
  const registryLoad = useRef<Promise<{
    found: Record<string, MarketView>;
    failures: string[];
    scanned: number;
  }> | null>(null);
  const execute = useRef<null | (() => Promise<void>)>(null),
    inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    fetch("/pudge.json")
      .then((r) => {
        if (!r.ok) throw Error("Manifest unavailable");
        return r.json();
      })
      .then((d) => {
        if (active) {
          setManifest(d);
          setDeploymentState(
            d.code && d.publicSigningEnabled === true
              ? "Configured"
              : "Not deployed",
          );
        }
      })
      .catch(() => {
        if (active) setDeploymentState("Unavailable");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!manifest) return;
    let active = true;
    if (!registryLoad.current) {
      registryLoad.current = (async () => {
        const response = await fetch("/pudge-markets.json", {
          cache: "no-store",
        });
        if (!response.ok) throw Error("Public Pudge registry unavailable.");
        const registry = await response.json();
        if (registry.network !== "pudge" || !Array.isArray(registry.markets))
          throw Error("Public Pudge registry is invalid.");
        const found: Record<string, MarketView> = {};
        const failures: string[] = [];
        for (const item of registry.markets) {
          try {
            const id = marketIdentity(item.id);
            if (
              item.deployment?.codeHash !== manifest.codeHash ||
              item.deployment?.marketScript?.args !== id
            )
              throw Error("Registry identity does not match the deployed market.");
            const response = await fetch(
              "/api/pudge/market-state?id=" + encodeURIComponent(id),
              { cache: "no-store" },
            );
            const result = await response.json();
            if (!response.ok) throw Error(result.error ?? "Market recovery failed.");
            found[id] = result.market as MarketView;
          } catch (e) {
            failures.push(e instanceof Error ? e.message : String(e));
          }
        }
        return { found, failures, scanned: registry.markets.length };
      })();
    }
    registryLoad.current
      .then(({ found, failures, scanned }) => {
        if (!active) return;
        setPublicMarkets((current) => ({ ...current, ...found }));
        setDiscovery({
          state: failures.length
            ? Object.keys(found).length
              ? "partial"
              : "unavailable"
            : "complete",
          message: failures.length
            ? Object.keys(found).length
              ? "Some registered markets could not be reconstructed."
              : failures[0]
            : Object.keys(found).length + " registered Pudge market verified.",
          scanned,
        });
      })
      .catch((e) => {
        if (!active) return;
        setDiscovery({
          state: "unavailable",
          message: e instanceof Error ? e.message : String(e),
          scanned: 0,
        });
      });
    return () => {
      active = false;
    };
  }, [manifest]);
  useEffect(() => {
    setAddress("");
    setOwnerHash("");
    setReview(null);
    execute.current = null;
  }, [signer]);
  function navigate(next: PageRoute, replace = false) {
    setReview(null);
    execute.current = null;
    if (next.view === "Market") {
      setMarket(null);
      setFields((f) => ({
        ...f,
        id: next.id ?? "",
        index: String(next.claim ?? 0),
        envelope: "",
      }));
    }
    setRoute(next);
    window.history[replace ? "replaceState" : "pushState"](
      {},
      "",
      routeUrl(next),
    );
  }
  useEffect(() => {
    const sync = () => {
      try {
        const next = routeFromUrl(window.location.href);
        setReview(null);
        execute.current = null;
        setMarket(null);
        setRoute(next);
        if (next.id)
          setFields((f) => ({
            ...f,
            id: next.id!,
            index: String(next.claim ?? 0),
            envelope: "",
          }));
      } catch (e) {
        setStatus(String(e));
        setError(true);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (route.view !== "Market" || !route.id) {
      setReading(false);
      return;
    }
    let active = true;
    setReading(true);
    setError(false);
    setTip(null);
    setStatus("Loading verified market state from Pudge.");
    const id = route.id;
    (async () => {
      try {
        const d = await fetch("/pudge.json").then((r) => {
          if (!r.ok) throw Error("Deployment manifest unavailable.");
          return r.json();
        });
        if (d.network !== "pudge")
          throw Error("Read-only workspace requires Pudge.");
        const response = await fetch(
          "/api/pudge/market-state?id=" + encodeURIComponent(marketIdentity(id)),
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "Market recovery failed.");
        const recovered = result.market as MarketView;
        if (active) {
          setPublicMarkets((current) => ({ ...current, [recovered.id]: recovered }));
          const i = routeRef.current.claim,
            r = i !== undefined ? recovered.positions[i] : undefined;
          if (r)
            setFields((f) => ({
              ...f,
              index: String(i),
              amount:
                recovered.phase === "Active"
                  ? r.backing
                  : r.contribution === "0"
                    ? recovered.minimum
                    : r.contribution,
            }));
          setTip(recovered.tip);
          setStatus(
            "Market reconstructed from committed history and its live Cell.",
          );
        }
      } catch (e) {
        if (active) {
          setMarket(null);
          setPublicMarkets((xs) => {
            const next = { ...xs };
            delete next[id];
            return next;
          });
          setStatus(e instanceof Error ? e.message : String(e));
          setError(true);
        }
      } finally {
        if (active) setReading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [route.view, route.id, refreshKey]);
  useEffect(() => {
    if (!signer || !ownerHash) return;
    let active = true;
    const recheck = async () => {
      try {
        const a = await signer.getRecommendedAddressObj();
        if (active && a.script.hash() !== ownerHash) {
          setAddress("");
          setOwnerHash("");
          setReview(null);
          execute.current = null;
          setStatus(
            "Wallet account changed. Check compatibility again before managing positions.",
          );
        }
      } catch {
        if (active) {
          setAddress("");
          setOwnerHash("");
          setReview(null);
          execute.current = null;
        }
      }
    };
    window.addEventListener("focus", recheck);
    return () => {
      active = false;
      window.removeEventListener("focus", recheck);
    };
  }, [signer, ownerHash]);
  const record = (a: Activity) => setActivity((xs) => [a, ...xs]);
  const run = async (f: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      await f();
    } catch (e) {
      setError(true);
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const update = (name: keyof Fields, value: string) => {
    setFields((f) => ({ ...f, [name]: value }));
    setReview(null);
    execute.current = null;
    if (name === "id") {
      setMarket(null);
      setTip(null);
    }
  };
  async function deployment() {
    const d = manifest ?? (await fetch("/pudge.json").then((r) => r.json()));
    requirePublicApproval(d);
    await M.verifyDeployment(rpc, d);
    setManifest(d);
    return d as M.Deployment;
  }
  async function lock() {
    if (!signer) throw Error("Connect a wallet first.");
    if (signer.client.addressPrefix !== "ckt")
      throw Error("Select CKB testnet in your wallet.");
    const a = await signer.getRecommendedAddressObj();
    try {
      M.standard(a.script);
    } catch (e) {
      setAddress("");
      setOwnerHash("");
      throw e;
    }
    setAddress(a.toString());
    setOwnerHash(a.script.hash());
    return a.script;
  }
  function identity() {
    const id = marketIdentity(fields.id);
    if (route.view === "Market" && route.id && marketIdentity(route.id) !== id)
      throw Error("Selected market changed; recover and review again.");
    return id;
  }
  async function current() {
    const d = await deployment(),
      id = identity(),
      m = await M.recover(rpc, d, id);
    setMarket(m);
    setKnown((xs) => ({ ...xs, [m.id]: m }));
    setActivity((xs) =>
      xs.some(
        (x) =>
          x.label === "Recovered market state" &&
          x.hash === m.cell.outPoint.txHash,
      )
        ? xs
        : [
            {
              label: "Recovered market state",
              state: "Committed",
              hash: m.cell.outPoint.txHash,
              detail:
                "Latest live market transaction verified through committed public history. Not a new submission.",
            },
            ...xs,
          ],
    );
    try {
      setTip(BigInt((await rpc("get_tip_header", [])).number).toString());
    } catch {
      setTip(null);
    }
    return { d, m };
  }
  async function live(tx: ccc.Transaction) {
    return reviewLiveInputs(rpc, tx);
  }
  async function checkRate(tx: ccc.Transaction) {
    if (!signer) throw Error("Connect a wallet first.");
    const rate = await signer.client.getFeeRate(),
      budget = (BigInt(tx.toBytes().length + 200) * rate) / 1000n + 1n;
    if (budget > M.FEE)
      throw Error(
        "Current fee conditions exceed this fixed-fee pilot budget. Do not silently change signed terms.",
      );
  }
  async function send(tx: ccc.Transaction, label: string) {
    if (!signer) throw Error("Connect a wallet first.");
    await live(tx);
    await checkRate(tx);
    const raw = tx.hash();
    record({
      label,
      state: "Awaiting wallet",
      detail: "Approve the exact reviewed outputs in your wallet.",
    });
    setStatus("Waiting for your wallet approval.");
    let signed: ccc.Transaction;
    try {
      signed = await signer.signTransaction(tx);
      requireUnchanged(signed, raw);
    } catch (e) {
      record({
        label,
        state: "Failed",
        detail: "Wallet signing did not complete; no broadcast by this step.",
      });
      throw e;
    }
    let hash: ccc.Hex;
    try {
      hash = await signer.client.sendTransaction(signed);
    } catch (e) {
      record({
        label,
        state: "Failed",
        detail:
          "Submission did not return a transaction hash. Check chain state before retrying.",
      });
      throw e;
    }
    record({
      label,
      state: "Pending",
      hash,
      detail: "Submitted; waiting for commitment. Do not resubmit blindly.",
    });
    setStatus(
      "Submitted. Waiting for commitment; submission is not settlement.",
    );
    try {
      await signer.client.waitTransaction(hash);
    } catch {
      record({
        label,
        state: "Unconfirmed",
        hash,
        detail:
          "Commitment unconfirmed. Inspect this transaction before any retry.",
      });
      throw Error(
        "Submission is unconfirmed. Check Activity before rebuilding or resubmitting.",
      );
    }
    record({
      label,
      state: "Committed",
      hash,
      detail:
        "Committed on Pudge. Additional confirmations remain a chain-risk consideration.",
    });
    setStatus(label + " committed.");
    return hash;
  }
  async function stage(
    tx: ccc.Transaction,
    title: string,
    lines: Review["lines"],
    owner: ccc.Hex,
    commit: () => Promise<void>,
    button = "Approve in wallet",
  ) {
    const fee = await live(tx);
    await checkRate(tx);
    execute.current = async () => {
      if ((await lock()).hash() !== owner)
        throw Error(
          "Wallet account changed. Rebuild and review with the intended owner.",
        );
      await live(tx);
      await commit();
    };
    setReview({
      title,
      hash: tx.hash(),
      fee: fmt(fee),
      lines,
      outputs: tx.outputs.map((o) => ({
        capacity: fmt(o.capacity),
        lock: M.stringify(o.lock),
      })),
      button,
    });
    setStatus(
      "Review the exact amounts and outputs before opening your wallet.",
    );
  }
  const check = () =>
    run(async () => {
      const owner = (await lock()).hash();
      const ids = Object.keys(publicMarkets);
      if (ids.length) {
        const entries = await Promise.all(
          ids.map(async (id) => {
            const response = await fetch(
              "/api/pudge/market-state?id=" +
                encodeURIComponent(id) +
                "&owner=" +
                encodeURIComponent(owner),
              { cache: "no-store" },
            );
            const result = await response.json();
            if (!response.ok) throw Error(result.error ?? "Position recovery failed.");
            return [id, result.market as MarketView] as const;
          }),
        );
        setPublicMarkets((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
      setStatus(
        "Wallet lock matches the ordinary CKB secp profile. Complete external-wallet signing is not yet accepted.",
      );
    });
  const refresh = () => {
    setReview(null);
    execute.current = null;
    setMarket(null);
    setRefreshKey((x) => x + 1);
  };
  const open = (value: string) => {
    try {
      const id = marketIdentity(value);
      const linked =
        value.includes("://") || value.startsWith("/")
          ? routeFromUrl(value)
          : undefined;
      navigate({
        view: "Market",
        id,
        ...(linked?.claim !== undefined ? { claim: linked.claim } : {}),
      });
    } catch (e) {
      setError(true);
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  const discover = () =>
    run(async () => {
      setDiscovery({ state: "idle", message: "", scanned: 0 });
      try {
        const response = await fetch("/pudge-markets.json", { cache: "no-store" });
        if (!response.ok) throw Error("Public Pudge registry unavailable.");
        const registry = await response.json();
        if (registry.network !== "pudge" || !Array.isArray(registry.markets))
          throw Error("Public Pudge registry is invalid.");
        const entries = await Promise.all(
          registry.markets.map(async (item: { id: string }) => {
            const id = marketIdentity(item.id);
            const resultResponse = await fetch(
              "/api/pudge/market-state?id=" + encodeURIComponent(id),
              { cache: "no-store" },
            );
            const result = await resultResponse.json();
            if (!resultResponse.ok)
              throw Error(result.error ?? "Market recovery failed.");
            return [id, result.market as MarketView] as const;
          }),
        );
        setPublicMarkets((current) => ({ ...current, ...Object.fromEntries(entries) }));
        setDiscovery({
          state: "complete",
          message: entries.length + " registered Pudge market verified.",
          scanned: entries.length,
        });
      } catch (e) {
        setDiscovery({
          state: "unavailable",
          message: e instanceof Error ? e.message : String(e),
          scanned: 0,
        });
        throw e;
      }
    });
  const create = () =>
    run(async () => {
      const d = await deployment(),
        l = await lock(),
        c = fields.creator
          ? (await ccc.Address.fromString(fields.creator, client)).script
          : l;
      M.standard(c);
      if (!/^\d+$/.test(fields.slots) || !/^\d+$/.test(fields.maturity))
        throw Error("Use whole numbers for slots and maturity.");
      const n = Number(fields.slots),
        w = await M.walletCell(rpc, l, 383n * M.UNIT + M.FEE),
        b = M.create(
          d,
          w,
          c,
          n,
          12500000n,
          BigInt(n) * 12500000n,
          BigInt(fields.maturity),
        );
      await stage(
        b.tx,
        "Create backed-claim market",
        [
          {
            label: "Shared capacity",
            value: "322 CKB, returned only at lawful closure",
          },
          { label: "Slots", value: String(n) },
          { label: "Minimum contribution", value: "0.125 CKB per slot" },
          {
            label: "Backing / creator proceeds",
            value: "80% reserved / 20% gross at activation",
          },
          { label: "Maturity block", value: fields.maturity },
          { label: "Creator lock", value: c.hash() },
        ],
        l.hash(),
        async () => {
          await send(b.tx, "Market creation");
          setFields((f) => ({ ...f, id: b.next.id }));
          const m = await M.recover(rpc, d, b.next.id);
          setKnown((xs) => ({ ...xs, [m.id]: m }));
          navigate({ view: "Market", id: m.id });
        },
      );
    });
  const action = (
    kind: "contribute" | "activate" | "refund" | "redeem" | "close",
  ) =>
    run(async () => {
      const { d, m } = await current(),
        l = await lock(),
        a = sh(fields.amount);
      if (
        kind === "redeem" &&
        m.maturity > 0n &&
        BigInt((await rpc("get_tip_header", [])).number) < m.maturity
      )
        throw Error("The redemption maturity block has not been reached.");
      let required = 61n * M.UNIT + M.FEE;
      if (kind === "contribute") required += a;
      const w = await M.walletCell(rpc, l, required),
        b = M.build(d, m, kind, [w], Number(fields.index), a),
        t = M.totals(m),
        value =
          kind === "contribute" || kind === "redeem"
            ? fmt(a)
            : kind === "activate"
              ? fmt(t.P - t.B)
              : kind === "refund"
                ? fmt(m.tree.records[Number(fields.index)].p)
                : fmt(m.k);
      await stage(
        b.tx,
        {
          contribute: "Contribute to market",
          activate: "Activate market",
          refund: "Refund contribution",
          redeem: "Redeem backing",
          close: "Close market",
        }[kind],
        [
          { label: "Market", value: m.id },
          { label: "Position", value: "#" + (Number(fields.index) + 1) },
          {
            label:
              kind === "activate"
                ? "Gross creator proceeds"
                : kind === "close"
                  ? "Gross capacity return"
                  : "Gross amount",
            value: value + " CKB",
          },
          {
            label: "Fee source",
            value:
              kind === "contribute"
                ? "Wallet pays in addition"
                : "Deducted from gross wallet receipt",
          },
          {
            label: "Net wallet change",
            value:
              fmt(
                b.tx.outputs[b.tx.outputs.length - 1].capacity -
                  w.cellOutput.capacity,
              ) + " CKB",
          },
          { label: "Backing policy", value: "80% fixed initial CKB backing" },
        ],
        l.hash(),
        async () => {
          await send(b.tx, kind);
          if (kind !== "close") await current();
          else {
            setKnown((xs) => {
              const next = { ...xs };
              delete next[m.id];
              return next;
            });
            navigate({ view: "Markets" });
            setMarket(null);
            setStatus(
              "Market closed. Permitted cushion returned, less the transaction fee.",
            );
          }
        },
      );
    });
  async function reviewOffer() {
    const d = await deployment(),
      l = await lock();
    if (fields.envelope.length > 2000000)
      throw Error("Offer exceeds the 2 MB import limit.");
    const p = JSON.parse(fields.envelope),
      r = await M.reviewAssignment(rpc, d, p.tx, p.index, BigInt(p.price));
    if (
      !fields.buyer ||
      r.buyer !==
        (await ccc.Address.fromString(fields.buyer, client)).script.hash()
    )
      throw Error("Offer buyer differs from the selected buyer address.");
    if (
      r.market.id !== identity() ||
      p.index !== Number(fields.index) ||
      BigInt(p.price) !== sh(fields.price) ||
      ![r.seller, r.buyer].includes(l.hash())
    )
      throw Error(
        "Offer differs from the selected market, claim, price or connected wallet role.",
      );
    return { d, l, p, r };
  }
  const offer = (kind: "prepare" | "sign" | "submit") =>
    run(async () => {
      if (kind === "prepare") {
        const { d, m } = await current(),
          l = await lock(),
          bl = (await ccc.Address.fromString(fields.buyer, client)).script;
        M.standard(bl);
        const seller = await M.walletCell(rpc, l, 61n * M.UNIT),
          bw = await M.walletCell(
            rpc,
            bl,
            61n * M.UNIT + sh(fields.price) + M.FEE,
          ),
          b = M.build(
            d,
            m,
            "assign",
            [seller, bw],
            Number(fields.index),
            sh(fields.price),
          );
        setFields((f) => ({
          ...f,
          envelope: M.stringify({
            index: Number(f.index),
            price: sh(f.price).toString(),
            tx: b.tx,
          }),
        }));
        setStatus(
          "Unsigned offer prepared. Save the file and collect both owners’ signatures.",
        );
        return;
      }
      const { l, p, r } = await reviewOffer();
      await stage(
        r.tx,
        kind === "sign"
          ? "Add your assignment signature"
          : "Submit paid assignment",
        [
          { label: "Market", value: r.market.id },
          { label: "Position", value: "#" + (Number(p.index) + 1) },
          { label: "Buyer address", value: fields.buyer },
          { label: "Seller receives", value: fmt(BigInt(p.price)) + " CKB" },
          {
            label: "Buyer pays",
            value: fmt(BigInt(p.price) + M.FEE) + " CKB including fee",
          },
          {
            label: "Backing transferred",
            value: fmt(r.market.tree.records[p.index].b) + " CKB",
          },
          { label: "Seller lock", value: r.seller },
          { label: "Buyer lock", value: r.buyer },
        ],
        l.hash(),
        async () => {
          const fresh = await reviewOffer();
          if (
            fresh.r.tx.hash() !== r.tx.hash() ||
            M.stringify(fresh.r.tx.witnesses) !== M.stringify(r.tx.witnesses)
          )
            throw Error(
              "Offer changed after review. Review and collect fresh consent.",
            );
          if (kind === "sign") {
            const signed = await signer!.signTransaction(r.tx);
            requireUnchanged(signed, r.tx.hash());
            setFields((f) => ({
              ...f,
              envelope: M.stringify({ ...p, tx: signed }),
            }));
            record({
              label: "Paid assignment",
              state: "Signed",
              detail:
                "Signature added locally; save and return the same file. Nothing broadcast.",
            });
            setStatus(
              "Signature added. Save the offer file and return it to the other consenting owner.",
            );
          } else {
            await send(r.tx, "Paid assignment");
            await current();
          }
        },
        kind === "sign" ? "Add signature in wallet" : "Sign & submit in wallet",
      );
    });
  const view =
    market && route.id === market.id
      ? marketView(market, ownerHash, tip)
      : route.id
        ? publicMarkets[route.id] ?? null
        : null;
  return (
    <PudgeExperience
      route={route}
      readAvailable={Boolean(manifest?.code && manifest.genesis)}
      onNavigate={(view) => navigate({ view })}
      onOpenMarket={open}
      onSelectPosition={(index) => {
        if (!view) return;
        const r = view.positions[index];
        if (!r) return;
        setReview(null);
        execute.current = null;
        setFields((f) => ({
          ...f,
          index: String(index),
          amount:
            view.phase === "Funding"
              ? r.empty
                ? view.minimum
                : r.contribution
              : r.backing,
          buyer: r.mine ? f.buyer : address,
          envelope: "",
        }));
        const next = { ...route, claim: index };
        setRoute(next);
        window.history.replaceState({}, "", routeUrl(next));
      }}
      onClearPosition={() => {
        setReview(null);
        execute.current = null;
        const next = { ...route, claim: undefined };
        setRoute(next);
        window.history.replaceState({}, "", routeUrl(next));
      }}
      markets={Object.values(publicMarkets).map((m) =>
        known[m.id] ? marketView(known[m.id], ownerHash, m.tip) : m,
      )}
      discovery={discovery}
      onDiscover={discover}
      loadingMarket={reading}
      fields={fields}
      update={update}
      address={address}
      connected={!!signer}
      busy={busy || reading}
      deployment={deploymentState}
      status={status}
      error={error}
      market={view}
      activity={activity}
      review={review}
      onConnect={() => conn.open()}
      onCheck={check}
      onRecover={refresh}
      onCreate={create}
      onAction={action}
      onOffer={offer}
      onCancel={() => {
        setReview(null);
        execute.current = null;
      }}
      onConfirm={() => {
        const f = execute.current;
        execute.current = null;
        setReview(null);
        if (f) void run(f);
      }}
    />
  );
}
