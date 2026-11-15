# Isolated R7 message verification

This private-chain experiment invokes the unchanged R7 `trade_ccc_verify` routine and applies its standard-lock hash check in a separate test lock. It checks a signature and its claimed terms only. It does not establish that the named vault, position or entitlement exists, and is not a settlement or production deployment.

Build with `bash labs/wo15-merkle-intent/r7-message-check/build.sh` after the R6 pinned build prerequisites. Run `node labs/wo15-merkle-intent/r7-message-check/test.cjs` on WSL with the existing disposable CKB tooling and port 19224 free. The check starts a new private node; it refuses an already occupied port and checks `ckb_dev`. The committed fixture test uses a public disposable key. The supplied terms and recoverable signature can also be sent as JSON on stdin to `run.cjs` as `{terms,signature}`; the final stdout line is a JSON result. Logs precede that line. Each invocation writes its own evidence under `labs/wo09-e2-capacity/evidence/r7-message-check-*`.

VERIFIED: a genuine CCC software signature was accepted by a committed test-cell spend, and the same signature with modified price was rejected by the test script with error 85. This does not qualify a UTXO Global signature. No public transaction was sent.

The test lock uses the R7 C source and official helper as included code, but it is a distinct binary and environment. A signature accepted here is not a committed R7 vault sale. The seller lock derivation is reproduced from R7's 73-byte Molecule script check. The check should be independently reviewed before interpreting a result as wallet compatibility.
