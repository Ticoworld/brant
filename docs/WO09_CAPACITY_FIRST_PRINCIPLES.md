# Capacity from first principles — 3 November 2026

Scope: Trade trading/settlement only. No crowdfunding, service-reservation or merchant-product pivot. Baseline `b94684fdd8c18701fb0facc8ab7080c85924ac2a` matched fetched remote. Existing contracts stay frozen.

## The rules that actually matter

Primary source: [CKB0.210.0 occupied-capacity implementation](https://github.com/nervosnetwork/ckb/blob/2592ddf0502cd4adfe886db893cccc866db3c60f/util/gen-types/src/extension/capacity.rs), preserved with MIT license under `capacity-access/research`. A script occupies32bytes code hash +1hash-type +args. A Cell output occupies8bytes capacity +lock +optional type +data. Serialization overhead is not the occupied-capacity formula. One occupied byte requires1CKB, or100,000,000shannons.

Thus a standard empty20-byte-argument secp Cell occupies61CKB. It is not a universal requirement for every user or construction. The structural empty/no-type/no-data/zero-argument lock lower bound is41CKB. That is **not** a demonstrated useful arbitrary-owner lock: ownership still needs authentication, potentially in args/data, a different shared commitment, or more code. An output can never have zero occupied capacity. A32-byte-owner-argument empty lock would occupy73CKB. Our shared covenant occupies282CKB, independent of active users up to its bounded target; it includes144bytes financial state plus two65-byte lock/type scripts and8capacity bytes.

[Transaction structure](https://github.com/nervosnetwork/rfcs/blob/0c945451c24194f4d34d81195c0159df0a67581a/rfcs/0022-transaction-structure/0022-transaction-structure.md) and [default signing documentation](https://docs.nervos.org/docs/how-tos/how-to-sign-a-tx) distinguish protocol scripts from the usual secp convention. No consensus rule requires every authorizing key to own a transaction input. A custom covenant can verify a witness signature against an authenticated owner in its own state. This is the experiment executed here; standard sponsor-input signatures alone would not authenticate the customer.

[RFC0002](https://github.com/nervosnetwork/rfcs/blob/0c945451c24194f4d34d81195c0159df0a67581a/rfcs/0002-ckb/0002-ckb.md) already contemplates application/cell-owner fee and capacity funding. Sponsorship is not new cryptographic exemption. Whoever funds capacity forgoes its other uses; lending requires an enforceable division of rights and an economic return.

## Eight separate quantities

1. **Consensus occupied capacity:** real CKB required for actual output structure.
2. **61CKB wallet convention:** applies to the standard shape, not every identity or claim.
3. **Alternative lock size:** may change the shape; cannot erase the positive lower bound or ownership data/control.
4. **Authorization:** a key can authorize a shared-state transition directly in a witness, without owning a Cell.
5. **Market storage:** sponsor funds the282CKB immutable shared cushion and code publication. Customer owns neither automatically.
6. **Backing/inventory:** every customer CKB claim is backed once by actual vault capacity beyond the cushion/fee reserve. A second asset would require separate real inventory and validation; it is not implemented here.
7. **Miner fees:** actual input-minus-output capacity. The tested owner can explicitly pay from its authenticated claim; no personal fee Cell is needed. Optional subsidy is finite and separately accounted.
8. **Recovery:** requires private owner key, current authenticated chain/state proof, usable fees and an economically valid output/transfer route. None is equivalent to merely knowing a root.

[ACP RFC0026](https://github.com/nervosnetwork/rfcs/blob/0c945451c24194f4d34d81195c0159df0a67581a/rfcs/0026-anyone-can-pay/0026-anyone-can-pay.md) permits suitable existing funded Cells to accept payments under its rules. It does not create free receiving capacity. CoBuild can authorize flexible composition, but this experiment signs an exact full transaction and needs rebuilding/resigning after conflicts. Historical cheque/sponsorship designs are prior art, not verified leases here.

Official [Fiber channel documentation](https://www.fiber.world/docs/concept/channels/unidirectional-channel) permits initiator-funded channels without an acceptor contribution and documents a99CKB default reserve. That is a version/configuration cost, not CKB's universal minimum. Funding, directionality, route liquidity, commitment/closing capacity and participant recovery still matter. No new Fiber guarantee was tested in this lab.

## The decisive lower bound

All requested positions lie below even41CKB: the largest is$20 at$0.50/CKB =40CKB. Therefore none of the requested $1/$5/$20 positions, at$0.50/$1/$2/$10, can by itself fund a standalone exact-value L1 Cell under the current output model. Another source of capacity, an existing recipient, aggregation or a different financial right is needed. This is a **derived consensus boundary**, independently illustrated by native insufficient-capacity rejection; it is not an attempted workaround.

Full dated source registry: `labs/wo09-unified/capacity-access/research/sources.json`. Correct source path was found under `util/gen-types`, after guessed `util/types` paths returned404. The pinned current RFC source and older rendered RFC book can differ in status; source/version distinctions are retained.
