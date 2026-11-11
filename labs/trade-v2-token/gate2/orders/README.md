# Gate 2 Offline Orders

`custody_smt` TMS1 operation 8 is a custody-only entitlement transfer. It spends the custody xUDT cell, its custody marker, and one solver/buyer-owned plain CKB cell. It returns the same custody xUDT amount with a new authenticated root, returns solver change to the input lock, and pays the signed payout lock. It does not spend curve inventory or the market marker, so the AMM reserve is not changed.

The TMS1 transition must contain exactly two updates: the current seller leaf and the payer's buyer leaf. The seller must have an active leaf with enough balance, the seller's balance decreases by the order quantity, and both leaves advance by exactly one revision. The seller's signature is checked against the current authenticated seller revision and the signature binds the current CKB genesis, market script hash, complete xUDT Type Script hash, custody script hash, seller lock hash, quantity, minimum proceeds, payout lock hash, and order id. The transaction's only plain CKB input is the buyer/payer; the seller must not have an input. The payout must be a plain cell with the exact signed lock hash and capacity at least the signed minimum.

The 210-byte TMS1 operation-8 extra payload, appended after the sparse-Merkle proof, is:

| Offset | Bytes | Field |
| ---: | ---: | --- |
| 0 | 8 | Quantity, unsigned little-endian |
| 8 | 8 | Minimum proceeds in shannons, unsigned little-endian |
| 16 | 32 | Order id |
| 48 | 32 | Seller lock hash |
| 80 | 32 | Payout lock hash |
| 112 | 33 | Compressed seller public key |
| 145 | 64 | Recoverable secp256k1 signature compact form |
| 209 | 1 | Recovery id |

The signed message is UTF-8 text passed to CKB's `signMessageRaw`; the verifier prepends the `Nervos Message:` domain prefix when hashing it. Its exact lines are `TRADE V2 MERKLE TOKEN SALE v1`, `Genesis`, `Market`, `Asset`, `Custody`, `Seller`, `Revision`, `Quantity`, `Minimum shannons`, `Payout`, `Order id`, `Buyer: any`, and `Expiry: none`, in that order with newline separators. The seller revision is the current old leaf revision authenticated by the proof. Advancing that revision on fill or owner cancellation makes the prior order signature unusable. The revision is the replay nonce; the order id is signed metadata, not a separate globally stored uniqueness registry.

Expiry is not implemented. Orders signed with this message do not expire by time; they remain fillable until the seller changes their authenticated revision or the order is filled. Cancellation is operation 7 and requires the seller's own CKB input and a one-revision update with unchanged balance.

## Native Fixture

The native fixture creates a fresh private CKB 0.210.0 dev chain, issues xUDT, enrolls a buyer, changes that buyer's revision after the seller order is signed, then fills the still-valid seller order against the updated Merkle root. It records positive commits, rejected payout/signature/replay cases, and raw RPC evidence under `orders/evidence/`. Test keys for the additional seller, buyer, and payer are generated at runtime.

```sh
TRADE_GATE2_BUILD_DIR=/tmp/trade-gate2-order-build \
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
node labs/trade-v2-token/gate2/orders/fixture.cjs
```
