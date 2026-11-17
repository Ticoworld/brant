import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as M from "../../../../lib/pudge/market.ts";
import {
  createMarketSnapshot,
  isMarketCellCurrent,
  marketIdentity,
  marketView,
  revalidateMarketSnapshot,
  type MarketSnapshot,
} from "../../../../lib/pudge/market-reader.ts";
import type { MarketView } from "../../../../lib/pudge/types";
import deployment from "../../../../public/pudge.json";
import registry from "../../../../public/pudge-markets.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Snapshot = {
  recovered: M.Market;
  height: string;
  tipHash: string;
  observedAt: number;
  serialized: MarketSnapshot;
};

type ResolvedSnapshot = {
  snapshot: Snapshot;
  freshness: "cached" | "verified";
};

type SharedCache = typeof globalThis & {
  __rovekoPudgeSnapshots?: Map<string, Snapshot>;
  __rovekoPudgeReads?: Map<string, Promise<ResolvedSnapshot>>;
};

const shared = globalThis as SharedCache;
const snapshots = (shared.__rovekoPudgeSnapshots ??= new Map());
const reads = (shared.__rovekoPudgeReads ??= new Map());
const rpc = M.httpRpc("https://testnet.ckb.dev/");
const cacheRoot = join(
  tmpdir(),
  "roveko-pudge-market-state",
  createHash("sha256").update(process.cwd()).digest("hex").slice(0, 20),
);

function cacheFile(id: string) {
  return join(cacheRoot, `${id.slice(2)}.json`);
}

async function readPersisted(id: string): Promise<MarketSnapshot | undefined> {
  try {
    return JSON.parse(await readFile(cacheFile(id), "utf8")) as MarketSnapshot;
  } catch {
    return undefined;
  }
}

async function persist(id: string, snapshot: MarketSnapshot) {
  await mkdir(cacheRoot, { recursive: true });
  const target = cacheFile(id);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot), { flag: "wx" });
  await rename(temporary, target);
}

function resultResponse(
  snapshot: Snapshot,
  owner: string,
  freshness: ResolvedSnapshot["freshness"],
) {
  const market: MarketView = {
    ...marketView(snapshot.recovered, owner, snapshot.height),
    freshness,
    observedAt: snapshot.observedAt,
  };
  return Response.json(
    {
      market,
      height: snapshot.height,
      observedAt: snapshot.observedAt,
      freshness,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function makeSnapshot(recovered: M.Market): Promise<Snapshot> {
  if (!(await isMarketCellCurrent(rpc, deployment as unknown as M.Deployment, recovered)))
    throw Error("Market changed during recovery; refresh and retry.");
  const tip = await rpc("get_tip_header", []);
  const height = BigInt(tip.number).toString();
  const tipHash = String(tip.hash);
  const observedAt = Date.now();
  return {
    recovered,
    height,
    tipHash,
    observedAt,
    serialized: createMarketSnapshot(recovered, height, tipHash, observedAt),
  };
}

async function resolveSnapshot(id: string): Promise<ResolvedSnapshot> {
  const cached = snapshots.get(id) as Snapshot | undefined;
  if (cached) {
    const tip = await rpc("get_tip_header", []);
    if (
      cached.height === BigInt(tip.number).toString() &&
      cached.tipHash === tip.hash
    ) {
      const refreshed = { ...cached, observedAt: Date.now() };
      refreshed.serialized = createMarketSnapshot(
        refreshed.recovered,
        refreshed.height,
        refreshed.tipHash,
        refreshed.observedAt,
      );
      return { snapshot: refreshed, freshness: "verified" };
    }
    const revalidated = await revalidateMarketSnapshot(
      rpc,
      deployment as unknown as M.Deployment,
      id,
      cached.serialized,
    );
    if (revalidated) {
      const snapshot: Snapshot = {
        ...revalidated,
        serialized: createMarketSnapshot(
          revalidated.recovered,
          revalidated.height,
          revalidated.tipHash,
          revalidated.observedAt,
        ),
      };
      return { snapshot, freshness: "verified" };
    }
  } else {
    const persisted = await readPersisted(id);
    if (persisted) {
      const revalidated = await revalidateMarketSnapshot(
        rpc,
        deployment as unknown as M.Deployment,
        id,
        persisted,
      );
      if (revalidated) {
        const snapshot: Snapshot = {
          ...revalidated,
          serialized: createMarketSnapshot(
            revalidated.recovered,
            revalidated.height,
            revalidated.tipHash,
            revalidated.observedAt,
          ),
        };
        return { snapshot, freshness: "verified" };
      }
    }
  }

  const recovered = await M.recover(
    rpc,
    deployment as unknown as M.Deployment,
    id as M.ccc.Hex,
  );
  return { snapshot: await makeSnapshot(recovered), freshness: "verified" };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = marketIdentity(url.searchParams.get("id") ?? "");
    const owner = url.searchParams.get("owner") ?? "";
    if (owner && !/^0x[0-9a-fA-F]{64}$/.test(owner))
      return Response.json({ error: "Owner lock hash is invalid." }, { status: 400 });
    const entry = registry.markets.find((item) => item.id === id);
    if (
      registry.network !== "pudge" ||
      !entry ||
      entry.deployment.codeHash !== deployment.codeHash ||
      entry.deployment.marketScript.args !== id
    )
      return Response.json({ error: "Market is not in the verified Pudge registry." }, { status: 404 });

    const current = snapshots.get(id) as Snapshot | undefined;
    if (current && Date.now() - current.observedAt < 15_000)
      return resultResponse(current, owner, "cached");

    let pending = reads.get(id) as Promise<ResolvedSnapshot> | undefined;
    if (!pending) {
      pending = resolveSnapshot(id);
      reads.set(id, pending);
    }
    try {
      const resolved = await pending;
      snapshots.set(id, resolved.snapshot);
      try {
        await persist(id, resolved.snapshot.serialized);
      } catch (error) {
        console.warn("Could not persist verified Pudge market snapshot:", error);
      }
      return resultResponse(
        resolved.snapshot,
        owner,
        resolved.freshness,
      );
    } finally {
      if (reads.get(id) === pending) reads.delete(id);
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Public market recovery failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
