# WO04-E2D-P0 executed result — 30 October 2026

**VERIFIED on real private Ethereum PoS and isolated native CKB:** both funded
swap paths execute with **zero user Ethereum transactions** and no explicit EVM
expiry transaction. The filled order delivers 100 controlled-USDC units and pays
the originally committed 1,000 fixture CKB to the maker. The unfilled order returns
its original 1,000 CKB from storage non-inclusion and a strictly post-deadline
finalized execution timestamp. This is a controlled mechanism demonstration, not
Circle-issued USDC, a public-chain deployment or production readiness.

The E2C fallback at `aa78dac956a316aaccd9d009dc0eeff3389ae55d` is preserved.
All 745 pre-existing tracked lab files are byte-identical. New work is isolated in
`labs/wo04-e2/zero-origin/`. No reverse swap or staged verification for more than
2 missing signers is implemented. PR #2 remains unmerged.

## What actually executed

- User funding used the standard native secp256k1 lock and signed two real CKB
  funding transactions, creating unique reservation identities. Each input order
  locks 1,000.01 CKB: 1,000 principal and 0.01 fixed settlement fee. Recipient locks
  are standard user/maker secp256k1 locks, not always-success payout fixtures.
- `OutcomesV2` was deployed with immutable Ethereum genesis, light-client registry
  and CKB genesis. Its actual creation input and reconstructed immutable runtime
  independently match the pinned solc 0.8.30 source and the code hashes committed
  by the funded intents (`deployment-verification.json`). There is no owner,
  proxy, upgrade, open, expire, cancel or terminal-marker-clearing function.
- The maker approved the controlled token once and called `fill` with the entire
  deterministic order. The actual user balance increased 100,000,000 base units.
  No user Ethereum signature or transaction was required.
- Genuine 512-participant sync signatures authenticated native light-client
  advances to finalized beacon slots 3040 and 3072, execution blocks 674 and 706.
  Geth account/storage proofs matched the exact published roots and code hash.
- Maker reimbursement consumed the filled order ID marker. Refund consumed a
  cryptographically proved absent order slot only after authenticated execution
  time exceeded its committed deadline. There was **no EVM transaction for the
  unfilled order**, including no failed on-chain fill/expiry transaction; the
  late-fill rejection used read-only `eth_call`.
- User Ethereum address `01c25Fd98a475aae8DFb65012F6A4D8ff1092D19` had nonce 0
  before and after. Every actual EVM receipt is from the maker or setup/test
  controller. Customer Ethereum transaction count and gas are both 0.

Native principal transactions:

- Filled reimbursement:
  `4706590bd3b4d7578e09cc88f6148c2be309ddde3c03262898d6fc43a6e2295e`.
- Empty-slot refund:
  `d2ed1af66f357b1ec6deb262dfc7b67b16d0f74c16d3cc0180483368c5207d5b`, with its independently read user recipient cell in the evidence.

The private PoS network continued the digest-pinned E2C Geth 1.13.15 /
Lighthouse 4.6.0 chain, with 64 real controlled validators and a512-position
mainnet-preset sync committee. The 3-second slot configuration, trusted local
bootstrap and Capella-only bounds are explicit. The new bootstrap is
`498ba839213a617aee951e3930f47c01c4b51ec74b9907b67b478a0130017f32`.
Neither signatures nor payout roots were mocked or selected separately per trade.
The native verifier retains standard sync-committee light-client trust
assumptions; it does not independently execute Ethereum or verify every FFG vote.
All validators being controlled by this lab is not decentralized economic security.

## Deterministic funding and irreversible delivery

Order ID is SHA256 of480 canonical static ABI bytes: protocol domain, Ethereum
chain ID, Outcomes address, Ethereum genesis, registry lineage, CKB genesis,
exact funding type identity, maker reimbursement lock, refund lock, asset,
amount, user recipient, maker, deadline and CKB principal. Address/uint widths
are canonical. Native script args also bind the exact deployed code hash,
minimum root version/block and fixed fee. Native consumption requires the exact
original unique reservation type and principal capacity.

The order can be delivered without prior destination state. `fill` checks source
identities, structural validity, caller maker and `block.timestamp < deadline`;
sets the global mutex and terminal marker; transfers from the maker's approved
balance; verifies exact recipient balance increase; and permanently retains
`filled[id]=id` only if everything succeeds. A failed token call rolls back the
marker and transfer. Competing maker/order replays cannot redirect reimbursement.

The six-decimal token is a minimal controlled USDC-shaped transfer fixture,
including deliberately adversarial modes. It is not issuer-backed USDC or a
claim of complete production token compatibility. Production issuer/token code,
upgrades and transfer restrictions require separate integration and review.

## Correct non-inclusion and authenticated time

The new MPT verifier has distinct outcomes: valid inclusion, authenticated
non-inclusion, and error. **An error never means an empty slot.** It verifies a
present contract account and exact code hash before examining storage. Missing
accounts, invalid hashes, malformed RLP/compact paths, truncation, extra nodes or
incorrect root relationships cannot refund. Valid absence includes the canonical
empty storage trie, empty branch child, or authenticated divergent leaf/extension.
Optional supplied inline nodes are consumed only if their complete canonical RLP
matches the already authenticated inline node. The caller's JSON slot/value
labels are never authoritative; native code derives the mapping key from the
committed deterministic order ID and slot 0.

The original 104-byte E2 publisher is unchanged. An additional 720-byte proof
contains the finalized beacon header 112, Capella execution SSZ chunks 480 and
execution-to-body branch 128. Native verification requires:

1. Beacon header root equals the **exact authorized publisher's finalized beacon
   identity**, pinned to the source chain, registry and publisher code.
2. Execution header SSZ root and correct body branch match that beacon body.
3. Execution state root, block number and block hash match publisher data.
4. Timestamp is the authenticated canonical uint 64 execution field.
5. Refund requires both storage **absence** and `finalizedTimestamp > deadline`.

The actual unfilled deadline was 1793383582. The first finalized execution time
1793383513 was too old and refund was rejected. Time 1793383609 permitted refund.
Both execution blocks have state root
`abe248c03ad4014a4784e5f068ef4d83e538650941749a2fc106456bb61bdaaa`.
This makes the timestamp test decisive: equality of storage state roots alone
cannot establish expiry. A genuinely authenticated later header grafted onto the
older immutable root was rejected with native exit 110. Mutating the timestamp
or branch was also rejected. A separately funded exact-deadline control failed
with exit 21, proving the strict inequality boundary.

After finalized time passes the deadline, the immutable contract cannot accept
new fills, and it cannot erase an old fill. Therefore absence at that exact
finalized state safely excludes prior successful delivery under the light-client
assumptions. A filled marker remains reimbursable after the deadline. There is no
host-clock refund, event-absence inference or caller-selected trusted root.

## Actual results, costs and latency

| Native operation | Cycles, all executed scripts | Serialized bytes |
|---|---:|---:|
| Bootstrap | 531,326 | 1,649 |
| Committee certificate | 17,424,406 | 25,590 |
| User-signed filled funding | 1,637,091 | 1,098 |
| User-signed unfilled funding | 1,645,292 | 1,098 |
| First finalized root | 60,832,914 | 3,530 |
| Maker reimbursement | 1,038,250 | 2,503 |
| Later finalized root | 60,831,584 | 3,530 |
| Independent user refund | 973,118 | 2,347 |

The unchanged tested pool threshold is70,000,000 cycles. Eight core native
transactions cost 0.08 fixture CKB at fixed 0.01 each. Each settlement fee is paid
from its original reservation. Native feed funding still uses a disposable
always-success management wallet; user funding and principal receivers use
standard secp locks. Production feed-wallet verification/deployment costs are
not inferred from these numbers.

Per actual filled order, the maker Ethereum fill used 85,534 gas and cost
0.000085534000598738 fixture ETH. The unfilled order used 0 Ethereum transactions
and 0 gas. Approval is a separately measured amortizable maker setup transaction:
44,339 gas. Token/Outcomes deployment plus approval plus the actual fill total
4 receipts, 1,548,014 gas and 0.001548014010836098 fixture ETH. Including all defensive
and token tests, the live run has 17 EVM receipts, 2,927,949 gas and
0.002927949020495643 fixture ETH. Four receipts are intentionally reverted token
transfers. All live attempts, including the preserved pre-funding RPC failure,
are costed separately in `evidence/costs.json`.

Measured separately:

- Funding to customer controlled-USDC delivery:2.538 seconds.
- Maker transaction submission to delivery receipt:1.987 seconds.
- Funding to maker CKB reimbursement:275.684 seconds.
- Funding to user CKB refund:372.787 seconds, including its 120-second deadline,
  PoS finality and native admission/maturity waits.

These are actual private 3-second-slot observations, not public-mainnet latency
forecasts or business SLAs. Fixed fixture fees are not fee-market quotes.

Occupied minima: funded intent 642 CKB, state 386, certificate 482, root 282,
standard recipient 61. Funded intent minimum is124 CKB larger than E2C's518 due to
its full deterministic order. Actual principal is1,000 CKB; each state/certificate/
root allocates 1,000, retaining 4,000 excluding code. Shared bundle 148,200 bytes
requires 148,241 CKB minimum; consumer 13,056 bytes requires 13,097. Four additional
code cells each allocate 1,000,000 disposable CKB in isolated genesis. Deployment
transactions/fees were not measured. The final defensive replay additionally
funds 9 invalid controls and a300-CKB forged-root cell; these are tests, not swap
capital requirements. Exact capacities are in `costs.json` and raw transactions.

## Adversarial evidence and reproducibility

Live:8 committed native transactions,38 native rejections,17 actual EVM receipts,
12 additional read-only EVM rejection cases. Token tests include false return,
revert, insufficient credited amount, malformed return, supported no-return,
actual cross-order reentrancy blocked by the mutex, replay and wrong maker/terms.
Early native cancellation, proof withholding, truncated/forged MPT/header proofs,
wrong beneficiary/mode and committee-as-root substitutions were rejected. Later
valid proofs consumed the same original funded cells; no maker expiry action was
needed. Independent `get_proof.py` uses read-only RPC and no signer; native funded
controls use its actual archived Ethereum account/storage proofs.

Final complete release command passed (including offline compiled-runtime verification):

```sh
E2D_RUN_NAME=release-check bash labs/wo04-e2/zero-origin/src/reproduce.sh
```

After pinned dependency setup it requires no Ethereum client, Docker or network.
It reproduces all 8 original transaction hashes/cycles on fresh native CKB,
verifies 3,602 native parser calls against independent py-trie 3.1.0 (including all
truncations/single-bit mutations of selected vectors), and checks 71 captured
BeaconState roots,103 block bodies and actual BLS/finality/execution predicates.
Invalid signature, execution-root, finality-branch and chain-domain reference
variants fail for both updates. Generated trie unit roots are explicitly **not**
consensus or payout evidence.

Expanded native replay:18 committed transactions and 50 expected rejections.
Additional genuinely funded controls reject missing accounts 70, incorrect code
hashes 71, alternate Ethereum chain 19, wrong genesis 103, wrong registry 101,
invalid deadline 13, equality 21, future trust version 101, wrong funding identity 16,
wrong storage proof 72, forged root 101 and the later-header substitution 110.
All rejection classes are actual script/context failures, not network errors.
Raw receipts, transactions, proofs, compiled source/runtime verification, client
logs and fixture hashes are preserved in the new lab. The final client processes
were stopped after evidence capture; keys and JWT material are excluded.

## Improvement, source lessons and unresolved guarantee

E2C's pair required two user Ethereum opens and an explicit expiry, with 7 core
EVM receipts including setup. P0 has 4 including setup and one actual maker fill;
it removes 3 transactions for the pair, all user Ethereum origin activity, and the
expiry actor/liveness dependency. Its extra native time/non-inclusion/order checks
cost more CKB cycles, bytes and minimum capacity; this is not a claim of overall
commercial profitability or a like-for-like production gas benchmark.

The bounded public-code access checks succeeded. Source-level lessons from
pinned DLN destination/source and Across fill/refund contracts, with exact files,
commits and original licenses, are in `DESIGN_LESSONS.md` and `references/`.
Deterministic destination fill, immutable chain/beneficiary binding, pre-transfer
replay state/mutex and separately authenticated reimbursement were relevant.
Across's relayer-refund bundle is not equivalent to this user non-inclusion refund.
No production DLN/Across implementation is linked into this experiment.

**Unresolved:** OutcomesV2 does not authenticate CKB funding or confirmations
inside Ethereum. Structurally valid unfunded unit orders were deliberately filled
in contract tests; those are not completed swaps. Makers must independently check
live, correctly locked native funding and source confirmation depth. The proven
funded cell cannot be discretionarily cancelled, but a funding reorg/unconfirmed
double spend is not solved by the destination contract. Reverse USDC-to-CKB
trading would need an EVM-side authenticated CKB delivery/settlement guarantee and
coherent source escrow/timeouts. E2 authenticates the opposite direction only.
No reverse implementation or replacement trust assumption is introduced.

Fresh independently justified mainnet checkpoints, modern forks, wider sync
participation, independent archival proof availability, production token/wallet/
intent audits, reorg policies and retained-state economics remain requirements
before production. Within this bounded real private-PoS experiment, eliminating
both user-origin Ethereum transactions and explicit expiry is demonstrated.
