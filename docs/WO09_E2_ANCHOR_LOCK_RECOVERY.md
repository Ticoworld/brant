# WO09-E2: anchor lock authorization and exit recovery

## Source conclusion

The pinned upstream is `LusoCryptoLabs/Liquid-Cells@47492b51673c94635ab23de2c55477625e94ccbf`. In `crates/ckb-contract/src/escape.rs::force_exit`, a force exit requires an input proof for `{balance, nonce}`, an output proof for the nullified `{0, nonce}` leaf, unchanged sequence, fee accumulator, and `last_epoch`, total reduced by exactly the balance, anchor capacity reduced by exactly the same amount, an absolute-epoch `since >= last_epoch + 180`, and a payout with the exact balance to the pubkey-derived secp lock. The force-exit successor preserves `last_epoch`; it does not start another 180-epoch delay. `cells.rs::bind` advances `last_epoch` only when a new checkpoint is committed. The genesis path accepts an empty anchor with the creator-selected lock; every subsequent checkpoint/exit enforces anchor-lock continuity.

The upstream `redteam_drain.rs` explains why full drain does not strand the anchor: `anchor_capacity - pool_total` is initialized as genesis slack and preserved as capacity and total fall together. The local chain experiments below verify this invariant for one claimant, but they do **not** drain the whole pool: the published genesis fixture contains another 1,000-shannon leaf whose public key is not identified in this reproduction.

## Native lock-mode comparison

Both runs used CKB 0.210.0, the same pinned anchor contract binary (SHA-256 `04a31bf62a4aff38a2e51c0aace5f2b253828424127336f64e55d29c015ce817`), the published genesis proof, and a 1,800-block wait to the real epoch boundary. The local single-hart compatibility build remains experimental and is not an upstream correction.

### Operator-controlled anchor: timeout does not bypass the lock

Evidence: `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793623953122/`.

A separately controlled operator key (role 2) signed the checkpoint spending the operator-locked anchor. At the mature epoch, an independently controlled user (role 1) built and fee-funded the same proof-backed exit without the operator signature. CKB rejected it at `Inputs[0].Lock` with secp error `-2`, before the anchor type script's exit conditions could authorize it. Adding the operator signature let the mature exit commit. That distinguishes a satisfied timer from permission to spend the anchor. A timeout in a type script cannot override a restrictive lock script.

Committed transactions:

- Anchor contract deployment: `0x2e71aec7cdabf823a3fb49b3301da999b5af4b1474a90ba0af2ee05b8f9707ac`
- Empty anchor and deposit: `0x145e8cd0da6a9fa3579dbce510cf27dccfcb366bbc8b6a314b11d5d93e1c85ca`
- Valid checkpoint: `0x2da356bc67773a0edfd748f29638ea0ad79c45d26fb4a367a58899898029808b`
- Operator-authorized mature exit: `0x7e4f517ae0b7d31d8b3593aa0bc0b1db7915be7f0a50d298741828e36d7ece93`

The un-authorized mature exit is a recorded rejected estimate, not an on-chain transaction. It fails with `-2`; it is not a timeout rejection.

### Permissionless anchor: proof and fee authorization suffice

Evidence: `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793623892164/`.

The anchor lock was a separately deployed CKB-VM `always_success` script. The pinned type script still enforced checkpoint proof, DA commitment, root/sequence/total transitions, timeout, nullification, capacity conservation, and owner-derived payout. User role 0 authorized the deposit. After 180 epochs, user role 1 independently funded and signed the exit transaction. The anchor input had an empty lock-signature field, the operator key was not an input, and the committed payout was locked to the account owner. Tampered DA, early exit, and incorrect mature payout were rejected by the type script (codes 59, 66, 67).

Committed transactions:

- Anchor contract deployment: `0x11bdce2c9dc489305e91949b39f3b5d86251e3bed152c3c33d499ead3c7ebc09`
- Permissionless lock deployment: `0xa7592f22ac36b0a8ba1e742e826d134d822e27c37d113ae8fc31dc4b781edb6e`
- Empty anchor and deposit: `0xd520f78993df7d25a247ea6b8f26f4fd5a02a0f41af64911e47ad7f020558ed7`
- Valid checkpoint: `0x57e24afbd43ff143cce84ee80bf311565e17037e2278ab4d815684be2ad432a5`
- User-submitted mature exit: `0x502429366066d3f69500d3aadbcd9be15ea9bbb455a4f205374dcaf1c90e604c`

The fresh child process fetched the committed checkpoint transaction from live local CKB RPC, reconstructed the owner proof from its published DA, and matched the reconstructed root to the live anchor. The exit reduced the owner's 9,999,899,000-shannon balance to zero and left the other 1,000-shannon DA record intact. The successor anchor retained 50,000,000,000 shannons of capacity slack and preserved `last_epoch = 0`. This is a successful owner exit and timer-preservation result, **not a full-pool drain**.

## What this establishes and what it does not

The default owner-locked lifecycle cannot be cited as operator-independent recovery. A restrictive operator lock prevents user recovery even after maturity. A permissionless lock plus the upstream type script permits a third party to submit a proof-backed exit without the operator or owner's transaction signature; the payout remains locked to the proof owner's key. The user still needs a fee input and the owner must retain the key needed to spend the payout Cell.

Permissionless anchoring changes the trust and liveness assumptions: anyone may attempt a checkpoint, but only an anchor-type-script-valid proof/DA transition can advance state. This experiment does not test malicious valid checkpoints that repeatedly advance `last_epoch`, proof-generation availability, censorship, a no-op checkpoint storm, or a multi-checkpoint outage. The 180-epoch rule only opens after the last accepted checkpoint. Timer preservation through force exits does not prove the timer opens in the presence of an active checkpoint submitter.

The pinned genesis proof contains two account records: the owner record and a separate 1,000-shannon record. Its hashed key is preserved in `rpc-reconstruction/rpc-proof-reconstruction.json`; its public-key preimage and owner were not recovered. Neither experiment proves arbitrary multi-owner exits, same-anchor concurrent submissions, stale-proof rebuilding after several checkpoints, complete history replay, archival-node recovery, operator/database-loss recovery, or sub-61-CKB payout. The separate small-payout alternatives remain open.

## Reproduction and evidence checks

Build the isolated pinned-source binary as described in `WO09_E2_PRIVATE_DEVNET_LIFECYCLE.md`, then run either mode:

```sh
LIQUID_CELLS_PERMISSIONLESS_ANCHOR=1 \
LIQUID_CELLS_SOURCE=/path/to/clean/liquid-cells \
LIQUID_CELLS_ANCHOR_BIN="$PWD/labs/wo09-e2-capacity/build/liquid-cells-anchor-single-hart" \
node labs/wo09-e2-capacity/src/run-liquid-cells-private-devnet.cjs

LIQUID_CELLS_OPERATOR_ANCHOR=1 \
LIQUID_CELLS_SOURCE=/path/to/clean/liquid-cells \
LIQUID_CELLS_ANCHOR_BIN="$PWD/labs/wo09-e2-capacity/build/liquid-cells-anchor-single-hart" \
node labs/wo09-e2-capacity/src/run-liquid-cells-private-devnet.cjs
```

The runner needs the repository's isolated Cargo/Rust environment variables shown in the lifecycle document. Validate the saved transactions and constraints with:

```sh
node labs/wo09-e2-capacity/src/verify-liquid-cells-private-devnet.cjs <evidence-directory>
```
