# E1: external terminal outcomes governing native CKB

Preimplementation specification, 2026-10-30. Isolated test chains only. Original WO04 source/evidence are unchanged. Its recovered archive passes CRC and all233 manifest entries match. The splice failure is not repaired or rerun.

## Candidate A: execution-proof checkpoint, with an explicit missing consensus boundary

The EVM contract records one irreversible chain-local outcome per exact trade: OPEN -> FILLED only after a successful exact token transfer to the fixed recipient; OPEN -> EXPIRED_UNFILLED only after expiry. Neither terminal state can transition again. Fill requires the fixed maker, token, recipient and amount. A failed/reverted transfer leaves OPEN. No independent CKB timeout refund exists.

A terminal leaf is SHA256(domain32 || tradeId32 || termsHash32 || status1), where status2 is FILLED and3 is EXPIRED_UNFILLED. TermsHash commits to EVM chain/contract/token/maker/recipient, token amount/deadline, source genesis, CKB principal and both CKB recipient-lock hashes. Alice signs the CKB funding transaction binding those terms and Bob authorizes delivery through his separate EVM wallet. All amounts are integer chain-local units; the controlled token E1TEST is not USDC/USDT.

A genuine EIP-1186 account proof authenticates the settlement account's storageRoot and exact codeHash against an EVM execution stateRoot. A storage proof authenticates either a terminal leaf or a batch-root slot. A CKB-VM verifier must check RLP lengths, trie path, node hashes, contract code identity, storage key and exact value, not an unverified event.

A bootstrap cell holds execution stateRoot, EVM block number/hash and source domain. Its identity is a unique CKB TYPE_ID. In the bounded experiment the root is selected from the locally controlled EVM node and the cell is made unspendable. THIS IS A TRUSTED CHECKPOINT BOOTSTRAP, NOT AN ETHEREUM CONSENSUS VERIFIER. Ganache has no Ethereum beacon finality certificate. Full end-to-end canonical finality remains unproved even if the execution proofs pass. The controller could initially select a false or noncanonical root. Immutability prevents replacement, not initial dishonesty.

A checkpoint type script verifies account/storage proof once against that bootstrap and publishes the authenticated batch root. Its arguments bind bootstrap TYPE_ID, settlement contract/codeHash, batch storage slot and domain. It rejects consuming the checkpoint. Duplicate copies with identical verified meaning are permitted so any funded participant can publish one without a designated publisher key. A settlement lock finds a live cell_dep with that exact type hash and verifies its own SHA256 membership path. Settlement cells are separately funded and never consume the checkpoint.

The direct recovery path verifies the EVM account/storage proof of the individual terminal leaf against the same bootstrap without a batch checkpoint. It still needs an authenticated bootstrap, independent source data, progress and fees. It is not a way around missing foreign consensus verification.

## Candidate B: optimistic bonded outcome authentication

An optimistic proposal could defer execution-proof checking until a dispute. A valid fraud proof must authenticate the contradictory canonical terminal outcome, so it still needs a trustworthy foreign root or a complete interactive consensus/fork-choice dispute. A bond alone does not determine truth. If no eligible challenger responds before the window, false data may pay; sufficient economically denominated collateral, data availability, censorship/inclusion bounds and honest monitoring are additional assumptions. E1 preserves this alternative without calling it equivalent to Candidate A's execution proof. No generic attestor signature is used as a canonical-finality substitute.

Candidate A is selected for the bounded implementation because it exposes the exact missing consensus interface and allows actual CKB-VM measurement of proof checking and shared consumption.

## Native authorization and value conservation

Each CKB settlement lock binds checkpoint type hash, bootstrap type hash, settlement EVM address/code hash, domain, trade id, terms hash, CKB maker/refund lock hashes, exact principal and close-fee reserve. One settlement input and one beneficiary output are permitted. FILLED pays Bob; EXPIRED_UNFILLED pays Alice. The input equals principal+fee reserve and the output principal. Every lock group must reject another trade's proof or allocation. Reusing a valid proof after consumption fails the UTXO rule. No multi-input aggregation is claimed.

## Bounds and forbidden conclusions

Safety relative to a root assumes correct source contract/code, sound hashes/trie verification, correct initial checkpoint authentication and no reorganizations beyond the selected finality assumption. E1 validates parts of this chain, not all of it. Two descendant dev blocks are an experimental observation threshold, not economic finality.

Liveness additionally needs source data, validating access, CKB and EVM progress, fee reserves and proof construction. When the external chain is unavailable, no safe local timeout can fabricate EXPIRED_UNFILLED after a possible fill; funds remain reserved. Permanent outage remains an unresolved lock risk. Publication and consumption fees/capacity are separate. Immutable checkpoint retention costs capital and storage.

Off-chain responsiveness, cheap membership proofs, operator independence after bootstrap and real token transfers do not establish a production-safe bridge, sub-second native delivery or a profitable business.

## Implementation refinement, verified before final assessment

Each trade now also commits to a unique reservation TYPE hash. The first measurement used CKB's built-in TYPE_ID, which charges1,000,000 cycles in v0.210.0. A small custom generative identity script replaced that reservation type in the final run: it allows at most one group input/output, derives creation identity from the first funding input and output index, and permits burning on settlement. The settlement lock checks the exact input type hash and the EVM terms include it. Tests rejected recreating a spent creation identity and duplicate group outputs. This is a research implementation of the relevant uniqueness rules, not a formal equivalence proof or an audit. The bootstrap still uses the built-in TYPE_ID. The earlier run and sources are preserved in historical/.
