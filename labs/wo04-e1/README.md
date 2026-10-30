# WO04-E1 authenticated outcomes research

Decision: PARTIAL MECHANISM, CRITICAL PROOF REMAINING.

Read07_E1_DECISION.md first. The missing component is foreign consensus/finality authentication of the execution stateRoot, not execution of the CKB or EVM contracts. No production-safe settlement claim.

The implementation archive and execution-evidence archive merge into the same workspace path. The former includes source, compiler output, reports, dependencies and pinned setup instructions. The latter includes saved raw records and historical measurements. SHA256SUMS.txt covers both when extracted together. Each ZIP also carries an archive-specific manifest.

From a fresh copy on a compatible Linux host:

```bash
python3 src/bootstrap.py
python3 src/build.py
node src/compile.cjs
python3 src/launch.py
node src/verify.cjs
python3 src/costs.py
python3 src/reports.py
```

Use public disposable keys/test assets only. Commands regenerate this E1 workspace's evidence. Do not point them at production nodes or prior workspaces. Prior WO04 is preserved and its splice failure is not a prerequisite.

E1_PROGRESS.md records stages and limitations. evidence/complete.json marks the final bounded run, and evidence/verification.json records offline evidence checks. No complete consensus verifier is included. The local EVM server is deliberately stopped at the end of the source-outage test.
