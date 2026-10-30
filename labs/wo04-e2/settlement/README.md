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
