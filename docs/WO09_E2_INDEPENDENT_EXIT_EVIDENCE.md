# Independent exit evidence

## Demonstrated

The completed wallet swap leaves each participant's new xUDT and native CKB in normal owner-controlled replacement Cells. No exchange order or balance Cell is created. A missing buyer signature and a changed signed receipt fail; replaying consumed inputs is rejected. Evidence is in state-free-wallet-swap-1793612217172.

This is a signed complete-fill spot exchange. It is not a pooled liability, small standalone withdrawal, data-availability proof, or lost-operator recovery mechanism. The assets were locally issued fixture xUDT and CKB on an isolated dev chain.

## Not demonstrated

Merkle/CoTA proof reconstruction, root updates, bitmap exits, operator/database loss, owner proof without private indexer, 16+ concurrent exits, same-root retries, reorgs, ACP or a missing-cell entrant were not executed. Perun/Fiber/Myelin exit procedures were source-reviewed only. General authenticated owner recovery and A2 LO-01 remain unresolved. E1 beneficiary-specific validation remains quarantined and was not resumed.

## Required next proof

Select an existing pooled-claim system (Liquid Cells is the primary comparator), pin the exact scripts and client version, then independently replay deposit, two concurrent exits, operator data loss, final exit, duplicate spend and reconstruction from authenticated on-chain data. Do not claim an exit property from a root or README alone.
