# WO09-E2 exit-capacity reserve: bounded design model

**Status: analytical hypothesis only.** No contract change, proof circuit, bond lock or reserve
mechanism was implemented or security-tested in this checkpoint.

## Observation and changed assumption

Pinned Liquid Cells preserves anchor capacity slack through exits, so a full accounting drain can
leave a valid anchor. The private-chain experiments instead show a different bottleneck: an
authenticated small claim must currently create an ordinary secp payout Cell whose capacity equals
the claim. A 0.1 CKB and a 1 CKB ordinary output both fail CKB 0.210.0 occupied-capacity validation;
the exact tested output floor is 61 CKB. A 61 CKB sponsored payout then fails the upstream type
script's exact-capacity rule. Thus the missing resource is not anchor survival; it is output
capacity assigned to each entitled recipient.

## Minimum funding model

For each claim balance `b_i` CKB and standalone output floor `F = 61 CKB`, the minimum extra CKB
capacity needed to create a spendable output is:

`topup_i = max(0, F − b_i)`

An independently funded reserve would therefore need at least:

`R_required = Σ topup_i`

before fees, code/data occupied capacity, future floor changes, failed exits, or any safety margin.
The claim would receive one `F`-capacity Cell: `b_i` from the financial claim and `topup_i` from
the reserve. Example costs per claimant:

| Claim principal | Required capacity top-up | Top-up / principal |
|---:|---:|---:|
| 0.1 CKB | 60.9 CKB | 609× |
| 1 CKB | 60 CKB | 60× |
| 60 CKB | 1 CKB | 1/60× |
| 61 CKB | 0 CKB | 0× |

These figures establish a capacity cost floor, not market value, fee cost or product return.
Recipients can later spend the full output; consequently the top-up is a transfer of real CKB value,
not a refundable accounting label.

## Required rules before this is a mechanism

An actual design would need a separately controlled reserve Cell and a type-script rule that proves
the reserve's authorized reduction exactly matches the capacity added to the claimant's output.
The checkpoint proof must also account for all outstanding top-up entitlements so one claimant
cannot spend capacity promised to another. The entitlement must follow a transferred financial
claim, and the protocol must prevent new dust accounts from being created without funding their
capacity liability.

If the issuer or LP funds `R`, it must be ring-fenced from principal, fees and other obligations.
Releasing unused capacity safely requires either all rights to be redeemed or a protocol-defined
expiry that cannot be extended by new checkpoints. No expiry rule is assumed here; upstream
`since` alone supplies a lower bound, not passive upper quote expiry. Without a proven close path,
unused reserve remains idle capital. If the reserve is smaller than aggregate entitlement, the
mechanism must reject creation of new claims or define a fair failure mode; first-come payout would
not preserve all owners' rights.

## Comparison and next decisive experiment

This model is not a Liquid Cells capability and has no demonstrated advantage over existing
wallet-to-wallet atomic settlement, which needs no additional persistent output when parties already
own compatible Cells. It adds issuer/LP capital lockup and custody/liability accounting. Unlike
the current upstream exact-payout mechanism, it could in principle produce a spendable standalone
Cell for each small claimant, but for 0.1 and 1 CKB claims the 60.9 and 60 CKB subsidy dominates the
principal. It therefore does not yet support a commercial-competitiveness claim.

The next decisive prototype should compare two isolated alternatives with exact same-chain
transactions: (a) a recipient-authorized payout that adds a small amount to an already occupied
recipient Cell, and (b) a bonded reserve that funds separate outputs. For (a), first establish a
lock and witness rule under which the recipient's own existing Cell is a required input and the
recipient authorizes the capacity increase; the current Liquid Cells canonical-secp/exact-output
check cannot support it. For (b), generate multiple independently entitled claims and prove reserve
liability conservation, early/late claim ordering, operator recovery, and exhaustion behavior. Do
not combine their assumptions or report either as validated before the native tests pass.
