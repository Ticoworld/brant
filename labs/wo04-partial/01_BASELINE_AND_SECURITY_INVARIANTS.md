# WO04 baseline and preimplementation security specification

This specification precedes WO04 exchange contracts. Test assets and disposable keys only. Preserve WO01–WO03. WO01 and WO03 archives pass ZIP CRC; the Library WO02 archive is truncated/non-openable, while all3,001 original local workspace files match its saved manifest. Record that discrepancy, do not claim its archive passed. Read prior decisions and WO03's six requested reports before relying on their conclusions.

## Invariant

For one session and collateral epoch, CKB and EVM must pay projections of the same uniquely authorized, canonically finalized portfolio, or a specified conservative recovery that cannot add unauthorized principal loss. Authorization is not finalization. A valid signed proposal is not a revocation of older certificates. Off-chain allocation is not external wallet delivery.

Participants Alice/Bob have distinct normal CKB secp wallets, distinct Ed25519 session keys, and distinct EVM keys. Coordinator has no recovery authority. A public package contains funded identities and retained authorized states; a separate recovery process needs no coordinator database/key. Test keys are public fixtures.

State encoding is112 bytes: context32, epoch LE64, version LE64, CKB principal total LE64, token total LE64, Alice CKB LE64, Alice token LE64, foreign-domain commitment32. Bob receives residual totals. Context binds CKB genesis, unique session identity, both CKB recipient locks/session keys and external chain/vault/token/participant identities through client construction. The CKB script enforces exact context/foreign commitment equality, signatures and local amounts; it does not reconstruct or verify foreign consensus. Both parties must inspect binding data before signing. Two Ed25519 signatures authorize CKB state; companion EVM signatures bind the same state digest. No claim that signature-scheme conversion authenticates remote finality.

## Native transitions to implement

OPEN -> DISPUTING(v) using both retained signatures. DISPUTING(v) -> DISPUTING(v'>v) with same epoch/totals and fresh signatures. DISPUTING -> SEALED/PAYOUT after relative block-number since5 on that dispute cell. Newer challenges reset the cell and its relative maturity. No hard claim-expiry or arbitrary current timestamp is assumed. Challenge can still compete with seal after maturity; canonical winning transaction determines the local outcome. No automatic highest-version consensus guarantee after monitoring budget expires.

OPEN -> OPEN(epoch+1,new totals) through a two-party signed actual splice consuming the old session input and a contributor wallet cell. OPEN -> OPEN(epoch+1,reduced total) plus fixed-beneficiary withdrawal is separately authorized. Old outpoint becomes spent. Replenishment is not a cross-chain atomic splice merely because both local operations succeed. New exposure must remain disabled until both chain funding obligations are authenticated; disappearance between them is an explicit recovery test/limit.

CKB principal conservation: input session capacity equals CKBtotal+feeReserve+200CKB marker reserve. Register/challenge/splice/withdraw charge100,000shannons against fee reserve. Seal pays Alice x plus remaining fee reserve minus100,000; Bob total−x; marker200CKB carries the sealed112-byte state. Both native recipient outputs use fixed locks; marker uses Alice's fixed lock. Shape restrictions prevent one output satisfying multiple sessions. Reject script/data lengths, totals, recipient diversion, extra outputs, group aliases and overflow. This lab requires allocation outputs large enough to meet occupied-capacity limits. Fee reserves are finite; no universal inclusion guarantee.

## Adaptor experiment

Use a precisely specified research Schnorr adaptor over secp256k1, prime subgroup order n and generator G. With signer x,P=xG, nonce k, adaptor secret t,T=tG, set R'=kG+T, e=H(domain,R',P,message) mod n, sHat=k+ex mod n. Verify sHatG=R'−T+eP; complete s=sHat+t; verify sG=R'+eP; extract t=s−sHat. Independent nonce and secret per session/state. This is a custom research scheme, not claimed BIP340 wire-compatible or audited. Validate points/scalars. Fully bind state/session/recipient/chain identities in message.

Required condition: a follower must reject old/noncanonical/nonfinal state witnesses, not merely verify the extraction equation. Secret holders know t before adjudication. A valid completed signature can be disclosed without inclusion or survive a later reorg. Test that fact and proposed anchor gating. Repair may require authenticated canonical winning-state evidence, not another secret.

## Foreign proof and optimistic relay boundary

Implement a real CKB transaction-inclusion verification spike against an explicitly pinned real devnet checkpoint, including actual raw transaction, exact source input, sealed state, recipients and amounts. A checkpoint supplied at deployment is a trust/bootstrap assumption, NOT a CKB consensus verifier. Dummy PoW cannot demonstrate greatest-work security. Do not call the combined construction cryptographically trustless. Measure real EVM gas and native CKB cycles.

An optimistic proposal must be challenged using a real executable contradictory winning-outcome proof, not an operator signature. The bounded checkpoint fixture can provide that objective fact; its authentication remains the missing dynamic-finality component. If no challenger submits it before cutoff, a false proposal may pay. Report this as an assumption-bound optimistic design, not unconditional principal safety. A bond must cover economic exposure and costs in a spendable denomination; a toy gas-coin bond does not establish production insurance.

## Safety/liveness assumptions

Assume unbroken signing/hash schemes, correct local execution and uncompromised keys. For native CKB local exit, require retained signed state, validating-node access, funded fees, bounded monitoring/inclusion and no reorg deeper than the declared risk threshold. Local experiment uses two descendant blocks only as a parameter, not probabilistic finality. For cross-chain consistency, additionally require sound canonical outcome authentication. Its absence is a critical unproved guarantee, even if an inclusion spike passes.

Proof availability: anyone retaining public package and source data should be able to reconstruct/relay; source access failure may delay liveness. Fee-funded liveness is separate from custody. Unlimited censorship, arbitrary chain stalls, lost all state data and deep reorgs are not covered. A follower timeout refund cannot contradict a still-possible authenticated anchor payout. If no safe refund is implemented, report the remaining lock risk and test replacement recovery after finite delays.
