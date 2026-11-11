use anyhow::{anyhow, bail, ensure, Context, Result};
use blake2b_rs::{Blake2b, Blake2bBuilder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sparse_merkle_tree::{
    ckb_smt::SMTBuilder, default_store::DefaultStore, traits::Hasher, CompiledMerkleProof,
    SparseMerkleTree, H256,
};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::{self, Read, Write},
    path::Path,
};

type Tree = SparseMerkleTree<CkbBlake2bHasher, H256, DefaultStore<H256>>;

struct CkbBlake2bHasher(Blake2b);

impl Default for CkbBlake2bHasher {
    fn default() -> Self {
        Self(
            Blake2bBuilder::new(32)
                .personal(b"ckb-default-hash")
                .build(),
        )
    }
}

impl Hasher for CkbBlake2bHasher {
    fn write_h256(&mut self, h: &H256) {
        self.0.update(h.as_slice());
    }
    fn write_byte(&mut self, b: u8) {
        self.0.update(&[b]);
    }
    fn finish(self) -> H256 {
        let mut hash = [0u8; 32];
        self.0.finalize(&mut hash);
        hash.into()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
struct Domain {
    genesis_hash: String,
    market_script_hash: String,
    xudt_type_script_hash: String,
    custody_marker_type_hash: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct PositionJson {
    owner_lock_hash: String,
    balance: String,
    revision: String,
    active: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Request {
    domain: Domain,
    op: u8,
    owners: Vec<PositionJson>,
    updates: Vec<PositionJson>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct Position {
    owner: [u8; 32],
    balance: u64,
    revision: u64,
    active: bool,
}

#[derive(Clone)]
struct KeyedPosition {
    key: H256,
    owner: [u8; 32],
    position: Position,
    value: H256,
}

fn h256_from_hex(s: &str, field: &str) -> Result<H256> {
    ensure!(
        s.len() == 66 && s.starts_with("0x"),
        "{field} must be 0x plus 64 lowercase hex digits"
    );
    ensure!(
        s[2..].bytes().all(|b| !b.is_ascii_uppercase()),
        "{field} must use lowercase hex"
    );
    let bytes = hex::decode(&s[2..]).with_context(|| format!("invalid {field}"))?;
    let array: [u8; 32] = bytes
        .try_into()
        .map_err(|_| anyhow!("{field} must be 32 bytes"))?;
    Ok(H256::from(array))
}

fn owner_bytes(s: &str) -> Result<[u8; 32]> {
    Ok(h256_from_hex(s, "owner_lock_hash")?.into())
}

fn fmt_h256(value: H256) -> String {
    format!("0x{}", hex::encode(value.as_slice()))
}

fn parse_balance(s: &str) -> Result<u64> {
    ensure!(
        !s.is_empty(),
        "balance must be a canonical unsigned decimal string"
    );
    ensure!(
        s == "0" || !s.starts_with('0'),
        "balance must not have leading zeroes"
    );
    ensure!(
        s.bytes().all(|b| b.is_ascii_digit()),
        "balance must be a canonical unsigned decimal string"
    );
    s.parse::<u64>().context("balance exceeds u64")
}

fn parse_revision(s: &str) -> Result<u64> {
    ensure!(
        !s.is_empty(),
        "revision must be a canonical unsigned decimal string"
    );
    ensure!(
        s == "0" || !s.starts_with('0'),
        "revision must not have leading zeroes"
    );
    ensure!(
        s.bytes().all(|b| b.is_ascii_digit()),
        "revision must be a canonical unsigned decimal string"
    );
    s.parse::<u64>().context("revision exceeds u64")
}

fn domain_bytes(domain: &Domain) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(128);
    for (field, value) in [
        ("market_script_hash", &domain.market_script_hash),
        ("xudt_type_script_hash", &domain.xudt_type_script_hash),
        ("genesis_hash", &domain.genesis_hash),
        ("custody_marker_type_hash", &domain.custody_marker_type_hash),
    ] {
        out.extend_from_slice(h256_from_hex(value, field)?.as_slice());
    }
    Ok(out)
}

fn hash_bytes(bytes: &[u8]) -> H256 {
    let mut hasher = CkbBlake2bHasher::default();
    for byte in bytes {
        hasher.write_byte(*byte);
    }
    hasher.finish()
}

fn derive_key(domain: &[u8], owner: &[u8; 32]) -> H256 {
    let mut preimage = b"TRADE-V2-XUDT-OWNER-KEY-v1".to_vec();
    preimage.extend_from_slice(domain);
    preimage.extend_from_slice(owner);
    hash_bytes(&preimage)
}

fn leaf_value(position: &Position) -> H256 {
    let mut value = [0u8; 32];
    value[..8].copy_from_slice(&position.balance.to_le_bytes());
    value[8..16].copy_from_slice(&position.revision.to_le_bytes());
    value[16] = if position.active { 1 } else { 2 };
    H256::from(value)
}

fn parse_position(record: &PositionJson) -> Result<Position> {
    let balance = parse_balance(&record.balance)?;
    let revision = parse_revision(&record.revision)?;
    let owner = owner_bytes(&record.owner_lock_hash)?;
    ensure!(
        (record.active && balance > 0) || (!record.active && balance == 0 && revision > 0),
        "active records need a positive balance; tombstones need zero balance and nonzero revision"
    );
    Ok(Position {
        owner,
        balance,
        revision,
        active: record.active,
    })
}

fn keyed_position(domain: &[u8], record: &PositionJson) -> Result<KeyedPosition> {
    let position = parse_position(record)?;
    let key = derive_key(domain, &position.owner);
    let value = leaf_value(&position);
    ensure!(
        !value.is_zero(),
        "non-membership must use the reserved all-zero value"
    );
    Ok(KeyedPosition {
        key,
        owner: position.owner,
        position,
        value,
    })
}

fn add_total(total: u64, position: &Position) -> Result<u64> {
    if position.active {
        total
            .checked_add(position.balance)
            .ok_or_else(|| anyhow!("entitlement total overflows u64"))
    } else {
        Ok(total)
    }
}

fn position_json(position: Option<&Position>) -> JsonValue {
    match position {
        Some(p) => json!({
            "balance": p.balance.to_string(),
            "revision": p.revision.to_string(),
            "active": p.active,
        }),
        None => json!({"balance":"0","revision":"0","active":false}),
    }
}

fn sorted_unique_positions(
    domain: &[u8],
    records: &[PositionJson],
    label: &str,
) -> Result<BTreeMap<H256, KeyedPosition>> {
    let mut by_key = BTreeMap::new();
    let mut owners = HashSet::new();
    for record in records {
        let keyed = keyed_position(domain, record)?;
        ensure!(
            owners.insert(keyed.owner),
            "duplicate owner identity in {label}"
        );
        ensure!(
            !by_key.contains_key(&keyed.key),
            "owner-key collision in {label}"
        );
        by_key.insert(keyed.key, keyed);
    }
    Ok(by_key)
}

fn build_proof(request: &Request) -> Result<JsonValue> {
    build_proof_with_revision_check(request, true)
}

fn build_adversarial_proof(request: &Request) -> Result<JsonValue> {
    build_proof_with_revision_check(request, false)
}

fn build_proof_with_revision_check(request: &Request, check_revisions: bool) -> Result<JsonValue> {
    let domain = domain_bytes(&request.domain)?;
    ensure!(
        request.op <= 8,
        "operation code must be in the contract enum range 0..=8"
    );
    ensure!(
        !request.updates.is_empty(),
        "at least one update is required"
    );
    ensure!(
        request.updates.len() <= 16,
        "transition exceeds the native contract's 16-update bound"
    );

    let owners = sorted_unique_positions(&domain, &request.owners, "owners")?;
    let updates = sorted_unique_positions(&domain, &request.updates, "updates")?;
    ensure!(
        updates.len() == request.updates.len(),
        "duplicate update owner"
    );
    if request.op == 0 {
        ensure!(owners.is_empty(), "initialization must start from the authenticated empty tree");
        ensure!(updates.len() == 1, "market initialization creates exactly one owner leaf");
    }

    let mut tree = Tree::default();
    let mut total_before = 0u64;
    let mut active_before = 0usize;
    for entry in owners.values() {
        tree.update(entry.key, entry.value)
            .context("insert owner into SMT")?;
        total_before = add_total(total_before, &entry.position)?;
        active_before += usize::from(entry.position.active);
    }
    let old_root = *tree.root();

    let mut old_values = Vec::with_capacity(updates.len());
    let mut new_values = Vec::with_capacity(updates.len());
    let mut update_rows = Vec::with_capacity(updates.len());
    let mut total_after = total_before;
    let mut active_after = active_before;

    for (key, update) in &updates {
        let old = owners.get(key).map(|row| &row.position);
        if let Some(previous) = old {
            let expected = previous
                .revision
                .checked_add(1)
                .ok_or_else(|| anyhow!("owner revision overflow"))?;
            if check_revisions {
                ensure!(
                    update.position.revision == expected,
                    "existing owner update must advance revision exactly once"
                );
            }
        } else {
            let initial_revision = if request.op == 0 { 0 } else { 1 };
            ensure!(
                update.position.active && update.position.revision == initial_revision,
                "new owner must be active at revision zero only during initialization, otherwise revision one"
            );
        }
        let old_value = owners
            .get(key)
            .map(|row| row.value)
            .unwrap_or_else(H256::zero);
        old_values.push((*key, old_value));
        new_values.push((*key, update.value));

        if let Some(previous) = old {
            if previous.active {
                active_after -= 1;
            }
            total_after = if previous.active {
                total_after
                    .checked_sub(previous.balance)
                    .ok_or_else(|| anyhow!("internal entitlement total underflow"))?
            } else {
                total_after
            };
        }
        total_after = total_after
            .checked_add(if update.position.active {
                update.position.balance
            } else {
                0
            })
            .ok_or_else(|| anyhow!("entitlement total overflows u64"))?;
        if update.position.active {
            active_after += 1;
        }

        update_rows.push(json!({
            "owner_lock_hash": format!("0x{}", hex::encode(update.owner)),
            "key": fmt_h256(*key),
            "old": position_json(old),
            "new": position_json(Some(&update.position)),
            "old_value": fmt_h256(old_value),
            "new_value": fmt_h256(update.value),
        }));
    }

    let keys = updates.keys().copied().collect::<Vec<_>>();
    let compiled: CompiledMerkleProof = tree
        .merkle_proof(keys.clone())
        .context("generate multi-key proof")?
        .compile(keys.clone())
        .context("compile native SMT proof")?;
    let proof_bytes: Vec<u8> = compiled.clone().into();
    let old_verified = compiled
        .verify::<CkbBlake2bHasher>(&old_root, old_values.clone())
        .context("verify old root")?;
    ensure!(old_verified, "compiled proof does not reconstruct old root");

    let mut next_tree = tree;
    for (key, update) in &updates {
        next_tree
            .update(*key, update.value)
            .context("apply owner update")?;
    }
    let new_root = *next_tree.root();
    let new_verified = compiled
        .verify::<CkbBlake2bHasher>(&new_root, new_values.clone())
        .context("verify new root")?;
    ensure!(
        new_verified,
        "compiled proof does not reconstruct successor root"
    );

    let proof_old_root = compiled
        .compute_root::<CkbBlake2bHasher>(old_values.clone())
        .context("compute old root from proof")?;
    let proof_new_root = compiled
        .compute_root::<CkbBlake2bHasher>(new_values.clone())
        .context("compute new root from proof")?;
    ensure!(
        proof_old_root == old_root && proof_new_root == new_root,
        "proof-computed root differs from tree root"
    );

    let mut old_builder = SMTBuilder::new();
    for (key, value) in &old_values {
        old_builder = old_builder
            .insert(key, value)
            .map_err(|e| anyhow!("CSMT old pair insertion failed: {e}"))?;
    }
    let old_c_smt = old_builder
        .build()
        .map_err(|e| anyhow!("CSMT old state construction failed: {e}"))?;
    old_c_smt
        .verify(&old_root, &proof_bytes)
        .map_err(|e| anyhow!("CSMT rejected old proof with code {e}"))?;
    let mut new_builder = SMTBuilder::new();
    for (key, value) in &new_values {
        new_builder = new_builder
            .insert(key, value)
            .map_err(|e| anyhow!("CSMT new pair insertion failed: {e}"))?;
    }
    let new_c_smt = new_builder
        .build()
        .map_err(|e| anyhow!("CSMT new state construction failed: {e}"))?;
    new_c_smt
        .verify(&new_root, &proof_bytes)
        .map_err(|e| anyhow!("CSMT rejected successor proof with code {e}"))?;

    let count = u8::try_from(updates.len()).context("native update count does not fit u8")?;
    let proof_len =
        u32::try_from(proof_bytes.len()).context("compiled proof length does not fit u32")?;
    let mut witness = Vec::with_capacity(12 + updates.len() * 96 + proof_bytes.len());
    witness.extend_from_slice(b"TMS1");
    witness.push(1); // contract witness version
    witness.push(request.op);
    witness.push(count);
    witness.push(0); // reserved
    witness.extend_from_slice(&proof_len.to_le_bytes());
    for (_, update) in &updates {
        let old_value = owners
            .get(&update.key)
            .map(|row| row.value)
            .unwrap_or_else(H256::zero);
        witness.extend_from_slice(&update.owner);
        witness.extend_from_slice(old_value.as_slice());
        witness.extend_from_slice(update.value.as_slice());
    }
    witness.extend_from_slice(&proof_bytes);
    ensure!(
        witness.len() <= 65_536,
        "contract witness exceeds TRADE_SMT_MAX_WITNESS"
    );

    Ok(json!({
        "format": "trade-v2-smt-transition-v1",
        "tree": "nervos-sparse-merkle-tree-0.6.1",
        "tree_hash_personalization": "ckb-default-hash",
        "key_order": "sparse-merkle-tree-H256-Ord",
        "domain": request.domain,
        "operation": request.op,
        "old_root": fmt_h256(old_root),
        "new_root": fmt_h256(new_root),
        "total_before": total_before.to_string(),
        "total_after": total_after.to_string(),
        "active_owners_before": active_before,
        "active_owners_after": active_after,
        "registered_records_before": owners.len(),
        "updates": update_rows,
        "proof": {
            "encoding": "Nervos sparse-merkle-tree CompiledMerkleProof opcodes",
            "hex": format!("0x{}", hex::encode(&proof_bytes)),
            "bytes": proof_bytes.len(),
            "old_root_verified": old_verified,
            "new_root_verified": new_verified,
            "csmt_old_root_verified": true,
            "csmt_new_root_verified": true,
        },
        "contract_witness": {
            "encoding": "TMS1/version/op/count/reserved/proof_len/owner-oldValue-newValue/proof",
            "hex": format!("0x{}", hex::encode(&witness)),
            "bytes": witness.len(),
        },
    }))
}

fn test_hash(tag: &[u8], n: u64) -> H256 {
    let mut data = tag.to_vec();
    data.extend_from_slice(&n.to_le_bytes());
    hash_bytes(&data)
}

fn bench_request(owners: usize, updates: usize) -> Result<Request> {
    ensure!(
        owners > 0 && updates > 0,
        "owners and updates must be positive"
    );
    let domain = Domain {
        genesis_hash: format!("0x{}", "11".repeat(32)),
        market_script_hash: format!("0x{}", "22".repeat(32)),
        xudt_type_script_hash: format!("0x{}", "33".repeat(32)),
        custody_marker_type_hash: format!("0x{}", "44".repeat(32)),
    };
    let domain_bytes = domain_bytes(&domain)?;
    let mut all = Vec::with_capacity(owners.max(updates));
    for i in 0..owners.max(updates) {
        let owner = test_hash(b"TRADE-V2-SMT-BENCH-OWNER-V1\0", i as u64);
        let active = i < owners;
        all.push(PositionJson {
            owner_lock_hash: fmt_h256(owner),
            balance: if active { "1" } else { "0" }.to_owned(),
            revision: if active { "0" } else { "0" }.to_owned(),
            active,
        });
    }
    let mut owner_rows = all[..owners].to_vec();
    owner_rows.sort_by_key(|r| {
        derive_key(
            &domain_bytes,
            &owner_bytes(&r.owner_lock_hash).expect("generated owner hash"),
        )
    });
    let mut update_rows = Vec::with_capacity(updates);
    for row in all.iter().take(updates) {
        let owner = owner_bytes(&row.owner_lock_hash)?;
        let active_before = row.active;
        let balance = if active_before { "2" } else { "1" };
        let revision = "1";
        update_rows.push(PositionJson {
            owner_lock_hash: row.owner_lock_hash.clone(),
            balance: balance.to_owned(),
            revision: revision.to_owned(),
            active: true,
        });
        let _ = owner;
    }
    update_rows.sort_by_key(|r| {
        derive_key(
            &domain_bytes,
            &owner_bytes(&r.owner_lock_hash).expect("generated owner hash"),
        )
    });
    Ok(Request {
        domain,
        op: 2,
        owners: owner_rows,
        updates: update_rows,
    })
}

fn benchmark() -> Result<JsonValue> {
    let mut rows = Vec::new();
    for owners in [1usize, 3, 8, 32, 128, 1024] {
    for updates in [1usize, 3, 8, 16] {
            let request = bench_request(owners, updates)?;
            let result = build_proof(&request)?;
            let proof = &result["proof"];
            rows.push(json!({
                "owners_before": owners,
                "updates": updates,
                "owners_after": result["active_owners_after"],
                "total_before": result["total_before"],
                "total_after": result["total_after"],
                "proof_bytes": proof["bytes"],
                "contract_witness_bytes": result["contract_witness"]["bytes"],
                "old_root": result["old_root"],
                "new_root": result["new_root"],
                "old_root_verified": proof["old_root_verified"],
                "new_root_verified": proof["new_root_verified"],
            }));
        }
    }
    Ok(json!({
        "format": "trade-v2-smt-size-benchmark-v1",
        "tree": "nervos-sparse-merkle-tree-0.6.1",
        "disclaimer": "Off-chain proof size and library verification only; no CKB-VM cycle or contract measurement.",
        "rows": rows,
    }))
}

fn read_json(path: Option<&str>) -> Result<String> {
    match path {
        Some("-") | None => {
            let mut input = String::new();
            io::stdin().read_to_string(&mut input)?;
            Ok(input)
        }
        Some(path) => fs::read_to_string(path).with_context(|| format!("read {path}")),
    }
}

fn emit(value: &JsonValue, path: Option<&str>) -> Result<()> {
    let data = format!("{}\n", serde_json::to_string_pretty(value)?);
    match path {
        Some("-") | None => io::stdout().write_all(data.as_bytes())?,
        Some(path) => fs::write(Path::new(path), data).with_context(|| format!("write {path}"))?,
    }
    Ok(())
}

fn run() -> Result<()> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    match args.first().map(String::as_str) {
        Some("proof") if args.len() == 2 || args.len() == 3 => {
            let text = read_json(Some(&args[1]))?;
            let request: Request = serde_json::from_str(&text).context("parse transition JSON")?;
            let proof = build_proof(&request)?;
            emit(&proof, args.get(2).map(String::as_str))
        }
        Some("proof-adversarial-revision") if args.len() == 2 || args.len() == 3 => {
            let text = read_json(Some(&args[1]))?;
            let request: Request = serde_json::from_str(&text).context("parse transition JSON")?;
            let proof = build_adversarial_proof(&request)?;
            emit(&proof, args.get(2).map(String::as_str))
        }
        Some("bench") if args.len() <= 2 => emit(&benchmark()?, args.get(1).map(String::as_str)),
        Some("help") | Some("--help") | Some("-h") | None => {
            println!("trade-v2-smt-tools\n  proof <input.json|-> [output.json|-]\n  proof-adversarial-revision <input.json|-> [output.json|-]\n  bench [output.json|-]\n\n`proof-adversarial-revision` is test-only and skips owner revision progression validation. Use `cargo test --locked` for deterministic vectors. `bench` reports proof bytes, not CKB-VM cycles.");
            Ok(())
        }
        _ => bail!("usage: trade-v2-smt-tools proof <input.json|-> [output.json|-] | proof-adversarial-revision <input.json|-> [output.json|-] | bench [output.json|-]"),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("error: {error:#}");
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn domain(market_byte: &str) -> Domain {
        Domain {
            genesis_hash: format!("0x{}", "11".repeat(32)),
            market_script_hash: format!("0x{}", market_byte.repeat(32)),
            xudt_type_script_hash: format!("0x{}", "33".repeat(32)),
            custody_marker_type_hash: format!("0x{}", "44".repeat(32)),
        }
    }

    fn owner(i: u8) -> String {
        format!("0x{}", format!("{i:02x}").repeat(32))
    }

    fn request() -> Request {
        Request {
            domain: domain("22"),
            op: 2,
            owners: vec![
                PositionJson {
                    owner_lock_hash: owner(2),
                    balance: "9".into(),
                    revision: "0".into(),
                    active: true,
                },
                PositionJson {
                    owner_lock_hash: owner(1),
                    balance: "4".into(),
                    revision: "3".into(),
                    active: true,
                },
            ],
            updates: vec![
                PositionJson {
                    owner_lock_hash: owner(3),
                    balance: "5".into(),
                    revision: "1".into(),
                    active: true,
                },
                PositionJson {
                    owner_lock_hash: owner(1),
                    balance: "2".into(),
                    revision: "4".into(),
                    active: true,
                },
            ],
        }
    }

    #[test]
    fn generated_old_and_new_roots_match_library_tree_and_compiled_proof() {
        let out = build_proof(&request()).expect("proof");
        assert_eq!(out["proof"]["old_root_verified"], true);
        assert_eq!(out["proof"]["new_root_verified"], true);
        assert_eq!(out["total_before"], "13");
        assert_eq!(out["total_after"], "16");
        assert_eq!(out["proof"]["csmt_old_root_verified"], true);
        assert_eq!(out["proof"]["csmt_new_root_verified"], true);
        let witness = hex::decode(
            out["contract_witness"]["hex"]
                .as_str()
                .unwrap()
                .trim_start_matches("0x"),
        )
        .unwrap();
        assert_eq!(&witness[..4], b"TMS1");
        assert_eq!(witness[4], 1);
        assert_eq!(witness[5], 2);
        assert_eq!(witness[6], 2);
        assert_eq!(witness[7], 0);
        assert_eq!(
            u32::from_le_bytes(witness[8..12].try_into().unwrap()) as usize,
            out["proof"]["bytes"].as_u64().unwrap() as usize
        );
        assert_ne!(out["old_root"], out["new_root"]);
    }

    #[test]
    fn input_order_does_not_change_proof_or_roots() {
        let mut a = request();
        let mut b = request();
        a.owners.reverse();
        b.updates.reverse();
        assert_eq!(build_proof(&a).expect("a"), build_proof(&b).expect("b"));
    }

    #[test]
    fn domain_change_changes_owner_key_and_leaf_commitment() {
        let d1 = domain_bytes(&domain("22")).expect("domain");
        let d2 = domain_bytes(&domain("23")).expect("domain");
        let who = owner_bytes(&owner(1)).expect("owner");
        assert_ne!(derive_key(&d1, &who), derive_key(&d2, &who));
    }

    #[test]
    fn duplicate_owner_and_stale_revision_are_rejected() {
        let mut duplicate = request();
        duplicate.owners.push(duplicate.owners[0].clone());
        assert!(build_proof(&duplicate).is_err());

        let mut stale = request();
        stale.updates[1].revision = "3".into();
        assert!(build_proof(&stale).is_err());
    }

    #[test]
    fn absent_owner_revision_is_zero_only_at_initialization() {
        let mut invalid = request();
        invalid.updates[0].revision = "0".into();
        assert!(build_proof(&invalid).is_err());
        invalid.updates[0].revision = "1".into();
        assert!(build_proof(&invalid).is_ok());
        let initial = Request {
            domain: domain("22"),
            op: 0,
            owners: vec![],
            updates: vec![PositionJson {
                owner_lock_hash: owner(9),
                balance: "5".into(),
                revision: "0".into(),
                active: true,
            }],
        };
        assert!(build_proof(&initial).is_ok());
    }

    #[test]
    fn tombstone_keeps_revision_and_can_only_reactivate_at_next_revision() {
        let mut retire = request();
        retire.updates[1] = PositionJson {
            owner_lock_hash: owner(1),
            balance: "0".into(),
            revision: "4".into(),
            active: false,
        };
        let retired = build_proof(&retire).expect("retire owner");
        assert_eq!(retired["total_before"], "13");
        assert_eq!(retired["total_after"], "14");
        let tombstone = retired["updates"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["owner_lock_hash"] == owner(1))
            .unwrap();
        assert_eq!(tombstone["new"]["active"], false);
        let tombstone_value = hex::decode(
            tombstone["new_value"]
                .as_str()
                .unwrap()
                .trim_start_matches("0x"),
        )
        .unwrap();
        assert_eq!(tombstone_value.len(), 32);
        assert_eq!(tombstone_value[16], 2);
        assert_eq!(
            u64::from_le_bytes(tombstone_value[8..16].try_into().unwrap()),
            4
        );
        assert!(tombstone_value[17..].iter().all(|byte| *byte == 0));

        let reactivate = Request {
            domain: request().domain,
            op: 6,
            owners: vec![
                PositionJson {
                    owner_lock_hash: owner(1),
                    balance: "0".into(),
                    revision: "4".into(),
                    active: false,
                },
                PositionJson {
                    owner_lock_hash: owner(2),
                    balance: "9".into(),
                    revision: "0".into(),
                    active: true,
                },
                PositionJson {
                    owner_lock_hash: owner(3),
                    balance: "5".into(),
                    revision: "0".into(),
                    active: true,
                },
            ],
            updates: vec![PositionJson {
                owner_lock_hash: owner(1),
                balance: "3".into(),
                revision: "5".into(),
                active: true,
            }],
        };
        let reactivated = build_proof(&reactivate).expect("reactivate after tombstone");
        assert_eq!(reactivated["total_before"], "14");
        assert_eq!(reactivated["total_after"], "17");
        assert_eq!(reactivated["proof"]["csmt_new_root_verified"], true);
    }

    #[test]
    fn proof_size_matrix_is_deterministic_and_covers_requested_scales() {
        let a = benchmark().expect("benchmark");
        let b = benchmark().expect("benchmark");
        assert_eq!(a, b);
        assert_eq!(a["rows"].as_array().expect("rows").len(), 24);
        for row in a["rows"].as_array().expect("rows") {
            assert!(row["proof_bytes"].as_u64().unwrap() > 0);
            assert_eq!(row["old_root_verified"], true);
            assert_eq!(row["new_root_verified"], true);
        }
    }
}
