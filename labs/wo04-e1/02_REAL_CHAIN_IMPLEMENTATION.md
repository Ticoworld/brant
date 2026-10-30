# Real-chain implementation and reproduction

E1 executed a separate CKB v0.210.0 Dummy-PoW development chain and Ganache7.9.2 Shanghai chain31339. No public chain, real money or production wallet was used. All keys are public disposable fixture keys. Prior WO04 source was neither changed nor rerun.

## Components

| File | Function |
| --- | --- |
| contracts/Outcome.sol | Controlled ERC-20 test token; exact delivery, authoritative expiry, individual terminal commitments and immutable batch commitments |
| contracts/settlement.c | Fixed-beneficiary native CKB payout/refund using direct EVM execution proof or shared checkpoint membership |
| contracts/checkpoint.c | CKB type script verifies actual EIP-1186 account/storage proof against an explicitly trusted bootstrap; immutable checkpoint lifecycle |
| contracts/reservation.c | Generative unique reservation identity without built-in TYPE_ID's fixed million-cycle charge |
| contracts/deny.c | Unspendable bootstrap lock |
| contracts/proof.h | Bounded RLP/Merkle-Patricia inclusion verifier and dependency lookup |
| contracts/hash.h | SHA256 leaf/membership calculation |
| src/recover.cjs | Separate-process source evidence retrieval and permissionless fixed-beneficiary native settlement |
| src/run.cjs | Isolated deployment, funding, defensive cases, source outage and measurements |
| src/verify.cjs | Offline independent ethers-RLP proof walk, signed EVM transaction hashes, native records, terms and allocations |
| src/costs.py | Measured fees/cycles/bytes and reconstructed canonical native wallet balances |

The token implements totalSupply, balanceOf, allowance, approve, transfer and transferFrom, with Transfer/Approval events. Its failure switch is a test-only feature. It is E1TEST, not actual USDC or USDT. Production stablecoin proxies, freezes, upgrades, transfer fees and issuer risks were not validated.

## Pinned environment

Node24.22.1; solc0.8.30+commit.73712a01.Emscripten.clang, optimizer200, Shanghai; ethers6.15.0; Ganache7.9.2; CKB SDK core/utils0.109.5; Zig0.14.1. CKB reports0.210.0 (2592ddf 2026-09-17). Exact binary SHA256, compiler commands, contract bytecode/compiler input and dependency lock are saved in evidence/runtime-identity.json, evidence/build.json, build/evm.json and package-lock.json. Vendored CKB stdlib files and their licenses are included and checksummed.

CKB RPC/P2P are loopback18224/18225; EVM RPC is loopback18555. The driver starts both chains and recovery subprocesses inside one execution environment, then terminates its children. It creates a fresh temporary chain directory and refuses reuse. It does not touch the stopped Windows/WSL Ayrvo environment discussed elsewhere.

## Clean reproduction sequence

Extract implementation and evidence archives into the same parent so their common WO04_E1_AUTHENTICATED_OUTCOMES directory merges. Run a copy if preserving delivered records: these commands regenerate E1 evidence.

```bash
python3 src/bootstrap.py
python3 src/build.py
node src/compile.cjs
python3 src/launch.py
node src/verify.cjs
python3 src/costs.py
```

Bootstrap downloads the exact CKB release archive and checks its pinned SHA256, installs Zig0.14.1 locally and uses npm ci with the lock. It requires internet/package access and a compatible Linux x86_64 host. Dependencies/runtimes are not bundled as node_modules or tools. No installation is needed to read the evidence. Full source and pinned commands are included; a second clean host has not independently reproduced the complete sequence.

Source contracts are installed as genesis code cells. Therefore code size/occupied-capacity requirements are measurable, but actual script deployment transaction fees were not measured. Fresh node init emits an initial mining-disabled warning before setup writes the block-assembler configuration; subsequent generate_block calls actually mined the recorded transactions. Development mining is not mainnet latency.

## Evidence qualifications

The EVM root is chosen by the experiment controller from its own node. It is not verified by an Ethereum consensus light client. The independent recovery client rejects a block/hash/root mismatch against its local EVM node and requires two dev descendant blocks, but this is client validation, not on-chain foreign consensus authentication.

A custom proof parser is not audited. Four terminal-trade proofs and one batch-root proof were independently checked offline with a separate ethers-RLP trie walk. Malformed and mismatched inputs were tested, but no exhaustive proof-system audit or general Ethereum state-tree conformance suite was run. The implementation targets the pinned MPT-based Shanghai environment, not every future EVM fork or L2 finality model.
