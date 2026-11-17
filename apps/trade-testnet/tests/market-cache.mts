import assert from "node:assert/strict";
import * as M from "../lib/pudge/market.ts";
import {
  createMarketSnapshot,
  restoreMarketSnapshot,
} from "../lib/pudge/market-reader.ts";

const id = ("0x" + "ab".repeat(32)) as M.ccc.Hex;
const codeHash = ("0x" + "cd".repeat(32)) as M.ccc.Hex;
const txHash = ("0x" + "ef".repeat(32)) as M.ccc.Hex;
const ownerA = ("0x" + "12".repeat(32)) as M.ccc.Hex;
const ownerB = ("0x" + "34".repeat(32)) as M.ccc.Hex;
const script = M.ccc.Script.from({ codeHash, hashType: "data1", args: id });
const tree = new M.Tree(2, id);
tree.set(0, { owner: ownerA, p: 12_500_000n, b: 10_000_000n });
tree.set(1, { owner: ownerB, p: 12_500_000n, b: 10_000_000n });
const state: M.Market = {
  id,
  script,
  tree,
  funder: ownerA,
  creator: ownerA,
  k: 322n * M.UNIT,
  phase: 0n,
  maturity: 0n,
  minimum: 12_500_000n,
  goal: 25_000_000n,
  cell: M.ccc.Cell.from({
    cellOutput: { capacity: 347n * M.UNIT, lock: script, type: script },
    outputData: "0x",
    outPoint: { txHash, index: 0n },
  }),
};
const market: M.Market = {
  ...state,
  cell: M.ccc.Cell.from({
    cellOutput: { capacity: 347n * M.UNIT, lock: script, type: script },
    outputData: M.data(state),
    outPoint: { txHash, index: 0n },
  }),
};
const outputData = M.data(market);
const rpcScript = {
  code_hash: script.codeHash,
  hash_type: script.hashType,
  args: script.args,
};
const live = {
  out_point: { tx_hash: txHash, index: "0x0" },
  cell: {
    output: {
      capacity: M.ccc.numToHex(M.vault(market).capacity),
      lock: rpcScript,
      type: rpcScript,
    },
    data: { content: outputData },
  },
};
const deployment: M.Deployment = {
  network: "pudge",
  genesis: null,
  codeHash,
  code: null,
  secp: null,
};
const snapshot = createMarketSnapshot(market, "1234", ("0x" + "56".repeat(32)) as M.ccc.Hex, 1000);

const restored = restoreMarketSnapshot(snapshot, deployment, id, live);
assert.ok(restored);
assert.equal(restored.tree.root, market.tree.root);
assert.equal(M.data(restored), outputData);
assert.equal(restored.tree.records[1].p, 12_500_000n);

const altered = structuredClone(snapshot);
altered.market.records[0].contributed = "1";
assert.equal(restoreMarketSnapshot(altered, deployment, id, live), undefined);

const movedCell = structuredClone(live);
movedCell.out_point.tx_hash = ("0x" + "78".repeat(32)) as M.ccc.Hex;
assert.equal(restoreMarketSnapshot(snapshot, deployment, id, movedCell), undefined);

console.log("MARKET_CACHE_SNAPSHOT_PASS");
