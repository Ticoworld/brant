# WO17C: outpoint-bound offline sale, experimental

This is a bounded private-chain experiment, not a security audit or production-safe protocol. It extends the WO17B fixed two-holder state machine in a separate directory. WO17A and WO17B remain unchanged and their fresh native regressions passed (`../wo17-custody/evidence/custody-1794259984136` and `../wo17b-custody/evidence/shared-1794259975960`). This creates a new market identity and fresh supply on the private chain, using the existing singleton marker and one-shot issuer mechanism. The earlier WO16 issuer and source-to-binary limitations remain open.

## Authorization and settlement

Alice signs a CCC-compatible `Nervos Message:` secp256k1 message containing protocol and operation version, genesis hash, exact market and asset hashes, custody script hash and input transaction hash/index, seller and designated buyer lock hashes, quantity, minimum shannons, seller payout lock hash and a 32-byte order ID. The complete human-readable message is saved in each run's `summary.json`. The contract derives the genesis hash from a genesis header dependency, derives the other identity fields from the executing custody script and actual input, recovers the public key from the signature and checks the full standard secp seller lock hash. The only supported seller payout is Alice's registered standard lock. The fixture signs with CCC and an isolated public fixture private key; no physical wallet or extension was exercised.

The sale spends exactly the custody cell and a Ben standard-lock funding cell. The contract verifies the state root and checked sum of the two balances, exact xUDT and custody identity, the signature and terms, then requires the same backing, Alice minus quantity, Ben plus quantity and a revision increment. It requires the designated seller payout at least the signed minimum and Ben's change lock. There is no Alice-locked input in settlement. The standard Ben lock verifies Ben's exact transaction, including the extra authorization witness. The contract limits total fee; with no seller input and unchanged custody capacity the payment and fee are funded by Ben. The order ID is signed; one-time enforcement comes from the exact consumed outpoint, not a global order-ID registry.

Alice can independently sign a cancellation transaction consuming that custody outpoint, retaining balances and advancing the revision. Cancellation and sale race to spend the same cell: whichever commits first invalidates the other. Cancellation is not guaranteed until committed, and no automatic expiry exists. The signed authorization remains potentially executable until its specified outpoint is spent; no current-time or header freshness claim is made. Fixed two-holder limits, no partial fills, no general tree, custody capacity retained after zero balance, data availability and ownership recovery, and arbitrary-adversary coverage remain unverified.

## Reproduce

Linux x86-64, CKB 0.210.0, Zig 0.14.1, GCC, Node and the locked `labs/rebuild/native` dependencies are required. Public fixture private keys are for isolated chains only. From repository root:

```
python3 labs/rebuild/mechanisms/src/bootstrap.py
bash labs/wo17c-offline/bootstrap-secp.sh
bash labs/wo17c-offline/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo17c-offline/run.cjs
WO17C_CANCEL=1 TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo17c-offline/run.cjs
node labs/wo17c-offline/verify.cjs labs/wo17c-offline/evidence/offline-<sale-timestamp>
node labs/wo17c-offline/verify.cjs labs/wo17c-offline/evidence/offline-<cancel-timestamp>
```

The bootstrap pins CKB system scripts `72eb92fca090700dcb398cd8cad8fbd8bad40355` and secp256k1 `3ffde18a060aaf4df5b81e7d88355f1e99874650`, generates their static tables locally and checks both revisions. The sale custody binary rebuilt from a fresh pinned checkout has SHA-256 `e934ac7c32459faff7e766f4b21927084d14c733d6523901bbf4773110ca0a3a` and CKB data hash `0xa0e288ada91cede824c648bc92ec8ef6f86bcce386f976c5b069b766f8930036`, matching the saved sale run. Build sizes: custody 44,336 bytes, market 15,360, marker 13,096, owner 13,312. The deployed xUDT binary is the separately pinned release; no independent xUDT source-to-binary equivalence is claimed.

## Native evidence

Sale run `evidence/offline-1794260038442`:

- Issuance `0xc007f0942284597f059c6ee22075b981e1d6abb69f60e65767710427cc61c7ea`.
- Alice purchase into custody `0xc5a1994b79a3805ec56419fd695e4a5a6b5cb064609e0b314ce9fddac2703600`.
- Alice-offline sale `0x01eca513fcabab152c3c3fba00aec9e1969845b9d1cd7b016a10355028ee5d65`; Alice receives exactly 100 CKB and Ben pays that plus the 0.01 CKB fee.
- Ben withdrawal `0xfc06a6509aa01a1ef231cb36ade1b4dab1a7c7d5c47faecc59522fab1d6fab67` and Alice withdrawal `0xbb85c419d03e26b23d4c61aad98e8205bd3dbbe61a9ebf36c7c578e8d2e719f7`.

The allocation trajectory is 2=(2,0) -> 2=(1,1) -> 1=(1,0) -> 0=(0,0). Supply reconciles as 998 inventory plus the two custody units, then 998 inventory plus one external xUDT each. Issuance, purchase, sale, Ben withdrawal and Alice withdrawal estimate 1,678,135; 1,745,465; 3,303,551; 1,728,069; and 1,750,056 VM cycles respectively; each committed transaction pays 1,000,000 shannons. Occupied minima are 210 CKB inventory, 258 marker, 306 custody, 61 for each plain payout/change and 142 for an external xUDT cell. Fixture capacities are not network fee estimates.

Separate cancellation run `evidence/offline-1794260046114` commits Alice cancellation `0x1db08729d2eeba694b931602124612e775ac1a202050f1f475b0ef24a81274ed` (1,743,971 cycles); the pre-signed sale then fails outpoint resolution. In the sale run, the previously signed cancellation and an identical sale replay both fail outpoint resolution after the sale. These are node UTXO-resolution results, not subsequent contract executions.

The private node rejects wrong market identity, wrong signer, altered buyer, insufficient payout, changed payout lock, excessive quantity, malformed signature, and alterations to signed order ID, price and quantity at the expected market or custody script and error code. Negative transaction capacity and fee are independently reconciled. A failed attempted transaction is only evidence for its actual attributed script and code; the cases are not exhaustive. Earlier successful runs `offline-1794259850153` and `offline-1794259857923` are preserved with the smaller set of negatives.

`verify.cjs` independently resolves committed inputs against the recorded genesis and prior outputs, checks hashes, identities, roots, aggregate backing, balances, recipients, signature recovery, seller payout, fees, occupied capacity and recorded errors. It trusts the local node for consensus and VM execution; it is not a consensus verifier. The claim that Alice was offline means she did not sign the settlement transaction or provide a settlement input. It does not assert a tested physical device disconnection.
