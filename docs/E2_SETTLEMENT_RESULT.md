# WO04-E2C executed result — 30 October 2026

**VERIFIED: a controlled token fill and an unfilled expiry on a real private
Ethereum PoS chain authorized actual native CKB principal payouts through
E2-authenticated execution state and E1 account/storage proofs.** This is a
bounded Capella mechanism demonstration, not production readiness or a public
mainnet trade. No public transactions or real assets were used.

## Evidence and reproduction

Implementation: `labs/wo04-e2/settlement/`. Successful live evidence:
`evidence/chain-pos-settlement-verified.json`, `summary-pos-settlement-verified.json`,
`costs.json`. Independent fresh native replay: `chain-offline-final.json` and
`summary-offline-final.json`. Earlier failed attempts are preserved separately.
All 570 lab files tracked at E2B commit `8eae0f1` are byte-identical.

With the existing pinned cloud dependencies installed:

```sh
E2C_RUN_NAME=my-new-label bash labs/wo04-e2/settlement/src/reproduce.sh
```

This checks fixture hashes, rebuilds the point serializer, explicitly configured
CKB program, adapter and original reservation contract, compiles the unchanged
E1 Solidity source with solc 0.8.30, verifies captured real BLS/SSZ reference
updates and negative vectors, then submits the actual transactions to a fresh
CKB 0.210.0 node. No Ethereum RPC, Docker daemon or Internet is needed for this
captured-fixture reproduction. Existing evidence labels are refused.
The final full command executed was `E2C_RUN_NAME=offline-final bash .../reproduce.sh`
and exited zero. Its log is `evidence/reproduction-offline-final.log`.

The live devnet used digest-pinned Geth 1.13.15, Lighthouse 4.6.0 and
ethereum-genesis-generator 2.0.12; exact digests are in `evidence/infrastructure.json`.
It ran on a Docker internal bridge with no external peers/discovery. The
validator client operated 64 real disposable validators; Ethereum's mainnet
preset selected a 512-position sync committee, with repeated validator keys as
permitted by the actual committee-selection algorithm. Both updates had 512
actual participation bits. No signatures were synthesized by the proof driver.
All validators were controlled by this lab: this tests the real consensus and
cryptographic mechanism, not decentralized economic security.

Private configuration: genesis validators root
`e38f0731f47307d936c408de9d38a0706247d1652b2f712a5b2a4e85fc54dff1`,
mainnet SSZ preset, 32 slots/epoch, 256 epochs/committee period, 3 seconds/slot,
Capella active from epoch zero with fork version `03000000`, Deneb disabled until
epoch 1,000,000,000. The separate generated verifier changes only explicit
chain/genesis/bootstrap/time/fork-activation constants; it preserves the E2B
BLS/finality/rotation predicates. The original mainnet program is unchanged.

Lighthouse's old light-client REST implementation returned `UnsupportedFork`
for Capella. `devnet/extract.py` instead constructs branches from actual beacon
states/blocks. Its complete state and body SSZ roots must match client headers;
actual child-block sync signatures sign the exact parent beacon header.
38 captured state roots and 60 block bodies were independently checked offline.
The extractor fails closed for nonempty slashings/deposits/exits/BLS-change lists
outside this controlled experiment; it is not a general beacon API replacement.

## Exact trust and proof chain

1. One explicit locally finalized bootstrap checkpoint
   `2ffa4a88dd006ea29c47443ba3aee5bbdfeaee28d39db00c205137348e426810`
   initializes the unique CKB Type-ID lineage. This is bootstrap trust, not a
   root selected separately for each payout. The saved genesis/config and real
   executing consensus/execution clients justify this private-chain anchor.
2. The immutable committee certificate authenticates its 512 members and
   subgroup-validated aggregate against that state's committee commitment.
3. Genuine signature slots 377 and 418 advance native state to versions 1 and 2,
   finalized beacon slots 288 and 352, execution blocks 218 and 280. CKB checks
   the sync signature/domain, participation, finality branch, attested/finalized
   execution-header bindings, next-committee branch, time, continuity and replay
   constraints. Both updates remain in period zero; E2B's seven-update mainnet
   rotation evidence remains the separate rotation demonstration.
4. Each actual state advance atomically creates an immutable root of the exact
   publisher program/lineage. The private program code hash is
   `22866cd1b1a74051675d0bc3cd2412f520bba1355f320019ae923d3b8d3d6bf5`;
   the mainnet adapter separately pins the preserved mainnet program.
5. The settlement adapter authenticates that exact publisher code/hash type,
   root role, full registry lineage, source genesis/domain and funded
   version/block bounds. A bare 104-byte cell or committee certificate cannot
   authorize a principal transfer.
6. Geth `eth_getProof` at exact block 218 proves the deployed Outcomes account,
   exact immutable runtime code hash and `leaves[id]` slot against execution root
   `789f3090604b54d47c433bd316e2734f176daf358572c8a92969876efae44d2c`.
   Both root and block hash match the CKB publisher output. The EVM contract is
   the unchanged E1 controlled token/Outcomes implementation, not an unrelated
   historical mainnet contract.
7. Terms independently match the full E1 ABI commitment, including chain ID,
   contract/token, participants, amount/deadline, CKB genesis, principal,
   recipient locks and unique reservation identity. The irreversible filled or
   expired terminal leaf releases exactly the original funded principal to its
   committed recipient. Missing proofs never authorize a refund.

This is standard sync-committee light-client authentication under its trusted
bootstrap and committee honesty assumptions. CKB does not independently
reexecute Ethereum or verify every FFG attestation. No stronger guarantee against
an adversarial supermajority is claimed.

## Actual settlement and historical-root recovery

The maker transferred 100,000,000 controlled token base units through `fill`.
The second, unfilled trade reached its real deadline and executed `expire`.
Seven EVM receipts are preserved. Their funded CKB reservations were never
replaced during driver interruptions. Recovery reloaded the actual persisted
state, certificate, funded cells and original EVM receipts. No new bootstrap,
replacement committee or replacement trade was used.

Both settlements consumed the version-1 root **after version 2 had committed**.
The headers, beacon finality, execution blocks and root-cell identities advanced;
these two otherwise idle execution blocks happen to have the same state-root
value. This is not claimed as a test of changing application storage between
root publications. Separately, the historical-mainnet test used an older
immutable root after five later updates with different execution states.

Fill principal transaction:
`2c4e3d138395fb4f7430ad90aae59eac3e3eee809c87570f7001c70ce18bcec0`.
Unfilled-refund principal transaction:
`6728815506740463998e2a48a0d6c4582eb5bc6b58010ccfb96c745aab3cc3cb`.
Each transfers **1,000 disposable CKB** to its exact committed recipient lock.
Fresh replay independently read both receiver cells. CKB reports spent input
cells as `unknown` in this node's live-cell API; commitment of the consuming
transaction and the live receiver output establish the transfer. A diagnostic
probe is not used as evidence of principal settlement.

Freshness is funded policy: minimum publisher version, minimum execution block,
and optional maximum execution block. There is no dependency on the latest live
state cell and no automatic wall-clock expiry of a terminal proof. These rules
are safe for the pinned contract's irreversible terminal leaves, not arbitrary
mutable application storage. Withholding locks principal until valid evidence
is obtained; independent proof retrieval/archival availability remains necessary.

## Measured native costs

| Transaction | Cycles | Serialized bytes |
|---|---:|---:|
| Bootstrap | 531,326 | 1,649 |
| Committee certification | 17,424,406 | 25,590 |
| First finality/root update | 60,832,914 | 3,530 |
| Later finality/root update | 60,831,584 | 3,530 |
| Fund either principal | 14,426 | 869 |
| Actual filled principal payout | 564,138 | 1,872 |
| Actual unfilled principal refund | 624,993 | 2,021 |

The unchanged native pool threshold is 70,000,000 cycles, including all executed
scripts. The later live update required 20 bounded local maturity waits for CKB's
median-time `since` rule; the check was retained. Successful workflow: 15 native
transactions, including seven defensive funding controls; fixed fees 0.15 CKB.
The eight core transactions excluding those controls cost 0.08 fixture CKB.
Seven EVM receipts used 1,884,025 gas and 0.001884025013188175 fixture ETH.
Across all live-driver attempts, deduplicated cost was 19 native transactions /
0.19 fixture CKB and 14 EVM receipts /0.004797280033580960 fixture ETH.
Offline replay is a separate isolated run: 15 exact captured transactions plus
one additional forged-root control, 26 expected native rejections, 0.16 fixture
CKB. It reproduces all captured hashes and cycles and adds independent double-
settlement, certificate-as-root and substituted-root rejection checks.

Occupied minima: state 386, certificate 482, root 282, funded reservation 518,
recipient 73 CKB. Actual state/certificate/two roots each allocate 1,000 CKB,
retaining 4,000 CKB excluding code. Seven intentionally invalid funding controls
retain 7,000.07 additional disposable CKB. Shared code 148,200 bytes requires a
148,241-CKB minimum code cell; the 9,416-byte adapter requires 9,457 CKB. The five additional code cells each allocated 1,000,000 fixture CKB in genesis
(5,000,000 total, deliberately oversized). Code was
supplied in isolated genesis cells: deployment transactions/fees were not
measured. Receiver/funding locks are explicit always-success disposable fixtures,
not production wallet locks. Production wallet verification costs are excluded.

Observed funding-to-settlement latencies were 514.785 and 595.327 seconds,
including actual interruptions and recovery. They are not optimized latency
benchmarks or business SLAs. Fixed test fees are not a public fee-market quote.

## Rejections, limitations and decision

The successful live run records 22 native rejection cases. The independent replay
records 26 with matching original script/context error codes, plus invalid BLS,
execution-root, finality-branch and chain-domain reference cases for both updates.
Cases cover forged committees, invalid Type ID, wrong registry/source genesis,
wrong contract code hash/terms/storage slot, history below the funded version or
outside the block window, invalid/withheld proofs, wrong terminal status or
principal recipient, replay/double settlement, certificate-as-root and substituted
104-byte root data. The historical adapter run adds 108 native negatives across
26 transactions, including a genuine independent registry and arbitrary root.

**Decision:** E2 plus the isolated E1 adapter now demonstrates actual proof-gated
exchange settlement on a controlled real PoS chain, including fill, unfilled
refund and persisted/historical-root recovery. Mainnet execution-history payout
and a production exchange are not demonstrated. Remaining work includes fresh
independently justified mainnet weak-subjectivity checkpoints, modern forks,
wider participation, live committee/liveness handling beyond the bounded subset,
independent archival proofs, audited funding/principal contracts and wallet locks,
CKB/Ethereum reorg/confirmation policies, retention economics and production
security review. No public-mainnet Outcomes deployment or mainnet trade is claimed.

All private PoS clients were stopped after evidence capture. The ignored runtime
can be recovered locally; no validator keystores or execution JWT was committed.
The well-known disposable generator mnemonic is explicitly marked test-only.
