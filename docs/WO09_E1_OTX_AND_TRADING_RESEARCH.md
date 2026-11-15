# Track C — owner-controlled exchange and financial-right transfer

> **Restriction/status update:** Beneficiary-address settlement liveness remains **UNRESOLVED**. Original consumable-right happy paths and pre-warning observations are preserved, but the proposed correction has no native validation: its replay stopped at a JavaScript syntax error. Compiled/source-only changes are quarantined in `labs/wo09-open-markets/research/blocked-beneficiary-correction`. No security PASS or production readiness is asserted. Further restricted-case validation is paused; independent launch, fixed-risk, OTX and incentive research continues.


The exact ring model has three asset-owner vectors X->Y, Y->Z, Z->X that net to zero only when all legs exist. Removing the third leg leaves a real X/Z imbalance; a residual maker must supply the missing asset and be compensated. A solver or a batch does not manufacture compatible interests, inventory or demand.

Strongest relevant native alternatives remain optimized A2 (actual prior1536 full-fill proof) and CoBuild OTX. The pinned CoBuild library hashes selected input ranges including resolved cell/data, output/data ranges and dependency/header ranges; the demo delegates authentication to ckb-auth. Independent fragments are prior art. Full-transaction normal wallet signatures bind the whole body and require re-signing after edits, so a fully signed three-party swap is not a new OTX implementation.

The plausible customer job is secondary transfer of genuine funded claims, including differing maturity/entitlement classes. The actual right should follow the cell and conserve its backing through a transfer; a wallet display or ticker is insufficient. A fixed-recipient collateral pool is not automatically a transferable risk claim. Mutable beneficiary records, burn/settle coordination, fee reserves and recovery add separate obligations.

A useful baseline native test should create actual funded claim cells with strong wallet locks, perform a full-body multi-owner exchange, reject a missing owner signature/changed payout and show that an uncompleted attempt leaves cells independently redeemable under their original rules. It must state that no CoBuild fragment verifier or arbitrary-history recovery client has been qualified. Compare whole lifecycle and rights, not inherited test counts or a ring PASS.

Asset scope remains explicit: native CKB and genuine xUDT/iCKB work in prior labs; Spore/DOB/RGB++ need their own authorization/settlement integration. The unresolved foreign-finality principal-safety problem is not a proposed external route. This work does not unfreeze WO04.

Decision: retain claim exchange as modular infrastructure; generic new DEX/solver business REVISE or STOP SPECIFIC MECHANISM if its only distinction is ordinary atomic composition. Commercial fees, user asset inventories, compatible owner demand and useful secondary bids remain MARKET UNKNOWN. No claimed superiority over optimized A2 or CoBuild without an equivalent measured workload and stronger rights.

## Native execution and comparison update

Actual normal wallet signatures exchanged funded claims and CKB; a second execution included genuine published-contract xUDT with a separate absent issuer during trade. Missing signatures, stale transaction bodies and unauthorized token inflation have explicit negative fixtures. The first token-conservation fixture erroneously included issuer authority; its accepted estimate and failed test remain preserved. No inflated trade committed. Partial and final independent note redemptions show no need to recover through a solver after a failed assembly.

Consumable risk rights add a separate native secondary sale: new buyer and recorded seller sign, original junior does not, and settlement later pays the buyer without anyone's signature. Two records cost468 CKB at peak but return at settlement. This is a new rights-lifecycle experiment, not an independent OTX fragment-signature implementation. Normal full-body signing still requires re-signing after an edit; no measured equivalence to CoBuild's range authorization is claimed.

Existing A2/compact1536-order measurements remain the strongest local large-batch evidence and are not counted as new WO09 transactions. The new claim/xUDT workload has different scripts/rights, so raw byte/cycle comparisons cannot establish a faster trading engine. Spore/DOB/RGB++ integrations, broad wallet compatibility and foreign-finality routes remain unimplemented/unqualified. Building a generic exchange is stopped as a novelty claim; reusable direct native settlement stays available.
