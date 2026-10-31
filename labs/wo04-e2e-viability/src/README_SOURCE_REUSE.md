P1A source reuse: contracts/settlement.c, proof.h and OutcomesV3.sol are exact byte
copies at baseline7771, deliberately unmodified. devnet extractor/configuration/build
and run harness derive from labs/wo04-e2/compact-intents. New changes are record
encoding, pre-sign insertion, independent recovery, actual RPC/signature checks,
recovery-negative tests, new isolated network names and paths. No new settlement
architecture or generalized BLS verifier. Devnet generated publisher constant and
bootstrap/time/genesis parameters differ explicitly for this new private chain.
