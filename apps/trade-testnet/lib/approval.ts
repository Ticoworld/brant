// Review-time guards only. Consensus and covenant verification remain authoritative.
import { ccc } from "@ckb-ccc/core";
import { FEE, type Rpc } from "./market.ts";
export function requirePublicApproval(d: {
  network: string;
  code: unknown;
  publicSigningEnabled?: boolean;
}) {
  if (d.network !== "pudge")
    throw Error("This interface accepts CKB Pudge testnet deployments only.");
  if (!d.code || d.publicSigningEnabled !== true)
    throw Error(
      "Deployment is not approved. Wallet connection is available; transaction signing stays disabled.",
    );
}
export function requireUnchanged(tx: ccc.Transaction, hash: ccc.Hex) {
  if (tx.hash() !== hash)
    throw Error(
      "Wallet changed transaction terms. Rebuild and give fresh consent.",
    );
}
export async function reviewLiveInputs(rpc: Rpc, tx: ccc.Transaction) {
  let inputCapacity = 0n;
  for (const input of tx.inputs) {
    const pt = input.previousOutput;
    const c = await rpc("get_live_cell", [
      { tx_hash: pt.txHash, index: ccc.numToHex(pt.index) },
      true,
    ]);
    if (c.status !== "live")
      throw Error(
        "A transaction input was spent. Refresh the market, rebuild and give fresh consent.",
      );
    inputCapacity += BigInt(c.cell.output.capacity);
  }
  const fee = inputCapacity - tx.outputs.reduce((s, o) => s + o.capacity, 0n);
  if (fee !== FEE)
    throw Error("Unexpected fee. This pilot requires the exact qualified fee.");
  return fee;
}
