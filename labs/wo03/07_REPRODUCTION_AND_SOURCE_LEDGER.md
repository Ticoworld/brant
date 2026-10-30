# Reproduction and source ledger

This is an isolated research lab, not production-safe channel software. It tests a precisely defined baseline and two repair controls. It does not test the complete Perun implementation.

## Clean reproduction

Unzip the archive into a new directory. Node v24.22.1 and Python3 were used. No system services, wallets, secrets or real assets are required. The test wallets are public numeric keys1,2,3,4. Isolated EVM chain31338 is in-process and opens no RPC port. Never import real keys.

```bash
npm ci --ignore-scripts
python3 src/model.py
node src/contract-tests.cjs
node src/verify.cjs
python3 src/report.py
```

The runtime pins Ganache7.9.2, ethers6.15.0 and solc0.8.30 in package-lock.json. Solidity optimizer200, Shanghai target and exact compiler identity are saved with full compiler input/output in evidence/compiled.json. Other locked CKB SDK dependencies are inherited from the WO02 environment but not exercised by this EVM lab. The optional Ganache µWS native extension fell back to JavaScript under Node24; no performance result depends on it. The reproduction commands overwrite this lab's generated evidence, so run a copy when preserving the delivery records. No compiler downloads occur during compilation; clean npm installation requires access to its package registry.

Reproduction generates new local timestamps, addresses/contexts as deterministically derived from transaction order, and corresponding hashes. Do not demand byte-identical transaction hashes across different initial chain times. The mathematical result, rejections and consistency assertions should match. All contract state is discarded at process shutdown; raw evidence remains in files.

The Solidity test contracts have no production key management, safe two-sided channel opening, real CKB backend, foreign-consensus verifier, calldata/data-availability guarantee, fee-sponsorship protocol or third-party recovery client. The trusted attestor control intentionally fails the no-mandatory-trusted-operator requirement.

## What the offline verifier checks

It cross-checks103 saved transaction receipts and gas/status values against captured raw RPC responses, verifies16 retained state signatures, checks every declared mixed/consistent allocation, confirms the eager-watch deadline ordering and checks the finite model's counterexamples. Assertions in the live runner also verify actual follower token balance deltas and allocation outcomes. It does not independently replay EVM bytecode from raw block data or audit contract security.

## Evidence map

| File | Content |
| --- | --- |
| contracts/ChannelLab.sol | Independent adjudicators and trusted-attestor follower control |
| contracts/TestDollar.sol | Controlled WO03TEST token, not USDC or USDT |
| src/contract-tests.cjs | Compiler, isolated EVM, fault schedules and assertions |
| src/model.py | Finite transition enumeration and witness generation |
| src/verify.cjs | Offline evidence cross-checks |
| src/report.py | Rebuild numerical reports from retained results |
| evidence/contract-results.json | Named scenarios, signed states, outcomes, gas identities |
| evidence/transactions.json | All103 successful/reverted transaction requests and receipts |
| evidence/rpc.json | Actual captured EVM RPC requests/responses |
| evidence/model-results.json | State counts and counterexample traces |
| evidence/verification.json | Independent offline check summary |
| evidence/baseline-integrity.json | WO01/WO02 checksum verification |
| research/source-metadata.json | Returned Git blob identities for inspected source |

## Primary research ledger

Retrieved 2026-10-30. URLs are primary authors' repositories or sites. Branch URLs may change; the retained source text, returned Git blob SHA and delivery SHA256 manifest pin the inspected content. Confidence labels refer to the narrow supported observation, not complete protocol security.

| Source URL | Narrow supported observation | Confidence |
| --- | --- | --- |
| https://github.com/hyperledger-labs/go-perun/blob/main/client/update.go | Update proposer signs before requesting response; responder verifies proposal, signs and sends acceptance; client enables retained state after the relevant steps | VERIFIED inspected source; no complete protocol audit |
| https://github.com/hyperledger-labs/go-perun/blob/main/channel/multi/adjudicator.go | Multi-ledger register/progress/withdraw dispatches calls to relevant adjudicators | VERIFIED inspected source |
| https://github.com/hyperledger-labs/go-perun/blob/main/channel/multi/subscription.go | Multi-ledger subscription combines backend events | VERIFIED inspected source |
| https://github.com/hyperledger-labs/perun-eth-contracts/blob/main/contracts/Adjudicator.sol | Local dispute records enforce version/refutation timeout and set chain-local outcomes; complete construction has additional paths not executed here | VERIFIED inspected source |
| https://github.com/hyperledger-labs/go-perun | Project lists multi-ledger channels and backend status; implementation has its own security disclaimer | VERIFIED public project claim, not independent audit |
| https://perun.network/perun-x/ | Product page lists Nervos integration in process and mentions TEE-backed settlement | VERIFIED page claim, no executable route or security validation |
| https://eprint.iacr.org/2018/320.pdf | General State Channel Networks research pointer | BLOCKED full PDF fetch403; do not claim the complete proof was read |
| https://eprint.iacr.org/2022/317.pdf | Thora atomic multi-channel-update research pointer | BLOCKED full PDF fetch403; only indexed excerpt inspected |
| https://arxiv.org/abs/2212.07265 | Cross-Channel research pointer | Abstract/indexed summary reviewed; complete construction unreviewed |

The initial search-service raw GitHub fetches failed; authenticated read-only GitHub retrieval subsequently supplied four exact source files. A direct API curl timed out. A guessed client/watcher.go path returned404. These failures are limitations of retrieval, not evidence that protocols or implementations are unavailable. No private account mutation, message, deployment or external-party contact occurred.

## Conclusion labels

VERIFIED: these contract executions, signatures/receipts, checksum checks and inspected source behavior. DERIVED: a sound unique outcome plus exact authenticated projection prevents this particular inconsistent-version release. HYPOTHESIS: a CKB/EVM implementation can provide those proofs with commercially acceptable capital and cost. BLOCKED/UNIMPLEMENTED: complete native adjudication and foreign-finality verifier; executable competitive delivered quotes; production calibration/audit.
