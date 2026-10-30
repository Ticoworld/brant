# Successful trade evidence

Two independent exchange directions executed with real local contracts. The nominal exchange was exactly 100,000 native test-chain CKB for 100 WO02TEST tokens. This arbitrary fixture rate is not a live quote. All balance changes below are chain records, not a coordinator ledger. CKB funder pays 0.001 CKB funding fee plus 0.001 CKB close reserve, total 0.002 CKB; principal recipients receive the full authorized principal.

## Primary network identities

CKB genesis: `0x5f5a5c0bad58d6497eaec896fdf5b287ccd78df16ac62bbd1e8de1c889210718`.
CKB escrow code hash: `0xfa7abfee158c24bb9af074154db93a5917c190263a72268304e851c18ff78bd9`, hash type data1.
EVM chain ID: 31337.
Test token: `0xF2E246BB76DF876Cef8b38ae84130F4F55De395b`.
EVM escrow: `0x2946259E0334f33A064106302415aD3391BeD384`.
Alice EVM: `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`.
Bob EVM: `0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF`.
Watcher gas wallet: `0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69`.

Alice's CKB wallet uses the standard genesis secp type hash with args `0x75178f34549c5fe9cd1a0c57aebd01e7ddf9249e`. Bob uses args `0xa3c778981c19e1dcc611fb2132dcdaac075a5064`. Complete scripts and CKB addresses as lock identities are in config/primary-environment.json. Extra tests use a separate genesis recorded in extra-environment.json; they are never silently merged into the primary chain.

## Direction A: CKB to test ERC20

Trade ID `0xe3c44729e76e07592239adbf65db0b2901eb09764a0563d0acfd8714d38e9a3a`. Signed terms digest `0xe735470e6807ba2110c64fc9ebd0a65d693cab3c047dc888962dcdd1ea6b64ba`. CKB funder/secret holder alice; token funder bob. CKB refund eligibility H=47; EVM claim cutoff T=1793329785. CKB starts first in both directions. These fixture deadlines are not production recommendations.

| Participant | Initial native CKB | Final native CKB | Initial test tokens | Final test tokens |
|---|---:|---:|---:|---:|
| alice | 100000000.00000000 | 99899999.99800000 | 1000000.000000 | 1000100.000000 |
| bob | 100000000.00000000 | 100100000.00000000 | 1000000.000000 | 999900.000000 |

| Stage | Transaction identity |
|---|---|
| CKB funding | `0x0fcb8e22ef4303de9bee0346c8ef47570c7cb973b66c608aad048901f6393f7c` |
| Test-token approval | `0xe9ed9f58277c510cb1be35e41ce23374045b2b77db6340415228f2be7741e6ba` |
| EVM funding | `0x74eab334adbd50e421a4749248d441299c7667551046827278e06d5916fff548` |
| EVM claim and public secret | `0x1467de981c2deed1abb635dd3a5b508e9e759f1a9accdeed65d6f916d13fe003` |
| CKB claim | `0x3ae57b91f403ffb0dd02b6d125236da04696456c99943df1eda2d79c560ac4f0` |

The funding transaction is signed by alice's CKB wallet. The token approval/funding are signed by bob's EVM wallet. Both quote signatures are in `signatures` in the package; they are Ethereum personal-message signatures over the SHA256 canonical terms digest. Fixed-beneficiary claims are permissionless. Both EVM transfers have receipt status 1; CKB funding/claim have committed transaction bodies in the captured RPC transcripts. The recovery client fetched the secret from the EVM Claimed event for the source claim. Final escrow state is spent/claimed, and the coordinator database had been removed before the source claim.

Evidence directory: `evidence/runs_1793329663335/001_happy_A`. Full integer balances, raw receipts, event logs, raw signed CKB funding and signed EVM requests are retained there and under `evidence/rpc/`. Host elapsed 2581 ms includes manual mining and subprocess execution; it is not public-network latency.
## Direction B: test ERC20 to CKB

Trade ID `0xed492cf2bae38465a504437d11b5460ed1101bfb8cc675e5abc6ae0f93343714`. Signed terms digest `0xb38523a43179cb811c76bf8e1de963a67e3e2ecd64879572384cf130faed72ea`. CKB funder/secret holder bob; token funder alice. CKB refund eligibility H=57; EVM claim cutoff T=1793329789. CKB starts first in both directions. These fixture deadlines are not production recommendations.

| Participant | Initial native CKB | Final native CKB | Initial test tokens | Final test tokens |
|---|---:|---:|---:|---:|
| alice | 99899999.99800000 | 99999999.99800000 | 1000100.000000 | 1000000.000000 |
| bob | 100100000.00000000 | 99999999.99800000 | 999900.000000 | 1000000.000000 |

| Stage | Transaction identity |
|---|---|
| CKB funding | `0xcd29427f863a4687a68c36cd9576d1233a11bbb946b6cfc998776190fb5d6b45` |
| Test-token approval | `0x48976b30340c1d8f9769d24ec4111b926e24b61becfc26a9cab8f31398b771ed` |
| EVM funding | `0x20942cf95bfae6dae23d871d692a5926428abaffd4bee811e394162eacbc1074` |
| EVM claim and public secret | `0xdb5393c852164c086c4bf7d9a05793d818a2f58872de44ed1798c4d3e06e7624` |
| CKB claim | `0x0093c84bcfccf805912d0db7622ccf7884bea722e4da1672b241f067a00c2b70` |

The funding transaction is signed by bob's CKB wallet. The token approval/funding are signed by alice's EVM wallet. Both quote signatures are in `signatures` in the package; they are Ethereum personal-message signatures over the SHA256 canonical terms digest. Fixed-beneficiary claims are permissionless. Both EVM transfers have receipt status 1; CKB funding/claim have committed transaction bodies in the captured RPC transcripts. The recovery client fetched the secret from the EVM Claimed event for the source claim. Final escrow state is spent/claimed, and the coordinator database had been removed before the source claim.

Evidence directory: `evidence/runs_1793329663335/002_happy_B`. Full integer balances, raw receipts, event logs, raw signed CKB funding and signed EVM requests are retained there and under `evidence/rpc/`. Host elapsed 2542 ms includes manual mining and subprocess execution; it is not public-network latency.

## Confirmation and cost evidence

The driver waits for CKB funding commitment and two descendant blocks before funding the EVM escrow. It then waits for one descendant EVM block after funding. The recovery client's disclosure path independently checks these depths and both chain/escrow identities. These thresholds are experiment parameters, not proof that two CKB descendants or one EVM descendant is production risk-finality.

Gas and cycles are in evidence/economics.json. Raw CKB committed bodies include the recipient lock and exact output amount. EVM funding/claim receipts include Transfer/Funded/Claimed logs. Contract events disclose a preimage only on success, but raw calldata also exposes it on a reverted claim, as the adversarial cases demonstrate.

The offline verifier checks both successful principal deltas, exact CKB transaction hashes, quote signatures, committed payout recipients, and preserved principal-loss/refund cases. It is an evidence-consistency check, not an audit or a foreign-chain proof verifier.
