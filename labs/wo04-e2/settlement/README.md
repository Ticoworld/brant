# WO04-E2C: authenticated principal settlement

New isolated experiment; E1 and E2B source/evidence remain unchanged.

`contracts/settlement.c` retains E1's direct terminal-leaf proof and exact
principal allocation rules, replacing its bootstrap-cell trust with
`authorize.h`. Shared-checkpoint witness mode is rejected; it cannot bypass E2.
`history_probe.c` is explicitly a diagnostic and never principal settlement.

The adapter pins the **exact immutable E2 bundle code hash** and `data2`, root
role argument length 104, full registry script identity, source genesis/domain,
minimum state version and execution-block bounds. It does not accept an arbitrary
104-byte cell, a committee certificate, or a caller-selected publisher program.
The root constructor and state transition are the preserved E2B implementation.
The historical mainnet and explicitly configured private-PoS programs have
separate code identities. Devnet configuration never changes mainnet binaries.

Historical immutable roots remain valid after the state cell advances: their
publisher constructor already checked the same-transaction authenticated state
transition, and their type script forbids consumption. They need no spent live
state dependency. Funded terms select a minimum version/block and optionally a
maximum block (zero means no upper bound). No automatic latest-version or
wall-clock expiry can strand terminal proofs. This relies on the pinned Outcomes
contract's irreversible terminal leaf and code hash, not a generic assertion that
old mutable application states are safe. No zero-slot or absence refund exists.
Proof withholding preserves principal; it is not an independent refund escape.

Args are E1's 324-byte layout plus registry lineage32, genesis validators root32,
minimum version LE8, minimum execution block LE8, maximum execution block LE8.
The first two E1 dependency identifiers are reserved zero bytes; checkpoint mode
is disabled. Root cell is dependency 0. The root's 104-byte E1 layout remains
`SHA256(genesis || lineage) || executionRoot || blockNumberLE8 || blockHash`.
Trade domain must equal this exact first field. Terms commit the EVM chain ID,
contract, token, participants, amount/deadline, CKB genesis, principal, recipient
locks and unique reservation identity, as in E1. Controlled funding consents to
that digest; the CKB script proves its irreversible filled/expired terminal leaf.

See `devnet/start.sh` for digest-pinned real Geth/Lighthouse/genesis tooling.
Private fixture keys live only under ignored `devnet/runtime`; the source's
well-known mnemonic is disposable and must NEVER be used on a public chain.
The internal Docker bridge has no external routes/peers. Client API requests use
only the directly attached private addresses. A proxy exception applies only to
those local services, not arbitrary Internet destinations.

Actual results, commands, fees and limitations are recorded after execution in
`evidence/` and `docs/E2_FINALITY_PROGRESS.md`. Do not infer positive settlement
from a diagnostic probe or from historical root metadata alone.


Executed result: **actual private-PoS finalized fill and unfilled refund**, each
transferring 1,000 disposable CKB. See [the report](../../../docs/E2_SETTLEMENT_RESULT.md)
and `evidence/chain-pos-settlement-verified.json`. The independent final replay
has 16 committed transactions and 26 expected native rejections; 15 original
transactions reproduce hashes and cycle counts exactly. Fill/refund cost 564,138 /
624,993 cycles. These are actual principal transfers, distinct from probes.

```sh
# Captured real-consensus reproduction; no Ethereum network or Docker required.
E2C_RUN_NAME=new-label bash labs/wo04-e2/settlement/src/reproduce.sh
```

For a fresh LIVE experiment, first install the same pinned images, then use a
fresh `devnet/runtime` (start refuses an existing genesis) and an unused evidence
label. `devnet/start.sh` generates disposable validators and starts real clients.
Run `src/native.py`, wait for non-genesis finality, run
`../.venv/bin/python devnet/prepare.py bootstrap`, `python devnet/build.py`,
`node src/compile.cjs`, then `E2C_RUN_NAME=... node src/pos-trades.cjs` from this
lab. The checked-in fixtures are immutable: select a fresh checkout/output
location for new genesis/captures, not the archived evidence paths. Exact captured
configuration is provided for offline replay. Stop only the named `e2c-*`
containers after use. No public peers or public-chain fixture-key use.

The private-network helper currently requires the directly attached 172.18.*
bridge and fails closed for another subnet; adapt and inspect that local routing
explicitly when reproducing elsewhere. It never uses host networking to bypass
an external network policy. The running experiment was stopped after capture.
