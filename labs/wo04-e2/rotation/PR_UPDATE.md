WO04-E2B now executes the exact seven historical Capella updates through native CKB trust-state transitions, with no host-selected committee replacement after the fixed bootstrap.

- Unique custom state type enforces exact Type-ID nonce construction, one continuation, capacity and permissionless-lock preservation, version/finality monotonicity and replay protection.
- The real sequence 511,512,511,510,512,512,512 advances versions 1–7 and periods 862–867, ending at finalized beacon slot 7109344.
- Authenticated updates verify signatures, both execution branches, finality and next-committee commitments. Full-data committee certification is separate and bound to the live state's lineage/version/period/commitment.
- One immutable program authenticates state/certificate/root roles; arbitrary caller-defined registries and permissionless-role impersonation cannot certify or publish.
- Finality advances require the authorized immutable E1-format root in the same transaction. Six roots were published. Failed/uncertified transitions cannot publish unrelated outcomes.
- Actual node cost: 60,758,561–65,902,659 cycles per update; certification 17,424,399–17,424,407; all relevant scripts included under the unchanged 70-million policy. Latest run: 24 committed transactions and 113 expected node rejections, with a real node restart/recovery after update 0.
- The official Electra SSZ header/config/proof reference tests passed. Runtime later forks and >2 missing signers remain unsupported/fail closed.

This is a complete bounded historical Capella trust chain under an explicit historical checkpoint, not live/current Ethereum production readiness or an E1 principal payout. Matching Ethereum-history Outcome/storage proofs, final application authority wiring, fresh checkpoint acquisition, modern forks, confirmation/lifecycle/economic policy and review remain necessary.

Source, raw transactions, metrics and reproduction commands: labs/wo04-e2/rotation/README.md. Full journal: docs/E2_FINALITY_PROGRESS.md. Earlier E2A/E2B checkpoints and historical labs are preserved. No merge.
