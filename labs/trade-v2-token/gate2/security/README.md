# Gate 2 security work: inherited Gate 1 targeted fixture

This directory contains one targeted native experiment against the preserved Gate 1 contracts. It does not test the new Gate 2 SMT contracts, and it does not close the full inherited Gate 1 security list.

## Two independent markets and cross-market substitution

Authoritative evidence: `evidence/cross-lineage-1794388569759/`.

The runner created and committed two markets from distinct genesis wallet anchors. Both used the same curve parameters (10 CKB base, 1 CKB step, supply 1,000), while each had its own market script identity, xUDT owner/type identity, market marker, custody lock and custody marker. It then committed valid initialization purchases for both markets and a valid continuation purchase for Market B.

The cross-market attack spends Market B inventory and marker cells but attempts to credit Market A custody. It uses five actual inputs and five outputs, the authorized buyer signs, the curve price is paid, all outputs meet occupied-capacity minima, and the transaction is balanced for a 1,000,000-shannon fee. Native CKB rejected it in the Market identity/asset check at `Inputs[0].Lock`, error 22, script code hash `0xd797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1`. The alternate possible rejection at Market A custody error 20 is also an intended market-domain check; the independent verifier accepts only those two specific script checks and verifies the exact one observed in the recorded fixture.

This improves on the previous single-lineage mutation fixture by using two independently issued market lineages. It does not test competing histories for the same singleton identity or cross-market replay of a previously signed offline order.

## Reserve extraction

The positive Market B continuation is also the control for `market-reserve-one-ckb-extraction`. The attack keeps the same token transition and buyer authorization, diverts exactly 1 CKB from the curve market output to the buyer, preserves total input/output capacity, fee and occupied capacities, and is rejected by the Market lock at `Inputs[0].Lock`, error 28, code hash `0xd797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1`.

This proves one occupied-reserve extraction case. It does not test every CKB capacity boundary or a negative-capacity underflow; Gate 1's broader reserve proof category remains open.

## Native evidence

CKB: `0.210.0 (2592ddf 2026-09-17)`. The runner uses the preserved Gate 1 binary set from the existing Gate 1 worktree, not newly compiled Gate 2 scripts. The Gate 1 binary hashes and toolchain provenance are recorded in `GATE1_RESULT.md`; this fixture's role is an additional native transaction test, not fresh source-to-binary proof.

| Operation | Transaction hash | Estimated cycles | Fee | Serialized bytes |
| --- | --- | ---: | ---: | ---: |
| Fund isolated fixture wallets | `0x7afa53c2ed8a6d0cd0d88cf5cf0922ea0791b4a8f132323c0275fab7b25d6f16` | 1,647,201 | 1,000,000 shannons | 1,197 |
| Issue Market A | `0x74edf1bbdfa22c56419a2ffeadc70f8ffcc1f7e9f6e7b85059053006dc22ea63` | 1,694,665 | 1,000,000 shannons | 1,118 |
| Issue Market B | `0x9a3f81bafc865642d5194cd67f6189ace6d03d13decf562fb3dc5698b836b940` | 1,720,894 | 1,000,000 shannons | 1,118 |
| Initialize Market A custody | `0x728f246caacc9f20a0fdac165230475cf97ed7bcb5252cadcf45d2b2453aec89` | 1,893,083 | 1,000,000 shannons | 2,395 |
| Initialize Market B custody | `0x80a8b3106749ecd4d257d06902ae594e161285f083ade3a25291a73dfb1b8fa8` | 1,870,485 | 1,000,000 shannons | 2,395 |
| Positive Market B continuation | `0xee6d0dbd9498c59d6c720724951236d0052abce1310bb384d7e51081ef524887` | 2,055,936 | 1,000,000 shannons | 3,074 |
| One CKB reserve extraction (rejected) | `0xc1073c492a8a4480f73aa1f2856b46a0a1bbf630f5a0764b23dba7e57bcc9a7c` | Rejected before cycle result | 1,000,000 shannons | 3,074 |
| Cross-market A custody credit from B (rejected) | `0xa71ea9b236de8f56c55f19bcf0bbc0c767b58819be2ee8b8764322f8dfe991f0` | Rejected before cycle result | 1,000,000 shannons | 3,074 |

The exact rejecting source/code and transaction contents are in the two named JSON files under the evidence directory. The independent replay reconstructs all six committed transactions from the recorded genesis block, checks each transaction hash and committed status, resolves each spent input, recomputes occupied capacities and fees, and checks the cross-lineage and reserve attack shapes. The final result is `independent-replay.json`.

## Reproduction

From PowerShell, run the pinned Linux CKB binary through WSL. Set paths to the existing Gate 1 worktree and the Gate 2 worktree:

```powershell
wsl -e bash -lc 'TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native TRADE_GATE1_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/trade-v2-token/build node /mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/trade-v2-token/gate2/security/two-market-cross-lineage.cjs'
```

Then independently replay the resulting evidence directory:

```powershell
wsl -e bash -lc 'TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native node /mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/trade-v2-token/gate2/security/verify-two-market-cross-lineage.cjs /mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/trade-v2-token/gate2/security/evidence/cross-lineage-1794388569759'
```

The final command prints a replay summary and serialized transaction sizes. Failed harness development attempts before the authoritative evidence directory are preserved separately under `evidence/`; they are not Gate 1 or Gate 2 results.

## Still unresolved from Gate 1

The authoritative Gate 1 report remains **PARTIAL**. This work did not close competing singleton histories, maximum-parameter arithmetic boundaries, all reserve-capacity underflow cases, arbitrary custody state replacement intended to revive invalidated signatures, or alternate-valid-transaction replay of external redemption. It also did not test cross-market signed-order replay. No exploit is claimed or inferred from these missing proofs.
