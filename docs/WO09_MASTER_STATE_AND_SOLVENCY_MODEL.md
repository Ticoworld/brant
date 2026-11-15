# WO09 master executable solvency specification

Status: INTEGER MODEL VERIFIED; CKB covenant, signatures, real payments and reconstruction UNIMPLEMENTED for this new design. Run python labs/wo09-unified/src/solvency_model.py. Output is evidence/solvency-model.json.

Let rights be (owner_i, remaining_backing_i), protected liabilities L=sum(backing_i), and cushion K owned by an explicitly designated contributor. Vault capacity V must equal L+K. A partial redemption x reduces precisely one right, L and V by x; unrelated rights and K remain unchanged. Pool fees may not be disguised as reductions in backing. Final closure is allowed only when L=0 and returns K to its designated owner. This specification omits fee/cell occupancy rules; native implementation must add them.

At enrollment each actual contribution p_i would fund backing floor(4*p_i/5) and creator gross proceeds p_i minus that amount. Required future native validation must bind contribution inputs and signatures to these assignments. The model uses abstract amounts and signer sets and is not evidence of that binding. Example 0.1, 1 and 20 CKB contributions produce 16.88 CKB total backing and 4.22 CKB gross creator funds; 500 CKB cushion is a separate contribution. It cannot be counted as usable creator funding or participant backing.

Model execution covers six complete redemption orders and final cushion return, partial redemption followed by paid ownership assignment and new-owner redemption, explicit funded topups, and eight rejected model operations. Source-side signatures are only set membership; sale consideration is an asserted model constraint. No claim of native atomic sale or cryptographic authorization is made.

Rounding counterexample: three one-shannon contributions protected at 80% create three floor(0.8)=0 individual backing promises. Their sum is zero, whereas floor(3*0.8)=2. A global aggregate formula does not equal the sum of actual individual entitlements. Minimum subscription/protected payout policies are a product design requirement, not an accounting shortcut. Native implementation must specify bounded integers and checked arithmetic; Python's arbitrary integers do not establish overflow safety.

A funded ratchet must increase V by exactly the sum of new promised backing. The model rejects resurrection of fully redeemed rights. Generic ratchet, variable ownership classes, oracle payoffs, enrollment deadlines and authorization/configuration invariants require further specification. Keep the fixed floor as initial fallback.
