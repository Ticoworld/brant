# WO02 security model, specified before contract implementation

Status: design claims awaiting adversarial execution. Test chains only. WO01 recovered from Library archive SHA256 143cf1c835de14de9f4b3e9f1c8b3a028692dcaf5a298b575fa972908adef7b9; all 65 manifest entries verified. WO01 is not modified.

## Participants and authority
Alice is the trader, Bob the maker. Each has a distinct secp256k1 CKB wallet and a distinct EVM signer. Coordinator stores quote records but has neither asset key. Broadcaster submits already authorized transactions without wallet keys. Recovery runs in a new process with an exported package and role-local test keys, never the coordinator database. Permissionless claim/refund callers may trigger payments only to the fixed contract-bound beneficiary. A coordinator is not an oracle, adjudicator or custodian.

## Asset and identity binding
Native CKB is capacity on a custom Dummy-PoW chain identified by its genesis hash. EVM asset is a fixed-supply test ERC20 named WO02 Test Dollar, six decimals, explicitly not USDC/USDT, on isolated chain ID 31337. Token address, escrow address/code, CKB code hash, exact outpoint, both networks, trade ID, parties, integer amounts, deadlines and fee budgets are retained in a canonical JSON terms digest. Both participants sign this digest. The contracts enforce their chain-local authorization/asset/payout subset, not remote chain truth. Independent clients verify both escrows against all signed terms before acting.

## Baseline to attack
The conventional customer-source-first arrangement gives the EVM source a longer strict refund deadline and CKB destination a shorter refund-eligibility height in token-to-CKB trades. CKB hash claim has no hard expiry. This arrangement must be attacked after source refund and before destination refund consumption. A second known hazard is secret disclosure in a failed/reverted destination claim: a mempool-visible secret can unlock the other chain even if destination payment fails.

## Proposed repair to test, fixed chain orientation
Always fund CKB first, with CKB refund sufficiently later than the EVM strict claim cutoff. The CKB funder always generates/holds the secret. EVM funder funds the shorter-lived token escrow after observing risk-final CKB funding. Direction A: Alice funds CKB and holds the secret, Bob funds test tokens. Direction B: Bob funds CKB and holds the secret, Alice funds test tokens. Thus market direction reverses, but chain settlement orientation and secret ownership do not. Maker-first CKB funding in B changes capital/option exposure.

EVM claim requires block.timestamp < T; refund requires block.timestamp >= T. Both pay only pinned recipients, only once. CKB claim requires SHA256(secret)=h and exact designated recipient output. CKB refund requires input since equal to the pinned absolute block-height H; consensus must make it mature. Claim remains valid at/after H until one spend commits. A refund never happens automatically. CKB payout principal is exact; a fixed extra escrow fee reserve pays the closing transaction.

## State transitions
PROPOSED -> BOTH_SIGNED -> CKB_FUNDED -> CKB_RISK_FINAL -> TOKEN_FUNDED -> BOTH_VERIFIED -> SECRET_DISCLOSED -> TOKEN_CLAIMED -> CKB_CLAIMED -> COMPLETE. SECRET_DISCLOSED is irreversible information release, even if a transaction later fails or is reorganized.

Abort transitions: before funding -> ABORTED; only CKB funded -> WAIT_CKB_REFUND -> CKB_REFUNDED; both funded without a timely reveal -> TOKEN_REFUNDED and CKB_REFUNDED, independently. Unknown send outcome -> RECONCILE by known transaction hash/outpoint/escrow state, never blindly create a second trade.

Forbidden: wrong-asset funding treated as accepted, unverified payout recipients, early refund, EVM claim at/after cutoff, output diversion, underpayment, duplicate EVM settlement, secret reveal without validated funded destination and sufficient remaining inclusion budget. Never label a pending transaction complete. Never claim two chain states are atomic because the coordinator says so.

## Bounded assumptions and conditional safety proposition
Assume correct consensus, uncompromised role keys, SHA256 preimage resistance, faithful simple ERC20 behavior and independent clients querying locally controlled validating nodes. Local RPC endpoints are trusted interfaces to our nodes; no remote light-client proof implementation is claimed. Confirmations k_CKB and k_EVM are explicit experimental parameters, not estimates of real-world reorg probability. Reorgs deeper than the selected thresholds are outside the proposition and separately injected as counterexamples.

Let I_E bound EVM destination inclusion after broadcast, F_E its selected finality wait, O bound secret observation/watcher downtime, I_C bound CKB claim admission/proposal/commit and F_C its selected finality wait. Require reveal broadcast before T minus I_E minus safety margin. Require guaranteed CKB progress sufficient for O+I_C+F_C after any admissible reveal, before H refund eligibility. Relative clock/height progress must be bounded externally by the experiment schedule; H and T cannot be directly subtracted as the same clock. Pause new funding/reveal if these budgets cannot be validated.

Under those bounds, an honest CKB funder reveals only where destination claim inclusion is guaranteed before T and receives tokens; an honest EVM funder observing an admissible reveal can claim CKB before competing refunds. Without reveal it can refund its own token; CKB funder can refund CKB once H matures. Network fees and opportunity costs are accounted separately. This is a conditional argument to test, not an unconditional atomicity theorem.

A watcher can be anyone with public package/contract identities and claim preimage once public. Funds go to pinned beneficiaries. It needs chain progress and fee reserves, not coordinator permission. A malicious actor can disclose a secret at arbitrary times; an honest funded counterparty must continue monitoring through its exposure window. Unlimited watcher downtime or chain stalls invalidate the bounds.

## Test goals
Run successful directions independently, kill coordinator at every meaningful boundary, exercise claims/refunds before/at/after T and H, reorder conflicting spends, lose responses, delay/stop each chain, revert local history before/after reveal, and try malformed terms/amounts/recipients/signatures/asset IDs. Preserve every counterexample and test repaired client policy separately from contract enforcement.

## Implemented CKB layout and constraints

The lock arguments are exactly 185 bytes: version (1), SHA256 hash (32), claim-recipient lock hash (32), refund-recipient lock hash (32), absolute refund block height little-endian (8), exact principal in shannons little-endian (8), signed terms digest (32), chain genesis identity (32), and fixed close-fee reserve (8). The VM checks script/argument lengths. Chain identity and remote-asset terms are retained in the arguments/digest, but this lock does not verify foreign-chain state or reconstruct the terms digest. Those are client checks. A byte field being present is not proof the VM enforces its cross-chain meaning.

The experiment deliberately permits exactly one total input and one output, with no output type script or data. Claim witness is byte 0 followed by exactly 32 preimage bytes. Refund witness is byte 1 and requires the input's `since` to equal the pinned H. The CKB consensus verifier, not the script's imagined current clock, enforces `since` maturity. The output must pay the exact principal to the corresponding pinned lock hash. Input capacity must equal principal plus close reserve, fixing the closing fee. There is no caller-controlled payout address. Triggering a payout does not require a beneficiary signature because the resulting cell remains locked by that beneficiary's independent secp256k1 wallet.

This narrow shape deliberately rejects aggregation. Allowing several different escrows to credit the same output without accounting would introduce a double-credit bug. It also lacks fee sponsorship and fee bumping: if the fixed close reserve cannot obtain inclusion, the recovery inclusion assumption fails. That limitation is not concealed by quoting low devnet fees.

On EVM, each trade ID can be funded once, with an immutable token selected by the deployment. Funding binds the actual funder, recipient, amount, hash, deadline and terms digest in storage. Claim and refund are disjoint at timestamp T. The contract checks SHA256 over a bytes32 preimage, transfers to the stored recipient/funder, and updates state before transfer. It does not validate the counterchain or signatures over the quote; the funding transaction is the funder's chain-local authorization. Both participants' quote signatures are separately checked by the independent client. Unexpected token behavior is outside this simple token's implementation.

## Invariants and their validation boundaries

I1: a CKB escrow spends at most once on one canonical history, with exact designated payout and bounded fixed fee. I2: an EVM order pays at most once on one canonical history. I3: an honest client's first secret disclosure requires both funded terms, selected confirmation depths and remaining reveal/claim budgets. I4: a refund client does not require the counterparty to have funded correctly. I5: a failed send response never causes a second funding obligation without reconciliation. I6: no principal atomicity claim survives a reorganization deeper than the chosen finality assumption or a watcher outage beyond the available claim window.

I1/I2 are exercised against concrete unauthorized spends and duplicates, not formally verified. I3 is a client policy, not a cross-chain contract theorem. I4 required a real client repair during WO02. I5 is demonstrated for specific lost-response paths; durable key/secret loss and arbitrary disk corruption are not solved. I6 is deliberately falsified outside the assumptions in the recorded tests.


## Post-disclosure refinement tested after the primary matrix

The both-funded/live requirement applies to first disclosure. If a sufficiently confirmed CKB payout has already consumed this exact escrow, that committed payment and its preimage witness can instead authorize re-inclusion of the matching EVM claim while the EVM escrow remains funded and unexpired. The recovery client validates a supplied payout-transaction hint against local chain state, exact recipient/amount/outpoint and hash. This does not prove automatic discovery or rescue after an EVM refund, and does not remove the bounded-reorganization assumption. The focused repair case executed this refined transition.
