// Read-only discovery and presentation. No signing, transaction construction or broadcast.
import * as M from "./market.ts";
import type { MarketView, PageRoute } from "./types";

export type MarketSnapshot = {
  version: 1;
  id: string;
  tipNumber: string;
  tipHash: string;
  observedAt: number;
  outPoint: { txHash: string; index: string };
  market: {
    funder: string;
    creator: string;
    capacity: string;
    phase: string;
    maturity: string;
    minimum: string;
    goal: string;
    slots: number;
    records: { owner: string; contributed: string; backing: string }[];
  };
};

export function createMarketSnapshot(
  market: M.Market,
  tipNumber: string,
  tipHash: string,
  observedAt = Date.now(),
): MarketSnapshot {
  return {
    version: 1,
    id: market.id,
    tipNumber,
    tipHash,
    observedAt,
    outPoint: {
      txHash: market.cell.outPoint.txHash,
      index: String(market.cell.outPoint.index),
    },
    market: {
      funder: market.funder,
      creator: market.creator,
      capacity: market.k.toString(),
      phase: market.phase.toString(),
      maturity: market.maturity.toString(),
      minimum: market.minimum.toString(),
      goal: market.goal.toString(),
      slots: market.tree.n,
      records: market.tree.records.map((record) => ({
        owner: record.owner,
        contributed: record.p.toString(),
        backing: record.b.toString(),
      })),
    },
  };
}

export function restoreMarketSnapshot(
  snapshot: unknown,
  deployment: M.Deployment,
  id: string,
  live: any,
): M.Market | undefined {
  try {
    const saved = snapshot as MarketSnapshot;
    const point = live.out_point;
    const output = live.cell?.output;
    const outputData = live.cell?.data?.content;
    if (
      saved?.version !== 1 ||
      saved.id !== id ||
      !point ||
      !output ||
      typeof outputData !== "string" ||
      saved.outPoint.txHash !== point.tx_hash ||
      BigInt(saved.outPoint.index) !== BigInt(point.index) ||
      BigInt(point.index) !== 0n ||
      !output.type ||
      output.type.code_hash !== deployment.codeHash ||
      output.type.hash_type !== "data1" ||
      output.type.args !== id ||
      JSON.stringify(output.lock) !== JSON.stringify(output.type)
    )
      return undefined;

    const { funder, creator, capacity, phase, maturity, minimum, goal, slots, records } = saved.market;
    if (!Number.isSafeInteger(slots) || slots < 1 || slots > 1024 || records.length !== slots)
      return undefined;
    const tree = new M.Tree(slots, id as M.ccc.Hex);
    for (const [index, record] of records.entries()) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(record.owner) || !/^\d+$/.test(record.contributed) || !/^\d+$/.test(record.backing))
        return undefined;
      tree.set(index, {
        owner: record.owner as M.ccc.Hex,
        p: BigInt(record.contributed),
        b: BigInt(record.backing),
      });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(funder) || !/^0x[0-9a-fA-F]{64}$/.test(creator))
      return undefined;
    const market: M.Market = {
      id: id as M.ccc.Hex,
      script: M.ccc.Script.from({ codeHash: deployment.codeHash, hashType: "data1", args: id }),
      tree,
      funder: funder as M.ccc.Hex,
      creator: creator as M.ccc.Hex,
      k: BigInt(capacity),
      phase: BigInt(phase),
      maturity: BigInt(maturity),
      minimum: BigInt(minimum),
      goal: BigInt(goal),
      cell: M.fromRpcCell(output, outputData as M.ccc.Hex, {
        txHash: point.tx_hash as M.ccc.Hex,
        index: Number(BigInt(point.index)),
      }),
    };
    if (
      M.data(market) !== outputData ||
      M.vault(market).capacity !== BigInt(output.capacity)
    )
      return undefined;
    return market;
  } catch {
    return undefined;
  }
}

export async function revalidateMarketSnapshot(
  rpc: M.Rpc,
  deployment: M.Deployment,
  id: string,
  snapshot: unknown,
) {
  await M.verifyDeployment(rpc, deployment);
  const cached = snapshot as MarketSnapshot;
  if (
    cached?.version !== 1 ||
    cached.id !== id ||
    !/^\d+$/.test(cached.tipNumber) ||
    !/^0x[0-9a-fA-F]{64}$/.test(cached.tipHash) ||
    !/^0x[0-9a-fA-F]{64}$/.test(cached.outPoint?.txHash) ||
    !/^\d+$/.test(cached.outPoint?.index)
  )
    return undefined;
  const page = await rpc(
    "get_cells",
    [
      {
        script: { code_hash: deployment.codeHash, hash_type: "data1", args: id },
        script_type: "type",
        script_search_mode: "exact",
        with_data: true,
      },
      "asc",
      "0x2",
    ],
  );
  if (!Array.isArray(page.objects) || page.objects.length !== 1) return undefined;
  const indexed = page.objects[0];
  if (
    indexed.output?.type?.args !== id ||
    indexed.out_point?.tx_hash !== cached?.outPoint?.txHash ||
    BigInt(indexed.out_point.index) !== BigInt(cached?.outPoint?.index)
  )
    return undefined;
  const current = await rpc("get_live_cell", [indexed.out_point, true]);
  if (current.status !== "live") return undefined;
  const recovered = restoreMarketSnapshot(
    { ...cached, outPoint: { txHash: indexed.out_point.tx_hash, index: indexed.out_point.index } },
    deployment,
    id,
    { out_point: indexed.out_point, cell: current.cell },
  );
  if (!recovered) return undefined;
  const tip = await rpc("get_tip_header", []);
  return {
    recovered,
    height: BigInt(tip.number).toString(),
    tipHash: tip.hash as string,
    observedAt: Date.now(),
  };
}

export async function isMarketCellCurrent(
  rpc: M.Rpc,
  deployment: M.Deployment,
  market: M.Market,
) {
  const page = await rpc(
    "get_cells",
    [
      {
        script: {
          code_hash: deployment.codeHash,
          hash_type: "data1",
          args: market.id,
        },
        script_type: "type",
        script_search_mode: "exact",
        with_data: true,
      },
      "asc",
      "0x2",
    ],
  );
  if (!Array.isArray(page.objects) || page.objects.length !== 1) return false;
  const indexed = page.objects[0];
  if (
    indexed.out_point?.tx_hash !== market.cell.outPoint.txHash ||
    BigInt(indexed.out_point.index) !== BigInt(market.cell.outPoint.index)
  )
    return false;
  const live = await rpc("get_live_cell", [indexed.out_point, true]);
  return (
    live.status === "live" &&
    live.cell.data.content === M.data(market) &&
    BigInt(live.cell.output.capacity) === M.vault(market).capacity
  );
}
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
  if (u.pathname === "/portfolio") return { view: "My Positions" };
  if (u.pathname === "/activity") return { view: "Activity" };
  if (u.pathname === "/launch") return { view: "Create Market" };
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
      : r.view === "My Positions"
        ? "/portfolio"
        : r.view === "Create Market"
          ? "/launch"
          : "/activity";
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
