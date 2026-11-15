# E2 first principles

A CKB transaction consumes live Cells and creates replacement Cells. Each output still needs occupied capacity; full-body wallet signatures bind the transaction body. Off-chain intent text has no reservation or fill guarantee until a valid transaction commits.

Separate intention, atomic execution, continuing liability, ownership change, redemption, and operator-failure exit. A matched trade can reuse existing wallet and asset Cells with zero incremental persistent Cells. It still consumes transaction bytes/cycles, fees and compatible inputs. A new ordinary output needs occupied capacity. A 0.01 CKB principal cannot alone fund a normal 61-CKB output. Reuse an existing compatible recipient Cell, validate an ACP path, or have a sponsor fund capacity. Sponsored capacity is recoverable only under agreed terms.

Compression moves costs. One root removes per-user roots but adds proof/data access, duplicate-redemption prevention, shared-state contention and exit rules. An immutable root cannot safely pay a leaf twice. Mutating it serializes exits; separate per-user nullifiers restore per-user state. Channels eliminate routine L1 updates after setup but require collateral, liquidity, state recovery and eventual settlement.

Keep financial principal, occupied storage, temporary lockup, fees, operator capital and off-chain service costs separate. Capacity is capital unavailable to other uses, often recoverable when a cell is consumed. Fees and DA/proving/indexing may be spent permanently.
