# FIRST CODEX CLOUD TASK — Migration verification only

**Do not begin WO04-E2 immediately.** First establish a clean, reliable repository and cloud development environment.

1. Inspect this repository, confirm the E1 import is intact, and inventory missing tools/evidence; compare against included documents and pinned package versions.
2. Record the exact runtime: operating system, available disk/RAM, network constraints, CKB binary/toolchain, Node, Python, Solidity compiler, dependencies.
3. Validate a minimal E1 compile and offline evidence check from checked-in fixtures. If fixtures are insufficient, say so and scope a fresh isolated-chain reproduction. Do not label saved receipts as a fresh run.
4. Keep WO01–WO04 labs preserved and untouched; do not rename source directories or fix unrelated code.
5. Create `docs/CLOUD_SETUP_RESULT.md` with PASS/PARTIAL/BLOCKED and exact commands/results, update `docs/PROVENANCE.md` if necessary, and commit the result.
6. After the environment is ready, propose a focused next E2 task to authenticate one real finalized execution root on CKB. Do not perform broad parallel architecture surveys.

No mainnet, no real secrets, no public chain transactions, no production deployment.
