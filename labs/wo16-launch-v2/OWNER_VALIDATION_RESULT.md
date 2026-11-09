# WO16 isolated xUDT owner-validation control

**Bounded result:** both xUDT enhanced-owner witness paths work with a separate test-only dynamic library, on private CKB 0.210.0. This does not turn the Trade issuer into such a library, prove its execution via witness, freeze the curve candidate, or authorize real assets. Original two-market evidence and its 26 non-witness rejection cases remain intact. Those cases are qualified only for the recorded rejection, script and code, not broader invariants. The two Trade witness-owner cases remain **unqualified as evidence that the Trade owner loaded or enforced authorization**: xUDT reports only its fallback amount failure.

## Reproduce

Install the pinned tools as described in `GATE_RESULT.md`. From the repository root:

```
bash labs/wo16-launch-v2/owner-control/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo16-launch-v2/owner-control/run.cjs
node labs/wo16-launch-v2/owner-control/verify.cjs labs/wo16-launch-v2/evidence/owner-control-<timestamp>
bash labs/wo16-launch-v2/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo16-launch-v2/run_two_market.cjs
node labs/wo16-launch-v2/verify_two_market.cjs labs/wo16-launch-v2/evidence/two-market-<timestamp>
```

Build uses Zig 0.14.1. The final control library SHA-256 `da8321097f522b9f7f241f5b10aaf723f5e403875a7ebb637205924acfce1ed2` was reproduced by a second build. The actual code bytes are preserved inside the genesis RPC record, and the fixture verifier hashes them against the owner code hash. It is an ELF shared object exporting `validate`, page-aligned by `owner-control/link.ld`; the library intentionally recognizes the public literal `PASS` and is **not an authentication scheme**. Its one-byte script args and distinct code hash give it a separate owner and xUDT type from both Trade markets. The real issuer source and its authority were not changed.

## Evidence and interpretation

Final run `evidence/owner-control-1794257125726`: the output-only xUDT group committed a 0-to-1 mint at `0xf1f10132baaff67ea63311b0864c844f73ac3fa31b11a4b236389dd7bb7f2ce6`, and its successor input-group transaction committed a 1-to-2 mint at `0xa2c61756610b2498a5831f2ca5d58253c6bab70aa2d11154aa83396aed8f3b49`. Both violate normal input/output amount conservation, so their acceptance requires owner mode. The fixture has no matching owner input lock and no extra xUDT flags. The xUDT reference obtains owner mode via the witness, checks its Script hash, dynamically loads the exact code hash, looks up `validate` and accepts only a zero result. The `validate` function checks its arguments and the `PASS` witness. A paired same-raw-transaction case changes this signed witness to `FAIL` and returns xUDT `-52`; this differential and the source establish execution of the fixture function in the successful control, subject to trust in the private node and source/binary correspondence. The function's internal nonzero code 32 is **not visible**: xUDT discards it before returning `ERROR_AMOUNT` (-52).

For each input and output path, missing the library also returns xUDT -52, while the malformed one-byte payload returns xUDT error 7. These distinct experiments demonstrate why -52 alone cannot identify authorization failure, successful parsing or library execution. The normal signing witness differs when `PASS` changes to `FAIL` because the signature commits to the extra witness. The verifier checks the raw transaction hashes, paths, type identity, linkage, committed status, code hash in the genesis record and exact error source/code; it does not replay consensus or independently execute the VM. The control tests only these two group placements and this code layout, not every witness shape, script hash type or adversarial execution.

`owner-control-1794256999564` is a failed experiment: an initial ELF layout led to a VM invalid instruction. `owner-control-1794257047704` is an incomplete experiment that stopped on malformed-witness error 7 where the harness had incorrectly expected -52. `owner-control-1794257056984` is a successful earlier control; the final run above uses the documented reproducible build. None of the partial runs is counted as a pass.

Fresh Trade suite `evidence/two-market-1794257085665` independently rechecks recorded committed transactions and 30 rejection results. The test cases for owner-lock remint still reject with owner lock error 4; overissuance with owner lock rejects with error 7. Both Trade witness-owner remints reject at xUDT output type with -52, and the verifier now inspects their serialized owner Scripts in the output witness. The correct schema and a working isolated control establish the tested witness construction, but the Trade candidate is a stripped ELF executable exposing `main`, not the dynamically loadable `validate` interface. Its witness rejection does not prove its owner was executed or that a specific dynamic check rejected it. No positive Trade owner-witness authorization is claimed. The earlier conservation and adversarial coverage limitations in `GATE_RESULT.md` remain open.
