# E2E: economic gate, funding-witness recovery, immutable authority audit

Baseline `7771f6c73fcebf6777e4d4f9c3b562eb797ecc36`. No previous lab is modified.

- `src/model.py`: 64 conditional route/notional/root-sharing cases, full component costs,
  quote-spread net revenue and operations-volume sensitivity. **Not observed prices or profitability.**
- `src/capture_sources.py`: bounded primary-source/market attempts. Denied responses are retained.
- `src/recovery.cjs`, `recover.cjs`: strict CKBREC01 format in standard WitnessArgs.output_type;
  independent recovery from OutPoint and public authority configuration, including standard
  signature verification. A live, canonical, sufficiently confirmed CKB node is a trust/access
  assumption. This is not an independent CKB SPV client.
- `src/run.cjs`: isolated real signed funding and recovery, genuine private PoS delivery/finality,
  same P1A security predicates and original four 100-CKB funded intents. Controlled token values
  are test quantities, never USD prices. New explicitly configured private genesis; old baseline
  binaries/authority/evidence remain unchanged.
- `src/audit_authority.py`: independent inventory of P1A's hard-pinned authority.

Record: 8 ASCII `CKBREC01`, uint32LE count (1..64), then sorted unique
`uint32LE output_index || 536-byte canonical terms` entries. No lengths or alternative
encodings. Signature remains WitnessArgs.lock, input_type absent, record in output_type.
A twin-intent record is 1,092 bytes; embedding adds four BytesOpt bytes as well.
Witnesses are excluded from CKB raw transaction hash, avoiding circular OutPoint identity,
but are signed by standard sighash-all and committed in the block witness root.

Recovery command (no original order files):

```
node src/recover.cjs TX_HASH 0x0 fixtures/recovery-config.json http://127.0.0.1:19224
```

The public configuration pins CKB genesis, Ethereum genesis, registry and consumer code.
Actual funding history, its input history and canonical block must remain accessible.
A malicious remote RPC is not made trustworthy by returning self-consistent JSON. Use one's
own validated node or independently authenticated block/witness inclusion and headers.
Maintain immutable archival transaction/block backups and redundant RPCs. Terms are public.
A pruned/unavailable history produces an error, never guessed terms. P1A remains usable with
independently backed-up original terms; the recovery record does not become a settlement oracle.

Offline reproduction after dependencies are present:

```
P1_RUN_NAME=independent-01 bash src/reproduce.sh
```

This starts only a fresh native CKB node and verifies captured genuine PoS data; no Docker,
Ethereum RPC, new delivery or market network access is needed. Use a fresh result label.
A fresh live reproduction requires the pinned Docker images and a separate scratch
copy of this lab. Preserve its archived fixtures/evidence elsewhere, create empty
fixtures/devnet and evidence directories there, run src/native.py, then
`bash devnet/start.sh` and `bash src/start_live.sh`. The producer compiles its new
private checkpoint explicitly. Genesis generation creates ignored disposable secrets.
Do not erase archived fixtures or reuse this checked-in runtime/evidence for a new chain.
Exact historical reproduction uses the offline command above.

See [the decision report](../../docs/E2E_COMMERCIAL_VIABILITY.md) for measured results,
reproduction commands and commercial limitations.
