# Shared read-only checkpoint experiment

## Executed result

Two distinct funded native reservation cells referenced the **same checkpoint outpoint** through cell_dep. Both were accepted before mining; the captured pool had two pending transactions and no proposed transactions at that point. The final run committed them together, while another retained run used adjacent blocks. They did not consume the checkpoint, overlap principal inputs, or consume each other's allocation. The checkpoint remained live after both settled.

Its type script verified a real EVM account/storage proof before creation. The bootstrap root remained an explicitly trusted fixture. Publication cannot be described as foreign consensus authentication.

## Measurements in the final run

| Operation | Cycles | Transaction bytes |
| --- | --- | --- |
| verified_shared_checkpoint | 2064388 | 1919 |
| filled_shared_shared_recovery | 49592 | 376 |
| unfilled_shared_shared_recovery | 49596 | 376 |
| filled_individual_individual_recovery | 426417 | 1466 |
| failed_then_unfilled_delayed_individual_refund | 458390 | 1551 |

A shared consumption averaged49,594cycles and376bytes. Direct execution-proof consumption averaged442,403.5cycles and1,508.5bytes across two observed proof shapes. Checkpoint publication used2,064,388cycles/1,919bytes, including its funding-wallet authorization and output validation. These are whole-transaction costs, not isolated pure-Merkle or pure-MPT function costs.

The initial built-in-TYPE_ID run consumed about1.043million cycles per shared settlement. The final custom generative reservation removed that million-cycle fixed charge while preserving the tested uniqueness rules. Its extra code capacity, dependency bytes and audit surface must be counted. Built-in TYPE_ID remains in the one-time bootstrap publication. The source constant is pinned in research/ckb-script_src_type_id.rs.

## Lifetime, replacement and retention

The authenticated checkpoint type rejects consuming or replacing an existing checkpoint. A real attempted spend was rejected. This preserves dependent claims, at the cost of permanently retaining400 CKB in this fixture. The bootstrap similarly retains300 CKB. This is not an economically complete garbage-collection design.

A separate controlled test consumed an optional read dependency before submitting a transaction that referenced it. The node rejected that transaction. Rebuilding without the dead optional dependency then succeeded through direct recovery. This demonstrates the dependency-liveness hazard; it is not a claim that the immutable authenticated checkpoint itself was consumed.

A practical lifecycle could retain immutable finalized roots until all claims resolve, or retire a checkpoint while preserving permissionless reconstruction/direct recovery from a durable authenticated header history. Retirement without that fallback can strand claims. E1 implements immutability and the individual execution-proof path, not a safe economical historical-root archive or retirement protocol.

The checkpoint script permits independently funded copies of the same verified commitment. Duplicate copies are not a trust bypass because their creation still runs the proof verifier against the pinned bootstrap. Duplicate publication was not separately executed in this run. The copy mechanism alone does not solve initial root authentication or source-data loss.

## What is not measured

No production root-verifier publication cost, Ethereum consensus validation cycles, proof-compression cost, large-batch source-tree gas or real-network throughput was measured. Cheap membership consumption is not free foreign verification. The source contract only commits batches of1 or2. Larger-batch comparisons in06 are explicit sensitivity models requiring additional implementation.
