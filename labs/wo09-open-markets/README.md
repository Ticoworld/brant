# WO09 independent private research lab

Starts from preserved rebuilt commit f72cfb4276efe2b180c69821f645168950c99e84; research branch `wo09-open-market-discovery`. Read `docs/WO09_E1_CONTINUATION_STATUS.md`, scoreboard, provenance and property boundaries before interpreting evidence.

## Current boundary

Beneficiary-address settlement liveness is UNRESOLVED. Proposed correction/source/artifacts are quarantined under `research/blocked-beneficiary-correction`; native correction replay did not begin. Do not automatically execute that archived experiment. General authenticated recovery and upstream A2 LO-01 remain separately unresolved. New research is not production code or a commercially proven product.

## Independent reproduction

Use only disposable local private-chain assets. Runners start sequential fresh local nodes on19224/19225; fixture identities are public and must never hold real assets. No public deployment/trades are performed. CKB version0.210.0 archive SHA is checked by inherited bootstrap; npm uses the preserved lockfile; compiler version0.14.1. CKB stdlib exact content is pinned with its preserved MIT license, but its upstream revision remains UNKNOWN. Published iCKB bytes and source pins are checked without asserting independently rebuilt published equivalence.

Current `src/reproduce.py` clones the private GitHub branch at an explicit commit, independently installs dependencies/compiler, checks pins, rebuilds original seven artifacts byte-for-byte, regenerates models and executes only independent claims/hybrid/fixed-risk/snapshot-risk/priced-fixed-risk jobs. It does not run beneficiary experiments. Paths supplied to --destination must not already exist; --output retains logs/report/raw evidence. Optional --ckb-archive-cache accepts only the exact published archive SHA. Same host and optional explicit cache are not a pristine OS.

```
python3 labs/wo09-open-markets/src/reproduce.py --commit <verified-full-SHA> --destination work/wo09-clean --output work/wo09-clean-results
```

Exact models also run independently:

```
python3 labs/wo09-open-markets/models/discovery.py
python3 labs/wo09-open-markets/models/market-scale.py
python3 labs/wo09-open-markets/models/independent-alternatives.py
```

`src/verify.cjs <evidence-directory>` checks raw receipt/hash/serialization/deployment consistency; it is not a security audit. `src/update-index.py` labels failed runs and successful iterations separately. Reproduction repeats are not distinct mechanisms. `src/pin.py` records local content hashes; changing the manifest is not proof of correctness.

Earlier nine-run reproduction is retained at `evidence/fresh-github-reproduction`; it covers revision11c87a6 and does not certify newly proposed corrections. Original traces, mistakes and limitation reports are immutable historical evidence. No frozen WO01–WO08 lab is edited.
