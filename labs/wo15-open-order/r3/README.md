# WO15 R3 strict full-fill candidate

Status: **B — native security gate open**. This is experimental and has not received an independent security review. The original `contracts/sell_order.c` and `build/sell_order` at commit `24abd51` remain the fallback; they are not qualified as secure.

The R3 variant binds an order input at absolute index `i` to maker payout output `2*i` and buyer delivery output `2*i+1`. A fill rejects every additional input or output with the same type hash. This intentionally forbids same-asset aggregation and change; the buyer must not bring that asset into the fill. It prevents the absolute-output check from crediting the buyer's pre-existing inventory and prevents two R3 inputs from claiming the same designated output positions. These checks depend on authentic xUDT type-script conservation and a correctly authenticated maker funding lineage; the order lock itself cannot authenticate a listing or enforce issuer policy.

Maker cancellation is recognized using a distinct input with the maker lock hash before the order's fill-specific price, type and data checks. Malformed script length is still rejected before this check, and malformed recovery has not been independently demonstrated. No consensus-enforced expiry is claimed.

## Build and evidence

Use the build command in the parent README, substituting `r3/contracts/sell_order.c` and `r3/build/sell_order`. Built CKB data hash: `0x9d9284ebe8e7564617f323e1fff750a7a8a663f4f16f3482e8d63c686de3f848`. Run on Linux/WSL with `node labs/wo15-open-order/run-r3-corrected.cjs`; the harness starts an isolated node with public disposable keys.

**VERIFIED** in `evidence/r3-corrected-1793884470948`: native xUDT funding, maker cancellation, and offline-maker fill committed. A buyer-inventory diversion with a second same-asset input was rejected by the R3 lock with code 28; two separately grouped same-asset order inputs attempting payout reuse also hit code 28. The latter does not independently exercise positional payout isolation. Underpayment, redirected payment, redirected delivery, wrong asset and amount, malformed witness, wrong buyer, duplicate delivery, overflow and post-signature mutation produced their asserted rejection codes; a stale repeated fill failed input resolution. The duplicate output case also violates xUDT conservation; its observed R3 code 29 establishes the lock check, not independent xUDT behavior. Cancellation of the maximum-price fixture committed.

**UNVERIFIED**: mixed *working* code identities and different-asset order payout reuse; maker recovery of malformed inventory; independent verification of transaction lineage; authorization of discovered listings; cancellation/fill races; wallet behavior. The attempted `data` versus `data1` fixture in `evidence/r3-corrected-1793884380571` failed in the former VM with `MemWriteOnExecutablePage`, rather than the target invariant. Do not count it as a security pass. A complete regression campaign and real-wallet acceptance remain open; do not integrate this candidate into an execution service yet.

The older `run-r3-defensive.cjs` and `r3-defensive-*` evidence exercise the unchanged fallback, not the corrected binary. Estimates are VM estimates; committed outcomes are recorded separately in events and RPC traces. No public transaction was sent.
