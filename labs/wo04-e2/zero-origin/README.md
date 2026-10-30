# WO04-E2D-P0: zero user Ethereum transactions

**Executed:** a user-signed native CKB order paid 100 controlled-USDC units to an
unused Ethereum address through a real maker `fill`, followed by a native maker
reimbursement. Another native order refunded from authenticated storage
non-inclusion after finalized execution time strictly exceeded its deadline.
There is no Ethereum `open`, `expire` or user transaction. User nonce stayed 0.

This is a real private-PoS/isolated-CKB mechanism test using a minimal six-decimal
controlled USDC-shaped token fixture, not Circle-issued USDC or public assets.
The fixture includes adversarial transfer behavior; it is not a production token.

## Reproduce the captured genuine-consensus execution

Use the cloud's existing pinned E1/E2 toolchain and Python environment. Install
the isolated parser reference dependencies once, if absent:

```sh
labs/wo04-e2/.venv/bin/python -m pip install --target labs/wo04-e2/zero-origin/tools/python -r labs/wo04-e2/zero-origin/requirements-mpt.lock
E2D_RUN_NAME=my-new-label bash labs/wo04-e2/zero-origin/src/reproduce.sh
```

After dependency setup, the second command requires no Ethereum client, Docker
or Internet. It hashes all fixtures/references, builds unchanged E2B verification
code with explicit private-chain configuration, builds the new native settlement
script, checks 3,602 native parser calls against py-trie, checks captured real
BLS/SSZ predicates, and executes a fresh native chain. All 8 live transaction
hashes/cycles must match. Additional funded native controls test missing accounts,
wrong code hashes, alternate chains, strict deadline equality and forged roots.
It refuses existing run labels. Final full `E2D_RUN_NAME=release-check` run:18 committed native transactions
and 50 expected native rejections.

## New live capture

The live evidence continued E2C's already pinned private Geth/Lighthouse network;
no E2C tracked source, report or fixture was changed. To create another live
experiment, use a new **sibling lab output directory** under `labs/wo04-e2/`,
copying `contracts`, `src`, `devnet` and dependency lock only; create empty
`fixtures/devnet`, `evidence` and `build` directories. Do not overwrite archived
fixtures. Relative access to the existing E1/E2 pinned dependencies then remains
valid. On a fresh Docker environment `devnet/start.sh` supplies the digest-pinned
isolated PoS chain and disposable validators; existing names/runtime cause failure
rather than replacement. Private genesis/JWT/keystore-generation logs remain in
ignored `devnet/runtime`. Public fixture mnemonic/CKB keys must NEVER be funded on
public chains. Endpoints require the inspected directly attached 172.18.* internal
bridge; external network policy is not bypassed.

From that fresh lab directory, run `python src/native.py`, wait for actual PoS
non-genesis finality, then `../.venv/bin/python devnet/prepare.py bootstrap`,
`python devnet/build.py`, `node src/compile.cjs` and
`E2D_RUN_NAME=new-live node src/run.cjs`. The bounded driver uses period-zero
mainnet-preset committees and 0–2 missing positions; it does not implement staged
verification for larger missing counts. Preserve the resulting raw client data
and stop only the task-owned `e2c-*` containers. Standard runtime readiness,
proxy and CA requirements from the cloud runtime skill apply to image downloads.

## Predicate and layouts

`OutcomesV2` has no owner, proxy, upgrade, cancel, open, expire or slot-clearing
function. Immutable source/genesis/registry configuration binds each order.
`filled[id]` is mapping slot 0; the global reentrancy guard is slot 1. Before the
strict deadline, the maker transfers exactly the amount from its own approved
balance; only success leaves `filled[id]=id` permanently. Transfers returning
false, reverting, crediting too little or returning malformed bytes roll back
both marker and transfer. A no-return token succeeds if its exact balance delta
matches. Cross-order reentrancy and replay are rejected.

The order is480 static ABI bytes:
`domain, Ethereum chainId, Outcomes address, ethGenesis, registry, ckbGenesis,
fundingTypeHash, ckbMakerLockHash, ckbRefundLockHash, asset, amount, recipient,
maker, deadline(uint64), ckbPrincipal(uint64)`.
`id=SHA256(orderBytes)`. Native script args append expected deployed codeHash 32,
minimum root version LE8, minimum execution block LE8 and fee LE8:536 bytes.
Standard secp256k1 user funding creates the original unique E1 reservation type.
The native consumer verifies that exact input type, full committed order and
fixed principal/recipient. Deadline equality does not refund.

Witness: mode 1-byte (`1` filled /`0` absence-refund), finalized beacon header 112,
Capella execution-header SSZ chunks 480, execution/body branch 128, then canonical
account/storage proof wire. The additional 720 bytes prove the exact execution
timestamp. The beacon hash must match the immutable publisher's finality identity;
the body branch authenticates execution fields; state root/block number/block
hash must also equal the 104-byte publisher data. A later real header cannot
retime a stale root even when both state-root values are equal. E2's published
104-byte format and original E2C fallback remain unchanged.

`proof.h` distinguishes successful presence, authenticated absence and errors.
Missing contract accounts or wrong code hashes never refund. Empty storage tries,
empty branch children and authenticated divergent paths can prove absence;
truncation, invalid hashes/encodings and unused proof nodes cannot. Inline nodes
may be supplied or omitted; optional supplied nodes must exactly equal the
already authenticated inline reference. JSON slot/value labels are not trusted.

See [the result report](../../../docs/E2_ZERO_ORIGIN_RESULT.md),
[design lessons](DESIGN_LESSONS.md), `evidence/chain-live-02.json` and
`evidence/chain-offline-final.json`. The unresolved EVM-side CKB funding/delivery
guarantee and absence of reverse trading are explicit in the design lessons.
