// Read-only discovery and presentation. No signing, transaction construction or broadcast.
import * as M from "./market.ts";
import type { MarketView } from "../app/experience";
export type PageRoute = {
  view: "Markets" | "Market" | "My Positions" | "Create Market" | "Activity";
  id?: string;
  claim?: number;
};
export function marketIdentity(value: string) {
  let id = value.trim();
  if (id.includes("://") || id.startsWith("/")) {
    const u = new URL(id, "http://localhost");
    id =
      u.pathname.match(/^\/market\/(0x[0-9a-fA-F]{64})\/?$/)?.[1] ??
      u.searchParams.get("market") ??
      "";
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(id))
    throw Error("Use a market link or its 32-byte identity.");
  return id.toLowerCase() as M.ccc.Hex;
}
export function routeFromUrl(value: string): PageRoute {
  const u = new URL(value, "http://localhost");
  const id =
    u.pathname.match(/^\/market\/([^/]+)\/?$/)?.[1] ??
    u.searchParams.get("market");
  if (id) {
    const identity = marketIdentity(id),
      claim = u.searchParams.get("claim");
    return {
      view: "Market",
      id: identity,
      ...(claim !== null && /^\d+$/.test(claim) && Number(claim) < 1024
        ? { claim: Number(claim) }
        : {}),
    };
  }
  const view = u.searchParams.get("view");
  return {
    view:
      view === "positions"
        ? "My Positions"
        : view === "create"
          ? "Create Market"
          : view === "activity"
            ? "Activity"
            : "Markets",
  };
}
export function routeUrl(r: PageRoute) {
  return r.view === "Market"
    ? "/market/" +
        marketIdentity(r.id ?? "") +
        (r.claim !== undefined ? "?claim=" + r.claim : "")
    : r.view === "Markets"
      ? "/"
      : "/?view=" +
        (
          {
            "My Positions": "positions",
            "Create Market": "create",
            Activity: "activity",
          } as const
        )[r.view];
}
const fmt = (n: bigint) => M.formatCkb(n).replace(/\.?0+$/, "");
export function marketView(
  m: M.Market,
  owner: string,
  tip: string | null,
): MarketView {
  const t = M.totals(m);
  const initial = m.tree.records.reduce((n, r) => n + (r.p * 4n) / 5n, 0n);
  return {
    id: m.id,
    phase: m.phase ? "Active" : "Funding",
    backing: fmt(t.B),
    contributed: fmt(t.P),
    goal: fmt(m.goal),
    initialBacking: fmt(initial),
    creatorAllocation: fmt(t.P - initial),
    capacity: fmt(m.k),
    minimum: fmt(m.minimum),
    maturity: m.maturity.toString(),
    tip,
    creatorIsMe: !!owner && m.creator === owner,
    funderIsMe: !!owner && m.funder === owner,
    allFunded: !m.phase && t.count === BigInt(m.tree.n) && t.P >= m.goal,
    settled: (m.phase ? t.B : t.P) === 0n,
    root: m.tree.root,
    positions: m.tree.records.map((r, index) => ({
      index,
      owner: r.owner,
      contribution: fmt(r.p),
      backing: fmt(r.b),
      mine: !!owner && r.owner === owner,
      empty: r.p === 0n,
      remaining: r.b > 0n,
    })),
  };
}
export async function discoverMarkets(
  rpc: M.Rpc,
  d: M.Deployment,
  cursor?: string,
) {
  await M.verifyDeployment(rpc, d);
  const args: any[] = [
    {
      script: { code_hash: d.codeHash, hash_type: "data1", args: "0x" },
      script_type: "type",
      script_search_mode: "prefix",
      with_data: true,
    },
    "desc",
    "0x14",
  ];
  if (cursor) args.push(cursor);
  const page = await rpc("get_cells", args);
  if (!Array.isArray(page.objects))
    throw Error("Indexer did not return a market page.");
  const markets: M.Market[] = [],
    failures: { id: string; error: string }[] = [],
    seen = new Set<string>();
  for (const cell of page.objects) {
    const s = cell.output?.type;
    if (
      !s ||
      s.code_hash !== d.codeHash ||
      s.hash_type !== "data1" ||
      !/^0x[0-9a-fA-F]{64}$/.test(s.args)
    ) {
      failures.push({
        id: s?.args ?? "unknown",
        error: "Cell identity does not match this market contract.",
      });
      continue;
    }
    const id = marketIdentity(s.args);
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const m = await M.recover(rpc, d, id);
      if (
        m.cell.outPoint.txHash !== cell.out_point?.tx_hash ||
        Number(m.cell.outPoint.index) !== Number(BigInt(cell.out_point.index))
      )
        throw Error("Market changed during discovery; refresh required.");
      markets.push(m);
    } catch (e) {
      failures.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return {
    markets,
    failures,
    scanned: page.objects.length,
    next:
      page.objects.length === 20 &&
      typeof page.last_cursor === "string" &&
      page.last_cursor !== cursor
        ? page.last_cursor
        : undefined,
  };
}
