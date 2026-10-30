# WO02 implementation and reproduction

This workspace is an isolated protocol experiment, not production-safe swap software. Every key is a public test fixture. The ERC20 is WO02 Test Dollar (WO02TEST), six decimals, with a controlled supply split between Alice and Bob. It is not USDC or USDT. Do not use any key or program here with real assets.

## Pinned implementation

CKB node: v0.210.0, binary identity 2592ddf, official archive SHA256 `68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf`. CKB C standard library revision `6bf2bca668e0db5f9eb120eb78b31782899ef90d`, source included under deps. Compiler: Zig 0.14.1's Clang backend, target riscv64-freestanding, rv64imc, no standard host libc. ELF image base is explicitly 0x10000, inside the CKB VM memory range. A preliminary ELF linked at the default 0x1000000 failed with MemOutOfBound; that was a build configuration error, not an accepted escrow result.

EVM: Ganache 7.9.2 / EthereumJS, isolated chain ID 31337, Shanghai rules, timestamp increment one per mined block. Solidity compiler 0.8.30+commit.73712a01, optimizer 200 runs, Shanghai target. Node.js 24.22.1; ethers 6.15.0; Nervos JS core/utils 0.109.5. Exact npm transitive dependencies are in package-lock.json. Python 3.12 standard library supports tool bootstrapping, models and evidence checks. EVM gas transactions use an explicit 2-gwei development fee price; production fee modeling is separate.

## Source and process boundaries

* contracts/escrow.c: actual compiled CKB native-capacity hash/refund lock, including fixed-size SHA256.
* contracts/Exchange.sol: controlled test ERC20 and escrow with strict EVM claim/refund boundary.
* src/wallet.cjs: independently invoked role signing for CKB funding, EVM funding and quote acceptance.
* src/coordinator.cjs: accepts signed quote terms, stores no asset key or secret, and can be killed.
* src/broadcast.cjs: submits already signed transactions, records their hashes before response handling, and supports intentional response loss.
* src/recovery.cjs: separately launched process, no coordinator database reads, verifies package/chain/escrow terms and executes fixed-beneficiary claim/refund paths. A separate funded watcher gas key pays EVM calls; it is not an asset beneficiary's key.
* src/run.cjs: deterministic integration driver with manually progressed chains, adversarial cases, event/receipt recording and balance checks.
* src/economics.py: snapshot-based and assumption-based commercial models, separate from contract execution.

Processes are separated by executable responsibility, not an OS security sandbox. Local test files are readable to the workspace owner. The experiment proves recovery does not call the coordinator or use its database/signing authority; it does not prove isolation against a compromised host. The coordinator never has asset-signing authority in this design.

CKB code is installed as a system cell in a custom genesis, alongside normal secp256k1 wallet fixtures. That code deployment is not a publicly mined deployment transaction, so its on-chain deployment fee is not measured. Code bytes and occupied-capacity requirements are recorded separately. All trade funding and spending uses actual transactions and CKB VM verification. Always-success code is used only for development miner reward destinations, not to unlock the trade principal.

## Fresh environment sequence

On Linux x86_64 with Node.js 24.22.1, npm 11.9.0 and Python 3.12:

```bash
python3 src/bootstrap.py
make build
make test
make extra
make reinclusion
node src/verify-evidence.cjs
python3 src/cost_ledger.py
python3 src/economics.py
```

The bootstrap downloads the pinned CKB release, verifies its digest, installs Zig 0.14.1 into tools/python, and runs npm ci from the lockfile. It performs no public-chain write. If exact prebuilt contract artifacts are being used, verify SHA256SUMS before running; rebuilding is preferable when validating compilation.

`make smoke` runs just the two successful directions. `make test` runs the full implemented matrix. Each creates a new uniquely named temporary devnet and refuses to overwrite another chain directory. Ports 18214/18215 and 18545 must be free in that execution namespace. Both chains and their clients must run in the same network namespace; the driver starts them as child processes. It stops its node/server/coordinator children on completion or failure. A killed driver cannot promise graceful shutdown; the operator must terminate only its own isolated fixture processes.

Output evidence paths include a per-run timestamp to prevent collisions. Running a new experiment replaces the top-level results index with that run's results; keep the delivered archive immutable and run on a copy. All trade packages, secret fixtures, wallet signatures, signed funding transactions, raw RPC transcripts and receipts are retained. Snapshots/rollback branches are explicitly labeled. A reverted receipt proves that branch executed locally, not that its payment survived the final canonical history.

To run recovery separately while the fixture nodes are active:

```bash
node src/recovery.cjs PATH_TO_RECOVERY_PACKAGE evm-claim PATH_TO_ROLE_SECRET
node src/recovery.cjs PATH_TO_RECOVERY_PACKAGE ckb-claim -
node src/recovery.cjs PATH_TO_RECOVERY_PACKAGE evm-refund -
node src/recovery.cjs PATH_TO_RECOVERY_PACKAGE ckb-refund -
```

The CKB claim command with `-` discovers the preimage in the EVM Claimed event. It does not need the private secret file or original coordinator. Refund commands need neither secret. The environment file pins expected local networks/contract code and participants. Set WO02_ENV_FILE to the matching retained file when recovering a package from an extra run. Config/environments retains environments by CKB genesis identity. This is a trusted local configuration, not an implemented foreign light client. A copied package must retain its matching environment; the main driver regenerates identities for every new genesis.

The primary matrix was followed by extra boundary/fee/response tests, then a targeted client repair for re-inclusion after CKB payment. The source includes that final repair; its focused scenario also executed the normal funded first-claim path before injecting rollback. The contracts did not change during those repair runs. The final source hashes are recorded with the evidence.

The final argument `unsafe` deliberately bypasses the reveal-budget/finality guard for counterexample reproduction. It is not a recovery recommendation. It is retained so that the demonstrated principal-loss case remains executable.

## Evidence scope

Development chains are manually mined. Host elapsed times measure this harness and its process/RPC overhead. They do not estimate public-chain settlement or finality. Local rollback is a deterministic fault injection, not a measured reorganization probability. The environment identity and exact asset addresses are generated records in config/environment.json and signed per-trade terms.
