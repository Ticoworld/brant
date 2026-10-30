# WO04-E2D-P1A executed result — 30 October 2026

**VERIFIED in the bounded isolated-chain environment:100-CKB swaps work with a
73-CKB occupied intent, empty data, no type script and a32-byte commitment.**
Each actual intent held 100.01 CKB, of which 100 was principal and 0.01 the fixed fee
reserve. The 73-CKB occupancy is included in that capacity, not added on top.
The maker received exactly 100 CKB after real controlled-token delivery; unfilled
intents independently returned exactly 100 CKB after finalized authenticated expiry.

New lab: `labs/wo04-e2/compact-intents/`. E2D-P0, E2C, E2B and prior evidence are
preserved byte-for-byte: all 1,006 prior tracked lab files are unchanged. This is private Capella PoS and isolated native CKB,
using a controlled USDC-shaped token, not issuer-backed/public assets. No merge,
reverse swap, rollup, large batching or staged BLS path was introduced.

## Real positive and adversarial executions

Four actual intents were funded with standard user secp256k1 signatures:

- A and B share **identical complete base terms and lock args**. They are outputs
  0 and 1 of funding transaction
  `ae6f16eef7e4a14d904eb3e56ab97196916fa755a9308f726278c333e06d610e`.
  A received a real 100-unit controlled-token fill; B received no Ethereum fill.
- D has different base terms and another lock group, with a50-unit actual fill.
  A and D have the same maker reimbursement lock and 100-CKB principal.
- C is another unfilled 100-CKB order. It and B refunded without Ethereum open or
  expiry transactions. All four principal outputs use standard recipient locks.

Exactly 100 CKB was paid in each of these committed native transactions:

| Outcome | Transaction |
|---|---|
| A maker reimbursement | `bf5a4792609779a825fdd32b898ec244f6e580bcdba370b55a24309c9773f65f` |
| D maker reimbursement | `8839e47707a6c58ece4a5424b23d3b947eaac68333129aeff7676a63c8530265` |
| B unfilled twin refund | `f5b8b13772c4a18db66850b2aa74ebca28d0814aa7ca2df522ef444100f43de0` |
| C unfilled refund | `9d1ec27559819ab30329955380fe7c0c35a1f2bbfe523dda089ae7897a728ae7` |

The identity attacks executed before successful consumption:

- A's complete valid witness reused on B failed exit 16 (actual OutPoint mismatch).
- Rebinding only the witness OutPoint to B while retaining A's genuine fill proof
  failed exit 72. Its actual key/ID cannot authorize the twin.
- Two same-lock inputs with one proof/shared payout failed exit 14. The final
  replay also tested **exactly one witness** for those two inputs.
- Two different lock groups, each with its own genuine independently valid fill
  proof, could not share one 100-CKB payout: exit 14. Each then paid separately.
- Mutated principal, fee, maker, both recipient locks, user recipient, asset or
  deadline failed commitment exit 27. Mismatched claimed points failed 16; altered
  payout principal failed 23; wrong recipient or replacement intent output failed 22.
- Truncated/reused witnesses, replay and duplicate settlement failed. Native input
  type/data are required absent/empty; no Type ID is relied on for intent identity.
- Real finalized non-inclusion returned B and C's original principal. Proof parser,
  exact account code hash, typed publisher authority and the 720-byte authenticated
  execution-timestamp predicate are preserved from P0.

## Why OutPoint identity is necessary and not circular

Lock args commit to536 canonical bytes: the 480-byte static ABI base order plus
code hash, minimum root version/block and fee. The order binds protocol,
Ethereum chain ID, Outcomes address, Ethereum genesis and registry, CKB genesis,
maker/refund locks, asset, amount, user/maker, deadline and principal. A reserved
funding-ID word must be zero. **No funding OutPoint occurs in this base hash.**

The complete raw funding transaction can therefore be constructed and signed.
Only then is Ethereum's ID derived:

`SHA256(baseOrderABI480 || fundingTxHash32 || outputIndexABI32)`.

The index is an ABI uint 32 in a32-byte big-endian word. CKB's actual serialized
OutPoint is transaction hash 32 plus indexLE4. Native settlement loads the real
consumed CellInput, compares all 36 claimed bytes and computes the ID from the
actual input, not the caller's claim. Native/Python/Solidity results match, with
index boundary vectors 0,1,255,256 and 2^32-1. The actual nonzero-index B refund
also executes this binding rather than merely testing arithmetic.

The funding transaction hash itself commits to its lock commitment, so all 536
base/policy bytes are transitively bound even though Ethereum directly encodes
only the 480 order bytes. Moving terms into the witness does not move authority
into the caller: exact SHA256 equality and canonical field checks are mandatory.
Duplicate base terms intentionally produce equal lock args, **not equal fills**.
An old fill cannot authorize a recreated/replacement cell at a new OutPoint.

## Single-intent accounting invariant

The consumer requires one **global** input, not one per lock group. It also
requires exactly one output, empty output data, no output type and the exact
committed beneficiary/principal. Actual input capacity must be principal+fee.
Therefore one proof cannot authorize two inputs, two groups cannot each count
one output, and a principal cannot be silently reduced to increase fees. No
extra fee-sponsor input or change output is supported in this version.

Funding A/B as two outputs from **one funding input** is an identity test, not
multi-input settlement batching. All successful settlements consume one intent
and produce one payout. General batching/output assignment remains unimplemented.

## Actual occupied capacity and 20-byte alternative

The node accepted a no-data/no-type 32-byte-lock cell at **73 CKB** and rejected
72.99999999 with `InsufficientCellCapacity(Outputs[0])`: expected occupied
`0x1b31d2900` versus supplied `0x1b31d28ff`. This is actual native send/acceptance,
not an arithmetic-only estimate.73 =8 capacity bytes +32 code hash +1 hash type
+32 args. Actual funded orders used 100.01 CKB and settled 100, above the 61-CKB
standard-recipient minimum.

P0 occupied 642 CKB. P1A saves 569 CKB, about 88.6%. The removed 65-byte type script
and 504 fewer lock-arg bytes account for the saving. There is no hidden on-cell
order data or unique-funding type. Complete terms and 36 claimed OutPoint bytes
instead enlarge the spending witness; old-chain evidence/data are not deleted.

The separate 20-byte build accepted 61 CKB and rejected 60.99999999: expected
`0x16b969d00` versus supplied `0x16b969cff`. This was **capacity-only**; no secure
20-byte trade result is claimed. Its consumer is separate, while default code
requires 32 args. SHA256 truncated to160 bits has generic collision work 2^80,
versus 2^128 for 256 bits; targeted preimage/second-preimage margin also falls.
These are derived cryptographic bounds, not an executed collision attack. Terms
may be adversarially selected; OutPoint binding does not restore the truncated
commitment's collision margin. Saving only 12 CKB is not justified for this target;
the demonstrated swap uses the full 32-byte commitment.

## Measured execution costs

| Native operation | CKB-VM cycles | Serialized bytes |
|---|---:|---:|
| Signed A/B two-output funding | 1,624,886 | 593 |
| Signed D funding | 1,630,640 | 472 |
| Signed C funding | 1,663,467 | 472 |
| A or D maker settlement | 1,044,297 | 2,901 |
| B or C refund | 1,011,230 | 2,830 |
| First/following authenticated root | 60,832,914 /60,831,584 | 3,530 each |
| Committee certification | 17,424,406 | 25,590 |
| Bootstrap | 531,326 | 1,649 |

All executed scripts are included, under unchanged 70,000,000-cycle pool policy.
Main run:13 native transactions and 0.13 fixture CKB fixed fees, including two
capacity-only probes. Excluding probes:11 transactions /0.11 CKB for four intents,
shared feed setup/updates and four settlements. Each reservation contributes its
own 0.01 fee; principal is never used for that fee. Funding and recipient locks
are standard secp; feed-management funding remains a disposable fixture.

Five main-run EVM receipts total 1,673,880 gas /
0.001673880011717160 fixture ETH: token deployment 724,521; OutcomesV3 deployment
715,458; amortizable maker approval 44,339; A fill 103,325; D fill 86,237. Different
recipient-storage state contributes to the two fill gas costs; do not treat one
as a universal public-USDC quote. Users and unfilled orders sent no Ethereum
transactions. Controlled-token amounts are arbitrary test terms, not priced quotes.

A/D delivery from native funding:5.339 /7.223 seconds. A/D reimbursement:
324.096 /323.414 seconds. B/C refunds:440.094 /438.958 seconds. These private
3-second-slot observations include an unsupported-update interruption and actual
recovery, not optimized latency or mainnet predictions.

Occupied state/certificate/root minima remain 386 /482 /282 CKB, with 1,000 CKB
actually allocated per cell, retaining 4,000 excluding code. Shared bundle minimum
148,241 CKB; default consumer 13,280 bytes /13,321 CKB minimum; experimental 20-byte
consumer 13,496 bytes /13,537 CKB minimum. Code is supplied in isolated genesis;
production deployment transactions/fees were not measured. The two capacity
probes retain 134 disposable CKB per live chain and are not funded swap examples.
Exact values and all development-attempt costs are in `evidence/costs.json`.

## Recovery, scope and independent reproduction

A first driver bug occurred after creating the identical pair. Its preimage was
reconstructed from a bounded set of known creation-block candidates and verified
against the exact on-cell SHA256 commitment; no terms were fabricated. Both early
100-CKB cells subsequently refunded with genuine finalized **empty-storage-trie**
proofs. The later driver saves full packages before broadcast; release source
also fsyncs them. Opaque commitments require clients to retain those preimages:
there is no general on-chain recovery from a lost hash-only order. Package backup
and proof availability are real requirements, not eliminated by capacity savings.

The successful run was interrupted by a genuine 342/512 participation update,
outside the preserved native 0–2-missing-signer range. The packet builder rejected it before CKB submission. That capture is preserved;
342-participant CKB-VM verification was not executed or claimed. The original funded OutPoints and completed
Ethereum deliveries resumed with genuine 512/512 updates. No staged verification,
security-check removal, new funding or replacement delivery was used.

Final full command (after pinned dependency setup):

```sh
P1_RUN_NAME=final-preserved bash labs/wo04-e2/compact-intents/src/reproduce.sh
```

It passed with pre/post fixture-integrity checks and no live Ethereum/Docker/network access:13 original transaction
hashes and cycle counts reproduced,90 native rejection cases, four independently
read 100-CKB recipient cells;3,602 parser checks;65 raw beacon states /97 block
bodies and actual BLS/finality/execution predicates with invalid reference cases.
The earlier recovery independently replayed its 9 transactions and two 100-CKB
refunds on its original frozen genesis. Deployed OutcomesV3 runtime/creation data
and constructor immutables independently match the pinned source artifact and
expected code hash. Both reproduction paths preserve raw proofs and transactions.

## Technical decision and remaining economics

**100-CKB trades are technically demonstrated with 73-CKB occupied intents** under
the tested finality, token and availability assumptions. Capacity no longer
forces 642 CKB for a100-CKB principal. This does not demonstrate profitable 100-CKB
public-chain trades. Public Ethereum approval/fill gas may exceed a small trade's
value; code/root maintenance, archival proof access and maker liquidity/hedging
costs remain. Maker inventory stays committed through source confirmations,
Ethereum execution/finality and CKB reimbursement. No current market prices,
public gas quote, LP commitments or positive profit margin were measured.

Fixed fee reserves need a production fee/liveness policy; strict single-input
accounting currently excludes sponsorship. Native public-chain deployments,
modern Ethereum forks, broader participation, fresh justified checkpoints,
confirmation/reorg policies, token/client audits and retained-state economics
remain. Ethereum still does not authenticate CKB funding/confirmations itself:
makers must independently verify the actual funded OutPoint before delivery.
OutPoint uniqueness is not an EVM-side CKB light client. No reverse swap, rollup,
large settlement batch or wider-participation staging is implemented.
