# Trade V2 native token-order checkpoint

**Experimental partial integration; browser gate not passed.** This adapts R7's indexed hash-tree, per-leaf revisions, CCC-style secp recovery and revocation to genuine xUDT custody. It replaces R7 financial claims with checked token balances. A paired singleton marker accompanies the custody cell. The candidate authenticates all eight leaf preimages against each root, rejects duplicate owners, preserves owner tombstones, and checks their exact sum equals custody xUDT. This bounded full-record design is not a scalable general Merkle proof system. Every transition consumes and recreates the custody/marker pair. The marker is minted from the unique inventory input at initial purchase. Experimental code, not audited or safe for real funds.

`evidence/native-1794295325247` contains the independently replayed bounded native journey. Alice and Carol signed distinct CCC-compatible `Buyer: any` orders before Dave's unrelated withdrawal changed the custody outpoint and global root. Ben filled Alice's unchanged signature; Alice revoked a separate order; Ben filled Carol's unchanged signature after further root changes. Alice and Carol each received 100 CKB, and Ben and Alice withdrew real external xUDT. Alice then deposited and withdrew again; the old revision-zero order did not revive. Ben's zero-balance tombstone could not be assigned to another funded buyer. The verifier checks original signatures and timing records, before/after roots, marker lineage, full-record sums, live supply, inputs, outputs, fees, occupancy and 16 attributed rejections. It trusts the disposable node for consensus and VM execution. One buyer filled both orders; no generalized multi-buyer or public-network result is implied.

The initial buyer funds one curve purchase that allocates initial balances to Alice, Carol and Dave. **Subsequent curve purchases are deliberately rejected**: without a revised coupled market/custody transition, allowing another initial creation could create competing canonical roots. The native sequence does not demonstrate separate curve purchases by those holders. Repeated market buying and the full requested launch journey are incomplete. Slots are permanent and bounded to eight; exhaustion, arbitrary compositions and broad adversarial behavior remain limitations. A current state witness must be reconstructed after each shared-root change; old settlement transactions consume spent outpoints. Single shared state serializes writes and may contend. Revocation takes effect when its state update commits. No automatic expiry exists. Multi-intent atomic settlement is not implemented; the two fills are sequential.

The browser remains unimplemented. Existing R7 discovery/recovery and UI encode financial claims rather than xUDT rights; they cannot safely be connected by relabeling. A genuine browser journey, external-wallet acceptance, comparable ordinary xUDT workload and measured code deployment transactions are not established. WO17C is the preserved fallback, and WO16 issuer/source-to-binary limitations remain open. No public transactions were made.

## Reproduction

With CKB 0.210.0, Zig 0.14.1 and locked native dependencies installed:

```
bash labs/wo17c-offline/bootstrap-secp.sh
bash labs/trade-v2-token/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/trade-v2-token/run.cjs
node labs/trade-v2-token/verify.cjs labs/trade-v2-token/evidence/native-<timestamp>
```

The fixture private keys are public and private-chain only. Earlier partial/development runs are preserved, not represented as final tests. Some stopped before completing and must not be treated as passing.

For `native-1794295325247`, each committed transaction paid 0.01 CKB. Estimated cycles: issuance 1,714,913; initial purchase 1,863,609; unrelated withdrawal 1,945,561; Alice sale 3,590,268; revocation 1,935,107; Carol sale 3,572,525; Ben withdrawal 1,960,336; Alice withdrawal 1,966,505; deposit 1,948,263; rewithdrawal 1,951,932. Minimum occupied capacity is 282 CKB for the custody xUDT and 298 CKB for its singleton marker (actual allocation 350 CKB each); external xUDT minimum is 142 CKB. Code sizes: market 17,152, custody 47,560, custody marker 13,080, curve marker 13,096, owner 13,312 and xUDT 33,696 bytes. These are private-chain estimates, not a matched ordinary-cell journey, code deployment transaction, or evidence of capital savings.
