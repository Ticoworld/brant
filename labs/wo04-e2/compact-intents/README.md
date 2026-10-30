# WO04-E2D-P1A: compact, uniquely settled 100-CKB intents

**Executed:** default 32-byte lock commitment, empty data, no type script;
**73 CKB occupied capacity**, checked by actual native acceptance at73 and
rejection at72.99999999. Actual orders fund 100 CKB principal plus 0.01 fee reserve,
not an additional 73-CKB deposit. Standard user-signed funding and standard
secp256k1 recipient locks remain. E2D-P0 and all prior experiments are unchanged.

## Independent reproduction

After the preserved pinned cloud dependencies and py-trie reference packages
are installed (the reference loader can reuse P0's read-only packages):

```sh
P1_RUN_NAME=new-label bash labs/wo04-e2/compact-intents/src/reproduce.sh
```

No Ethereum clients, Docker or Internet are needed for captured-fixture
reproduction. It rebuilds the immutable contract/native consumers, validates the
actual deployed runtime from saved data, tests canonical OutPoint encoding and
MPT behavior, checks genuine Ethereum BLS/SSZ fixtures, then executes all native
transactions and attacks on a fresh node. Final primary run:13 native commits,
90 expected rejections, every captured hash and cycle count identical. Existing
labels are refused. Parser reference requirements are in `requirements-mpt.lock`;
new packages may be installed under this lab's ignored `tools/python` directory.

The additional early-attempt recovery can be reproduced after building:

```sh
P1_RUN_NAME=early-new P1_REPLAY_SOURCE=early-cells-recovered P1_SPEC=early-ckb-dev.toml node labs/wo04-e2/compact-intents/src/replay.cjs
```

Live capture helpers retain the prior isolated PoS setup, with fresh output/
evidence directories and the same pinned dependencies. Never overwrite archived
fixtures. `devnet/start.sh` keeps validator/JWT-generation logs in ignored runtime;
fixture keys and mnemonic must never be used publicly. The live clients were
stopped after evidence capture.

## Identity without circular transaction hashes

The 536-byte base terms include canonical 480-byte ABI order encoding, expected
OutcomesV3 code hash 32, minimum root version LE8, minimum block LE8 and fee LE8.
The legacy funding-ID word is canonical zero. The base binds protocol domain,
Ethereum chain/contract/genesis/registry, CKB genesis, maker/refund locks, asset,
amount, user/maker addresses, deadline, principal and the additional native policy.
It contains **no funding transaction hash or output index**.

Funding lock args are SHA256(baseTerms),32 bytes. The signed raw funding
transaction can then be finalized and its OutPoints known without a circular
hash. Full Ethereum order ID is SHA256 of the first 480 ABI bytes followed by
funding transaction hash 32 and output index as a32-byte ABI uint 32 word. CKB
loads the **actual consumed CellInput**, compares its serialized 36-byte OutPoint
to the witness claim, and derives the ID from the actual input. Native output
index is LE4; Ethereum's ABI word is BE32. Boundary vectors 0,1,255,256 and 2^32-1
are independently checked. The funding transaction hash also commits to the base
commitment, so code hash/fee/native policy remain transitively bound to identity.

Two otherwise identical intents were outputs 0 and 1 of the same funding
transaction. Their base commitment is identical; their Ethereum IDs differ.
One actual fill could not claim the other output, even after rebinding its witness
OutPoint. The unfilled twin subsequently refunded correctly at output index 1.

## Spending format and accounting

Witness: mode 1 byte, base terms 536, claimed serialized OutPoint 36, preserved
finalized header/time proof 720, canonical account/storage proof. Terms are
canonically decoded and hashed exactly. No caller-provided ID/slot is authoritative.
Input data must be empty and input type absent. Actual capacity must equal the
committed principal plus reserve. The unchanged E2 authority and timestamp
predicate authenticates the proof before payout/refund.

**Exactly one GLOBAL input and exactly one payout output** are enforced. This is
stronger than one input per lock group and excludes fee-sponsor inputs. Payout is
exactly principal, to its committed maker/user lock, with no type/data or extra
outputs. Both same-group and different-group multi-input attacks fail before
proof processing. The different-group test uses two independently valid actual
fills targeting the same maker/output. Each then settles separately. There is no
multi-input settlement/batching feature.

Only the base commitment is on the cell: clients must retain the full terms.
The driver writes recovery packages before broadcast; release source fsyncs the
package. Actual recovery reused original funded cells and completed deliveries.
An earlier development attempt's preimage was reconstructed from a bounded set
of known deployment/block candidates and verified by its exact SHA256 commitment;
this is **not** a general recovery mechanism for lost arbitrary terms. Those early
cells were also refunded. Wallet backups/data availability remain requirements.

## 20-byte assessment

A separately compiled 20-byte consumer has a61-CKB occupied minimum, also checked
by node rejection one shannon below and acceptance exactly at61. This is a
**capacity-only weaker experiment**, not an endorsed or demonstrated 20-byte swap.
Default 32-byte code requires 32 args and does not auto-downgrade. Truncating
SHA256 to160 bits reduces generic collision work from 2^128 to2^80 and fixed-target
preimage/second-preimage margin from 256 to160 bits. Adversarially chosen order
terms matter, so address-hash intuition is not sufficient justification. Saving
12 CKB is unnecessary for 100-CKB orders. Keep 32 bytes.

See [the executed report](../../../docs/E2_COMPACT_INTENT_RESULT.md) for exact
costs, capacity, latency, source guarantees and remaining public-gas/liquidity/
profitability constraints. Main evidence: `chain-live-recovered.json`,
`chain-release-final.json`, `identity-tests.json`, `costs.json` and fixture hashes.
