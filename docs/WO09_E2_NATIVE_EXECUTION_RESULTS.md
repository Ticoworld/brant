# E2 native execution results — checkpoint 1

Trace directory: labs/wo09-e2-capacity/evidence/state-free-wallet-swap-1793612217172. It contains raw RPC JSONL, full transactions/receipts, cases, environment/genesis and deployed code hashes.

Two native xUDT issue transactions and one four-input/four-output owner swap committed on the fresh local CKB dev chain. Existing inputs were two secp wallet cells and two issuer-created xUDT cells. Outputs replaced all four one for one; the two parties exchanged 5 CKB and xUDT quantities10000/20000. This is a fixture price, not market evidence.

Missing buyer authorization, altered recipient output and replay of spent inputs rejected. CCC/SDK and raw RPC verifier reports3 committed transactions/3 expected rejection cases. Actual scripts were published dev-genesis xUDT and secp lock; exact outpoints/binaries are in environment.json/events.json. Harness did not record transaction fees (null); VM cycles and serialized byte lengths are included in events.

The result proves one whole-body fully signed complete-fill swap can add zero persistent cells given compatible pre-funded wallets/assets. It says nothing about ordinary order Cells being always unnecessary for resting/partial orders, CoBuild range-signed fragments, entrants without assets, independent claim vaults or concurrent matching.
