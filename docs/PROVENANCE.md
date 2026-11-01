# Library archive provenance and migration limits

Source artifacts from ChatGPT Library, project date October 30, 2026:

- WO01: https://chatgpt.com/library?file_id=libfile_30a5622c13a48191b215c37e5e3d6e95&account_id=personal
- WO02 decision: https://chatgpt.com/library?file_id=libfile_4bebde1386a4819198034d25de600547&account_id=personal
- WO02 original archive (damaged/non-openable): https://chatgpt.com/library?file_id=libfile_253c86a5785c8191bcc03185d81cd693&account_id=personal
- WO03: https://chatgpt.com/library?file_id=libfile_98d66628b17081919cc9d430b08414c0&account_id=personal
- WO04 recovered partial: https://chatgpt.com/library?file_id=libfile_e9592f1934f481919af72b81c532ff6f&account_id=personal
- WO04-E1 implementation: https://chatgpt.com/library?file_id=libfile_ee4dda00fa5c81919e61cce29b171989&account_id=personal
- WO04-E1 evidence: https://chatgpt.com/library?file_id=libfile_8483a9e9050c8191baceb84a1a818c25&account_id=personal
- WO04-E1 decision: https://chatgpt.com/library?file_id=libfile_fa572e51effc8191837d09cdf994fdf5&account_id=personal

This source migration deliberately EXCLUDES bulky raw RPC transcripts, extensive duplicate historical build/evidence trees, and the damaged WO02 ZIP. The full artifacts remain in the Library. E1 includes compact evidence summaries but not every raw RPC receipt; do not assert exact raw evidence equality based on this reduced repository alone.

Files in this migration bundle have their own `MIGRATION_SHA256SUMS.txt`; the original archive's manifest is not reusable for the selective extraction. Reproduce tests against fresh isolated chains before claiming newly verified results.

Contains public disposable devnet fixture keys that must never be used with real assets or public chains. Inspect any unexpected credentials before pushing to GitHub, even if the repository is private.

## Comprehensive WO05–WO08 reconstruction

The user-supplied recovery manifest is historical evidence only. New isolated implementations, revisions and raw private-chain evidence live in labs/rebuild; the capability registry distinguishes original reports, functional/mechanism-class reconstruction, missing proof and future reuse. Original inaccessible Git objects/files are not recovered or fabricated. Published iCKB/CKB/CCC/xUDT dependencies and licenses are pinned in the native and mechanisms provenance files; compiler variants and path effects are disclosed. Fresh-checkout artifact equality and native reruns are recorded in REBUILD_COMPREHENSIVE_REPRODUCTION.json. They do not establish published-to-source byte equality or resolve blocked arbitrary-history recovery/LO-01 security proof. WO01–WO04 lab contents remain unchanged; current README/state/provenance pointers and .gitignore intentionally differ from the original migration manifest.
