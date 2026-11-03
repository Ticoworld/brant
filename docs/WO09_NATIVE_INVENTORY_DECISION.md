# WO09 native inventory decision — 2026-11-03

## STOP this particular opportunity; preserve the settlement stack

**Technical:** public mainnet pool/book discovery and exact SDK quote simulation are verified within scope. Existing native settlement capabilities remain preserved. No new exchange, pool optimization, adapter, trade or funding was implemented/performed.

**Commercial:** a profitable differentiated Trade CKB/iCKB inventory service is **not established**. Do not implement the proposed A2 adapter or deploy a competing maker on this evidence. The RUSD alternative is also **STOP pending independently usable current market data**, not a claim the token or every venue ceased to exist.

This is an evidence gate, not rejection of native CKB trading in general. A snapshot with no outstanding orders neither proves future demand nor proves no demand exists. It does mean no executable current two-sided offer or replenishment arbitrage has been demonstrated to justify the next mechanism.

## What changed

The new [CCC iCKB release](https://talk.nervos.org/t/ickb-is-now-fully-on-ccc-new-dapp-sdk-and-bot/11092) materially improves the existing competitor. Trade's earlier failure to obtain native quotes was incomplete investigation. We ran the actual published SDK's mainnet read and its unfiltered Stack order scan, verified deployed code identities and retained dated raw RPC evidence. Two public endpoint hostnames agreed on eighteen fulfilled groups, no remaining matchable inventory, twenty-four pool deposits and no currently wallet-ready withdrawal deposits.

Do not count tokens in fulfilled orders or CKB locked in pool deposits as free current maker inventory. No actual standing bid/ask could fill20/50/100dollar-equivalent orders at the observed times. The available0.01% outputs and ten-minute dates are SDK **new-order simulations** with bot-capital assumptions. No signing/trading/funding was authorized or performed.

A second native asset was investigated independently: the RUSD code dependency documented by UTXOSwap was live and its token script/native Cells were read. Its current UTXOSwap pool/config data returned403; venue reserves and actual executable price were unavailable. Restricted app/page access was respected. Neither a similarly named off-chain asset nor testnet liquidity fills that evidence gap. Native asset existence and historical market support are verified; current market execution is not.

## Customer and maker offer comparison

Specific intended users would be existing iCKB holders who need CKB before a DAO claim date, CKB buyers wanting immediate iCKB delivery, and inventory providers willing to fund that wait. The current DApp/bot/A2 already targets that job. A maker must provide actual CKB and exact native iCKB, collect receipts/withdrawals, maintain quote inventory and earn sufficient premium. No trader's willingness to pay an urgency premium, current paid order flow, external maker quote or counterparty commitment was obtained.

The default1bp fee gives only$0.002/$0.005/$0.01 gross for$20/$50/$100. Under a modeled5.62day replenishment period even2% annual net funding cost exceeds that revenue before other costs; opposite flow or lower funding cost can change the result but is not observed. Model results do not claim the upstream bot is unprofitable. Its source already addresses inventory bands, maturity-ring coverage and fee-aware matching. Repeating that published mechanism is not demonstrated Trade differentiation.

If the job is already-funded wallet settlement, preserved direct RFQ/A2 avoids Trade's extra code/state/archive and uses fewer measured VM cycles in the frozen comparable TEST fixture. Current iCKB-specific mainnet execution cost was not measured here. A2 is a settlement primitive; the new DApp/bot provides its conversion workflow. They are overlapping stack layers, not independent liquidity pools to double-count.

## Does zero-personal-Cell access justify the new machinery?

Not for an established actual use case on this evidence. At the dated denomination reference,146CKB native iCKB receiving capacity is about$0.1682; the standard293CKB independent order/master profile about$0.3375. These are occupied reusable capital, not fees. Existing suitable wallets have still lower incremental capital. The frozen new code alone50,441CKB is about$58.1080 at that denomination, before market state/backing/history service. Code reuse could amortize it, but no paid volume or customer cohort is established.

At hypothetical$0.50/$1/$2/$10CKB, receiver capital73/146/292/1460dollars becomes a genuine access problem, and the SDK's sampled new-buy floors reject more small tickets. That is a stress-case opportunity, not today's demonstrated willingness to pay. Shared key-only ownership can improve internal repeated access, but does not manufacture iCKB, remove a liquidity provider, guarantee proof service, or deliver an unconditional small external output. The preceding native pool used TEST xUDT; this exact iCKB integration is not automatically qualified by its successes.

Freeze both existing capacity and two-asset research as fallbacks. Do not optimize the pool to compensate for missing market evidence.

## Decision-changing evidence and next step

Reopen this narrow opportunity only with a reproducible native-asset quote or actual customer job: exact iCKB contract, remaining funded executable size, bid/ask and minimum, fill/collection conditions, real acquisition/replenishment cost, capital duration, fees and a measurable paid urgency/size gap that shipped iCKB/A2/direct settlement cannot satisfy economically.

A future authorized validation could request firm quotations and latency/volume requirements from holders/makers. No contact is authorized now; none was made. Continuing read-only public sampling can detect new unfilled orders but does not justify indefinitely building infrastructure. The engineering adapter remains unimplemented; only a demonstrated quote-driven advantage should trigger it.

Alternative fixed-term risk and paid inventory commitments remain hypotheses in the preserved original WO09 research. They still need actual counterparties/pricing and their own enforceability evidence. No unrelated product pivot, cross-chain restart, quarantined beneficiary validation or LO-01 work was resumed.

## Research loop and preservation

OBSERVE: new competitor offers public SDK pool/order reads. WHY: prior evidence gap was tooling/investigation, not absence of a market API. IF valid funded orders exist, measure their actual executable amounts. ELSE distinguish fulfilled groups and locked redemption backing from liquidity. WHAT IF a different native asset has an accessible market? RUSD contract/Cells verified; current venue read unavailable. MODEL: exact30quote scenarios and45capital-cost counterexamples. RESULT: no observed executable quote-driven competitive margin. NEXT QUESTION: what real holder pays enough for inventory latency/size insurance beyond the current DApp offer?

Initial observation milestone `5c3de869869c915e7cd4cbceb1cbe8e4d3c7f55a` was non-force pushed and independently verified via remote SHA. This decision and calculations are preserved in the following commit, whose verified exact SHA appears in the final report and Git history. Frozen baseline `18c150a776e90b2a4ff174217dcbe44d3a1ee4bc` remains an ancestor. No protected branches were changed.

Read details: `WO09_NATIVE_INVENTORY_OBSERVATIONS.md`; exact comparisons: `WO09_NATIVE_INVENTORY_COMPARISON.md`; maker economics: `WO09_NATIVE_MAKER_ECONOMICS.md`. Research runtime/source limitations are documented in the lab README and source provenance. This is not production-security or commercial qualification.
