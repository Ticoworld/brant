# WO02: native CKB / EVM test-token settlement

**Decision: TECHNICALLY PROMISING, SAFETY UNRESOLVED.**

Read [08_WO02_DECISION.md](08_WO02_DECISION.md) first. This is a real isolated-chain experiment with successful paths, deliberate principal-loss counterexamples and tested client repairs. It is not production-safe swap software or a proven competitive exchange.

The eight numbered reports contain the security model, implementation, successful records, 74-scenario matrix, independent recovery, measured costs, architecture alternatives and founder decision.

The asset is **WO02 Test Dollar**, a controlled ERC20, not USDC/USDT. All private keys are public development fixtures. No real assets/public deployments/outside messages were used. Both chain servers are stopped after each driver run.

## Reproduction

```bash
python3 src/bootstrap.py
make build
make test
make extra
make reinclusion
node src/verify-evidence.cjs
python3 src/cost_ledger.py
python3 src/economics.py
```

Run on a copy to preserve the included evidence. See [02_IMPLEMENTATION_AND_REPRODUCTION.md](02_IMPLEMENTATION_AND_REPRODUCTION.md) for pinned versions, process boundaries, endpoints and limits. The tool binaries and node_modules are intentionally excluded; bootstrap retrieves pinned versions. Compiled contract artifacts and vendored CKB C library are included.

[evidence/verification.json](evidence/verification.json) records the offline balance/signature/transaction consistency check. [evidence/SOURCE_LEDGER.md](evidence/SOURCE_LEDGER.md) documents external records and confidence. Per-case raw results and RPC transcripts remain available. [SHA256SUMS.txt](SHA256SUMS.txt) covers delivered bytes. Historical failed runs are preserved and labeled, not silently treated as successful evidence.
