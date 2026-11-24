# Brant integrated delivery

Status IN PROGRESS. The local recovery checkpoint adds a persisted session list and selection in Launch. On a new browser it resumes the latest unfinished session for the connected creator. The existing controller still reconciles by immutable transaction hash.

Verified locally with the shared-launch fixture and TypeScript. The fixture checks creator-scoped lookup after closing and reopening SQLite and sees the original submitted entry. Application process restart and native-chain acceptance remain outstanding.

Next edit LaunchScreen to connect confirmed sessions to the metadata authorization and publish action, with a retryable publication-pending state. Logo validation and durable storage, canonical public discovery, new-market trading and integrated acceptance remain open.

Production and public writes are untouched. Push requires verification of Railway's GitHub deployment trigger.

The next checkpoint connects confirmed launches to wallet message authorization and authenticated text metadata publication. Failed publication is retryable without repeating the launch. Session reads restore the persisted publication status. Typecheck and the shared-launch fixture passed. Browser wallet interoperability and process restart remain unverified.

Next exact action is to bind validated raster image bytes to the signed metadata digest and store them atomically with the SQLite publication. Then expose chain-verified catalog reads that preserve the RVK path.

Logo publication now binds the uploaded bytes to the creator signature, decodes bounded PNG/JPEG/WebP inputs, stores a sanitized PNG atomically with metadata, and serves it through a bounded image route. Typecheck and the shared-launch fixture passed, including signature mismatch, malformed content, oversized dimensions, failed validation before publication, duplicate retry, conflicting metadata and SQLite reopen. Hosted and isolated browser acceptance remain pending.

Railway production Source settings show Ticoworld/brant main with Auto deploy disabled. The next discovery change should reuse canonical launch receipt verification on catalog reads before exposing a market as verified.

Discovery checkpoint. The public catalog verifies creator metadata signatures and reconstructs the immutable three-stage plan from SQLite. It checks each committed receipt against canonical block membership and accepts spent historical outputs. The Markets screen loads paginated catalog entries and a hash-based market detail resolves server-side. RVK retains its existing route and API. The catalog checks four candidates per page and does not replay trade history.

The shared-launch fixture passed incomplete-journal, reopened SQLite, spent historical output and reorg checks. Typecheck passed. A real second-browser acceptance run, live market state verification, performance measurement and generalized trading proofs remain open. Next wire the verified plan identity and First Purchase outpoint into market lineage recovery.
