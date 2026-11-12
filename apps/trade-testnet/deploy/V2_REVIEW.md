# Gate 2 deployment review

Run from `apps/trade-testnet` with the pinned closure ELF directory:

```powershell
node deploy/v2-review.mjs C:\Users\timot\Desktop\2026\CKB\trade-gate2-rebuild-closure-20261111
```

The read-only review checks each ELF's SHA-256 against `build-manifest-critical-closure-20261111.json`, derives its CKB data hash, and verifies the Pudge genesis and live secp dep group through RPC. It never constructs, signs, or broadcasts a transaction. Output is a deterministic capacity plan conditional on standard secp code-cell locks, with actual code lengths and fixed Gate 2 script/data lengths. The computed 115,233 CKB code-cell capacity and 1,080 CKB minimum singleton capacity exclude curve reserve, initialization/issuance, xUDT dependencies, wallet change, and fees. Actual funding and fees cannot be determined until wallet inputs, lock choices, dependency cells, and fee rate are known.

The official Pudge xUDT at `0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f:0x0` was checked live. Its data hash `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95` matches the native Gate 2 xUDT fixture. The [Nervos xUDT RFC](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md) identifies this cell as the `data1` code dependency. This establishes a matching binary identity; a Pudge execution remains unverified.

`/v2/deploy` can prepare an unsigned code deployment review when `ROVEKO_GATE2_BINARIES` points to the pinned ELF directory. It verifies all SHA-256 and data hashes, the Pudge genesis and secp dep group, discovers standard-secp cells and rechecks them through the node, and calculates an unsigned transaction with a signature placeholder. The review assumes all five custom code cells must be deployed because no exhaustive data-hash discovery has been established. Indexer omissions can understate wallet funds. No signing or broadcast is implemented in this screen, and any wallet-modified transaction size would require a fresh fee review.

**BLOCKED:** Initialization, code reuse discovery, wallet approval, confirmed deployment and exact total capital requirements including reserve are not established. Any public deployment requires separate owner-wallet approval.

Experimental unsigned initialization helpers in `lib/v2-engine/initialization.ts` derive the anchor-bound scripts and construct setup, issuance and initial-purchase layouts. The identity and the latter two raw transaction hashes match the preserved private-node fixture; negative tests cover reserved anchor, supply and price mismatches. They are not connected to the screen. They do not authenticate live inputs, deployed dependency cells, transaction fee rates, or the submitted SMT proof/root; these checks and fresh browser-to-VM tests are required before wallet approval. The setup transaction, issuance, and first purchase are distinct state transitions and require separate wallet reviews and confirmations.
