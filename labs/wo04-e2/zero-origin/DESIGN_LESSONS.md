# Source-level lessons: DLN and Across

One bounded public Git access check succeeded for each repository. Exact commits,
files, SHA256 hashes and original BUSL-1.1 licenses are retained in `references/`.
These are source-inspection references, not dependencies or incorporated contract
implementations. This is not an equivalence claim about their security models.

DLN at `d54e94f2b5102bff89a4df506404bb77f3edc148`:

- `DlnDestination._fulfillOrder` checks destination chain, recomputes order ID,
  requires an unset destination state, validates allowed unlock authority and
  exact take amount, transfers the asset and records the fulfiller authority.
  Both public entry points use `nonReentrant`. Lesson: destination execution need
  not have a prior destination-side user open, but the complete deterministic
  order, chain and reimbursement authority must remain bound.
- `DlnSource.claimUnlock` authenticates the remote destination through
  `_onlyDlnDestinationAddress`; `_claimUnlock` requires a created source order and
  cross-checks the submission chain before marking claimed and paying. Source
  creation/escrow and authenticated unlock remain separate obligations. A valid
  destination transfer is not by itself proof that the maker can be reimbursed.
- Cancellation has its own destination/source status and authenticated messages;
  it is not an inference from missing events. Our absence refund instead relies
  on an immutable deadline plus finalized storage non-inclusion and a contract
  that permanently disallows fills at/after that deadline.

Across at `b1c4e86225420df5cb8d03042526622aca80fe61`:

- `SpokePool._fillRelay` checks `fillDeadline`, hashes the complete relay, rejects
  duplicate fill status, writes Filled before token delivery, and delegates token
  transfer. No partial fill is supported in that path. Our full-amount immutable
  terminal record follows the same general state-machine lesson; we additionally
  test exact balance deltas and ERC-20 return behavior.
- Across's deadline condition is `< currentTime`; this experiment deliberately
  requires `block.timestamp < deadline` for fills and strictly `finalizedTime >
  deadline` for refunds. The equality boundary must be an explicit protocol rule,
  not copied incidentally between implementations.
- `executeRelayerRefundLeaf` validates destination repayment chain, authenticates
  a Merkle leaf against a relayed root bundle and sets the claimed-leaf bit before
  distributing refunds. Its relayer refund is a separately authenticated
  reimbursement path, not a generic proof that an unfilled user slot is zero.
  Our CKB light-client root authority must remain in front of storage parsing;
  root origin, beneficiary and replay protection cannot be replaced by a bare
  Merkle branch.

## Unresolved EVM-side settlement guarantee; no reverse implementation

OutcomesV2 can verify a deterministic order and deliver USDC without a user EVM
transaction. It does **not** verify CKB consensus, funding inclusion, confirmation
or continued funding availability. Its contract tests deliberately show that a
structurally valid but unfunded order can be filled. That is not a completed
trade. A maker must independently validate the actual CKB funded cell, its exact
lock/type/terms and confirmation depth before paying. The demonstrated funded
cell has no discretionary cancellation path; early cancellation is rejected on
CKB. This does not solve a CKB reorg or prove live source funding inside Ethereum.

Reverse USDC-to-CKB swaps would need Ethereum to authenticate a sufficiently
final CKB delivery/settlement predicate, plus coherent timeout and source escrow
rules. E2 authenticates Ethereum on CKB only. It supplies no such EVM-side CKB
verification guarantee. No reverse swap, source-funding oracle, optimistic bridge
or new trust assumption is implemented in this work order.
