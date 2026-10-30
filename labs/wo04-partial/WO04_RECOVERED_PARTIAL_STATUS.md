# WO04 recovered partial work

Status: INCOMPLETE. This recovery inspected existing files and preserved them. It did not restart nodes, rerun experiments or repair the implementation.

## Completed according to saved execution records

- A security-model document was written before the contracts.
- A genuine native CKB session script compiled, using Ed25519 authorization, state replacement, a relative since exit delay and fixed recipients.
- The saved event log contains 9 committed CKB transactions and 11 successful isolated-EVM transaction receipts.
- The first session retained100 alternating signed updates after its initial state. A separate recovery process registered its retained state and sealed its CKB exit. The coordinator-deletion step was recorded.
- The EVM test token funded actual inventory and executed a separately labeled local-authorized exit. That EVM control does not authenticate CKB finality.
- A second CKB session progressed through three signed versions and sealed the newest submitted version. Stale state changes, an invalid signature and recipient diversion were rejected in the recorded checks. An immature exit was also rejected.
- Five directional signed updates and an over-inventory rejection were recorded. A proposed replenishment state was signed, but the splice transaction did not execute.
- CKB transaction-inclusion proof packages were retrieved and locally checked against the development node. The proposed EVM foreign-proof verifier was not executed.

These records support narrow observed behaviors, not audited security or full cross-chain atomicity.

## Architecture investigated

A fully funded portfolio session with a CKB adjudication anchor, retained signed updates and a follower intended to use authenticated sealed-outcome evidence. Source was also written for a custom Schnorr adaptor experiment, a fixed-checkpoint CKB inclusion-verification spike on EVM, and an optimistic bonded outcome relay. Those three experiment families were not reached before termination.

## Properties supported by completed local tests

The recorded CKB transactions demonstrate native signature validation, local state progression, rejection of the tested stale/invalid changes, enforcement of a not-before exit condition, and a separate-process local exit using retained public recovery information. They do not prove arbitrary-outage recovery, comprehensive signature validation, or a unique outcome across two independent chains.

## Unresolved

Canonical foreign-chain finality authentication; consistency of both chain payouts; obsolete/nonfinal adaptor witness rejection; an end-to-end sound fraud-proof relay; proof-withholding recovery bounds; safe cross-chain replenishment; replenishment withdrawals and conflicts; production costs and maker economics. No trustless cross-chain mechanism or profitable trading business was demonstrated by WO04.

## Why execution stopped

The first CKB splice attempted to import a dependency subpath that the installed package does not export: ERR_PACKAGE_PATH_NOT_EXPORTED. This is a local integration error, not evidence of a cryptographic impossibility. The run ended with an error. No complete.json completion marker exists. The later experiment source must be treated as unexecuted and unvalidated.

## What survived and what may be missing

The original security-model report, contract source, compiled binaries/ABIs, pinned package lock, chain configurations, signed state records, committed transaction bodies, EVM receipts, RPC transcripts, recovery packages, inclusion-proof packages, and failure log survived. This checkpoint adds only a status report, file inventory and checksummed archive. Original WO04 source/results are preserved unchanged.

The other nine requested final WO04 reports and a final decision were not produced. No validated WO04 evidence archive existed before this recovery. No evidence establishes that the stopped chains' live databases will remain accessible; raw saved records are retained. Unsaved in-memory work beyond the captured failure cannot be recovered or asserted.

WO01 and WO03 archives previously passed their recorded CRC checks. The saved WO02 archive was found non-openable, while all3,001 files in its local workspace matched its saved manifest. That prior archive discrepancy is recorded in evidence/baseline-integrity.json. This recovery does not replace or modify prior work.

## Contents

- 01_BASELINE_AND_SECURITY_INVARIANTS.md: original specification.
- contracts/session.c, contracts/Lab.sol, contracts/TestDollar.sol: native and EVM source, including unexecuted experimental components.
- src/: implementation and reproduction source as it stood at failure. The same unresolved dependency import prevents a complete clean run.
- evidence/events.json, cases.json, states.json, failure.json: retained results and terminal failure.
- evidence/recovery/: separate-client packages and transaction intents.
- evidence/*-proof.json: actual native transaction proof packages.
- config/, build/, deps/, research/: environment, compiled output and pinned source dependencies.
- RECOVERY_STATUS.json and RECOVERY_INVENTORY.json: this recovery's status and inventory.
- RECOVERY_SHA256SUMS.txt: content checksums for the packaged files.

The archive excludes linked node_modules and tools directories, which point outside the WO04 tree. Runtime/compiler binaries are not bundled. No new experiment, public deployment, external contact or real-money transaction was performed during recovery.
