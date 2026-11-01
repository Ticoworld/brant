# Pinned official references

- CKB v0.210.0 commit 2592ddf0502cd4adfe886db893cccc866db3c60f, https://github.com/nervosnetwork/ckb. Selected verification, load_header syscall and DAO calculation sources, MIT COPYING preserved. Used by the actual release binary; not recompiled here.
- xUDT source: https://github.com/nervosnetwork/ckb-production-scripts commit 26b0b4f15bb6eeb268b70d7ae006e244b7c06649. Selected xudt_rce source/schema/generated headers; Cargo.toml declares MIT. No standalone LICENSE file is present upstream. These source files are reference, not a freshly reproduced build of the published binary; binary from pinned iCKB release hashes is the executed artifact. Build requires pinned submodules recorded by upstream.
- iCKB/A2/Owned Owner: native/vendor/ickb/PROVENANCE.json and MIT LICENSE. Release A2 hash matches manifest independently. CCC 1.23.0 official npm tarball integrity and transitive dependency licenses retained through package-lock.json/npm distribution.

These selected sources are a review snapshot, not a replacement for upstream build trees. Clean dependencies can be fetched at the exact commits. No compatibility claim extends to arbitrary upstream HEAD changes.
