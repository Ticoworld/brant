# Gate 2 deployment review

Run from `apps/trade-testnet` with the pinned closure ELF directory:

```powershell
node deploy/v2-review.mjs C:\Users\timot\Desktop\2026\CKB\trade-gate2-rebuild-closure-20261111
```

The read-only review checks each ELF's SHA-256 against `build-manifest-critical-closure-20261111.json`, derives its CKB data hash, and verifies the Pudge genesis and live secp dep group through RPC. It never constructs, signs, or broadcasts a transaction. Output is a deterministic capacity plan conditional on standard secp code-cell locks, with actual code lengths and fixed Gate 2 script/data lengths. The computed 115,233 CKB code-cell capacity and 1,080 CKB minimum singleton capacity exclude curve reserve, initialization/issuance, xUDT dependencies, wallet change, and fees. Actual funding and fees cannot be determined until wallet inputs, lock choices, dependency cells, and fee rate are known.

**BLOCKED:** This review does not establish that the required Gate 2 code or genuine xUDT is deployed on Pudge, produce an approved unsigned transaction, or authorize public deployment. Verify each actual live dependency and its data hash before enabling actions. Any public deployment requires separate owner-wallet approval.
