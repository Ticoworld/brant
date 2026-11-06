# UTXO Global message check

VERIFIED: on 2026-11-06 the user connected UTXO Global on nervos_testnet and approved the displayed R7 test message. The page recovered the supplied standard-lock identity using CCC. The private CKB-VM checker accepted the returned signature and committed test-cell transaction 0xeadf567739490a3dcc699084e6a3fa2dbeb66bede5d4f50afbbf371e35fe7011. Changing the signed price was rejected with R7 error 85. Evidence: ../../wo09-e2-capacity/evidence/r7-message-check-1793981141823.

The wallet popup showed readable message text in a scrollable region. Only its visible portion was observed in the supplied screenshot. This check invokes the actual R7 signature routine and lock-identity validation in a test cell; the named position was not owned by the wallet and no vault sale occurred. The test uses a stopped private-chain identity and does not prove private-network support by the extension or a buyer transaction. No public transaction was submitted.
