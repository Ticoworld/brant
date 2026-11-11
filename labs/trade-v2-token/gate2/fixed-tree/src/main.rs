use anyhow::{bail, ensure, Result};
use blake2b_rs::{Blake2b, Blake2bBuilder};
use sparse_merkle_tree::{
    default_store::DefaultStore, traits::Hasher, CompiledMerkleProof, SparseMerkleTree, H256,
};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::PathBuf;

type Smt = SparseMerkleTree<CkbHasher, H256, DefaultStore<H256>>;
const TEST_DOMAIN: [u8; 32] = [0x42; 32];
struct CkbHasher(Blake2b);
impl Default for CkbHasher {
    fn default() -> Self {
        Self(
            Blake2bBuilder::new(32)
                .personal(b"ckb-default-hash")
                .build(),
        )
    }
}
impl Hasher for CkbHasher {
    fn write_h256(&mut self, h: &H256) {
        self.0.update(h.as_slice());
    }
    fn write_byte(&mut self, b: u8) {
        self.0.update(&[b]);
    }
    fn finish(self) -> H256 {
        let mut out = [0; 32];
        self.0.finalize(&mut out);
        out.into()
    }
}

#[derive(Clone, Debug)]
struct Owner {
    id: [u8; 32],
    slot: u16,
    balance: u64,
    revision: u64,
    status: u8,
}
fn ckb_hash(bytes: &[u8]) -> [u8; 32] {
    let mut h = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    h.update(bytes);
    let mut out = [0; 32];
    h.finalize(&mut out);
    out
}
fn h256(bytes: [u8; 32]) -> H256 {
    H256::from(bytes)
}
fn reg_key(domain: &[u8; 32], owner: &[u8; 32]) -> H256 {
    h256(ckb_hash(
        &[b"TRADE-V2-OWNER-SLOT-REGISTRY-v1".as_slice(), domain, owner].concat(),
    ))
}
fn reg_value(slot: Option<u16>) -> H256 {
    let mut v = [0u8; 32];
    if let Some(s) = slot {
        v[..2].copy_from_slice(&(s + 1).to_le_bytes());
    }
    H256::from(v)
}
fn reg_slot(v: H256) -> Result<Option<u16>> {
    let b = v.as_slice();
    ensure!(
        b[2..].iter().all(|x| *x == 0),
        "registry value padding must be zero"
    );
    let n = u16::from_le_bytes([b[0], b[1]]);
    Ok(if n == 0 { None } else { Some(n - 1) })
}
fn leaf_bytes(o: &Owner) -> [u8; 64] {
    let mut x = [0u8; 64];
    x[..32].copy_from_slice(&o.id);
    x[32..40].copy_from_slice(&o.balance.to_le_bytes());
    x[40..48].copy_from_slice(&o.revision.to_le_bytes());
    x[48] = o.status;
    x
}
fn leaf_hash(domain: &[u8; 32], slot: u16, owner: Option<&Owner>) -> [u8; 32] {
    let mut p = Vec::with_capacity(103);
    p.extend_from_slice(b"TRADE-FIXED-LEAF-v1");
    p.extend_from_slice(domain);
    p.extend_from_slice(&slot.to_le_bytes());
    if let Some(o) = owner {
        p.extend_from_slice(&leaf_bytes(o));
    } else {
        p.extend_from_slice(&[0u8; 64]);
    }
    ckb_hash(&p)
}
fn node_hash(domain: &[u8; 32], depth: u8, left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut p = Vec::with_capacity(66);
    p.extend_from_slice(b"TRADE-FIXED-NODE-v1");
    p.extend_from_slice(domain);
    p.push(depth);
    p.extend_from_slice(left);
    p.extend_from_slice(right);
    ckb_hash(&p)
}

fn fixed_levels(domain: &[u8; 32], depth: u8, owners: &[Owner]) -> Result<Vec<Vec<[u8; 32]>>> {
    ensure!(
        (depth == 10 || depth == 12) && owners.len() <= (1usize << depth),
        "owner count exceeds fixed-tree capacity"
    );
    let width = 1usize << depth;
    let mut slots = BTreeMap::new();
    let mut ids = BTreeSet::new();
    for o in owners {
        ensure!((o.slot as usize) < width, "slot exceeds fixed-tree depth");
        ensure!(ids.insert(o.id), "duplicate owner ID in slot tree");
        ensure!(
            slots.insert(o.slot, o).is_none(),
            "duplicate slot assignment"
        );
    }
    let width = 1usize << depth;
    let mut levels: Vec<Vec<[u8; 32]>> = Vec::with_capacity(depth as usize + 1);
    levels.push(
        (0..width)
            .map(|i| leaf_hash(domain, i as u16, slots.get(&(i as u16)).copied()))
            .collect(),
    );
    for l in 0..depth {
        let prev = &levels[l as usize];
        let mut next = Vec::with_capacity(prev.len() / 2);
        for pair in prev.chunks_exact(2) {
            next.push(node_hash(domain, l + 1, &pair[0], &pair[1]));
        }
        levels.push(next);
    }
    Ok(levels)
}

// Canonical proof: at each level from leaf upward, scan active node indices ascending and
// append the opposite subtree hash only when that opposite index is not also updated.
fn fixed_multiproof(levels: &[Vec<[u8; 32]>], slots: &[u16]) -> Result<Vec<u8>> {
    let mut active = slots.iter().map(|s| *s as usize).collect::<BTreeSet<_>>();
    ensure!(!active.is_empty(), "empty multiproof");
    ensure!(
        slots.windows(2).all(|w| w[0] < w[1]),
        "multiproof slots must be strictly sorted"
    );
    ensure!(
        slots.iter().all(|s| (*s as usize) < levels[0].len()),
        "slot exceeds fixed-tree depth"
    );
    ensure!(
        active.len() == slots.len(),
        "duplicate or reordered slot in multiproof"
    );
    let mut out = Vec::new();
    for l in 0..levels.len() - 1 {
        let mut parents = BTreeSet::new();
        for i in active.iter().copied() {
            let sib = i ^ 1;
            if !active.contains(&sib) {
                out.extend_from_slice(&levels[l][sib]);
            }
            parents.insert(i / 2);
        }
        active = parents;
    }
    Ok(out)
}
fn fixed_root_from_proof(
    domain: &[u8; 32],
    depth: u8,
    slots: &[u16],
    leaves: &[[u8; 32]],
    proof: &[u8],
) -> Result<[u8; 32]> {
    ensure!(
        (depth == 10 || depth == 12) && slots.len() == leaves.len() && !slots.is_empty(),
        "slot/leaf cardinality mismatch"
    );
    ensure!(
        slots.windows(2).all(|w| w[0] < w[1]),
        "root slots must be strictly sorted"
    );
    ensure!(
        slots.iter().all(|s| (*s as usize) < (1usize << depth)),
        "slot exceeds fixed-tree depth"
    );
    let mut cur = BTreeMap::new();
    for (i, s) in slots.iter().enumerate() {
        ensure!(
            cur.insert(*s as usize, leaves[i]).is_none(),
            "duplicate slot"
        );
    }
    let mut p = 0usize;
    for l in 0..depth {
        let keys = cur.keys().copied().collect::<Vec<_>>();
        let mut next = BTreeMap::new();
        let mut done = BTreeSet::new();
        for i in keys {
            if done.contains(&i) {
                continue;
            }
            let sib = i ^ 1;
            let (left, right) = if let Some(sibling) = cur.get(&sib) {
                done.insert(sib);
                if i % 2 == 0 {
                    (cur[&i], *sibling)
                } else {
                    (*sibling, cur[&i])
                }
            } else {
                ensure!(p + 32 <= proof.len(), "truncated fixed-tree multiproof");
                let mut h = [0; 32];
                h.copy_from_slice(&proof[p..p + 32]);
                p += 32;
                done.insert(i);
                if i % 2 == 0 {
                    (cur[&i], h)
                } else {
                    (h, cur[&i])
                }
            };
            let parent = i / 2;
            ensure!(
                next.insert(parent, node_hash(domain, l + 1, &left, &right))
                    .is_none(),
                "non-canonical overlapping multiproof"
            );
        }
        cur = next;
    }
    ensure!(p == proof.len(), "unused fixed-tree proof bytes");
    ensure!(cur.len() == 1, "fixed-tree root missing");
    Ok(cur[&0])
}

fn make_smt(domain: &[u8; 32], owners: &[Owner]) -> Result<Smt> {
    let mut t = Smt::default();
    let mut seen = BTreeSet::new();
    for o in owners {
        let key = reg_key(domain, &o.id);
        ensure!(seen.insert(key), "duplicate owner registry key");
        t.update(key, reg_value(Some(o.slot)))?;
    }
    Ok(t)
}
fn smt_proof(
    domain: &[u8; 32],
    old: &Smt,
    owners: &[Owner],
    changed: &[Owner],
    newly_enrolled: &[Owner],
) -> Result<(usize, [u8; 32], [u8; 32])> {
    let mut keys = changed
        .iter()
        .chain(newly_enrolled.iter())
        .map(|o| reg_key(domain, &o.id))
        .collect::<Vec<_>>();
    keys.sort_by(|a, b| b.as_slice().cmp(a.as_slice()));
    keys.dedup();
    ensure!(
        keys.len() == changed.len() + newly_enrolled.len(),
        "duplicate identity in registry proof rows"
    );
    let mut old_vals = Vec::new();
    for o in changed {
        let key = reg_key(domain, &o.id);
        let stored = old.get(&key)?;
        ensure!(
            reg_slot(stored)? == Some(o.slot),
            "old owner registry slot mismatch"
        );
        old_vals.push((key, stored));
    }
    for o in newly_enrolled {
        let key = reg_key(domain, &o.id);
        let stored = old.get(&key)?;
        ensure!(reg_slot(stored)?.is_none(), "new owner already has a slot");
        old_vals.push((key, stored));
    }
    old_vals.sort_by(|a, b| b.0.as_slice().cmp(a.0.as_slice()));
    let proof: CompiledMerkleProof = old.merkle_proof(keys.clone())?.compile(keys.clone())?;
    let bytes: Vec<u8> = proof.clone().into();
    // Canonical owner-key order matches sparse-merkle-tree's H256 Ord. Verify old map.
    let sorted_old = keys
        .iter()
        .map(|k| {
            (
                *k,
                old_vals
                    .iter()
                    .find(|x| x.0 == *k)
                    .expect("owner old registry value")
                    .1,
            )
        })
        .collect::<Vec<_>>();
    ensure!(
        proof.verify::<CkbHasher>(old.root(), sorted_old.clone())?,
        "old owner registry multiproof rejected"
    );
    let mut next_owners = owners.to_vec();
    next_owners.extend_from_slice(newly_enrolled);
    let next = make_smt(domain, &next_owners)?;
    let new_vals = keys
        .iter()
        .map(|k| {
            let o = changed
                .iter()
                .chain(newly_enrolled.iter())
                .find(|o| reg_key(domain, &o.id) == *k)
                .expect("registry row");
            (*k, reg_value(Some(o.slot)))
        })
        .collect::<Vec<_>>();
    ensure!(
        proof.verify::<CkbHasher>(next.root(), new_vals)?,
        "new owner registry multiproof rejected"
    );
    let _ = owners;

    Ok((bytes.len(), (*old.root()).into(), (*next.root()).into()))
}

fn position_value(owner: Option<&Owner>) -> H256 {
    let mut v = [0u8; 32];
    if let Some(o) = owner {
        v[..8].copy_from_slice(&o.balance.to_le_bytes());
        v[8..16].copy_from_slice(&o.revision.to_le_bytes());
        v[16] = o.status;
    }
    H256::from(v)
}
fn balance_tree(domain: &[u8; 32], owners: &[Owner]) -> Result<Smt> {
    let mut t = Smt::default();
    let mut seen = BTreeSet::new();
    for o in owners {
        let key = reg_key(domain, &o.id);
        ensure!(seen.insert(key), "duplicate owner balance key");
        t.update(key, position_value(Some(o)))?;
    }
    Ok(t)
}
fn balance_smt_proof(
    domain: &[u8; 32],
    old: &Smt,
    next: &Smt,
    changed: &[Owner],
    newly_enrolled: &[Owner],
    initial: &[Owner],
) -> Result<usize> {
    let mut updates = BTreeMap::<H256, (H256, H256)>::new();
    for o in changed {
        let key = reg_key(domain, &o.id);
        let old_owner = initial
            .iter()
            .find(|x| x.id == o.id)
            .expect("changed old owner");
        ensure!(
            updates
                .insert(
                    key,
                    (position_value(Some(old_owner)), position_value(Some(o)))
                )
                .is_none(),
            "duplicate changed account"
        );
    }
    for o in newly_enrolled {
        ensure!(
            updates
                .insert(
                    reg_key(domain, &o.id),
                    (H256::zero(), position_value(Some(o)))
                )
                .is_none(),
            "duplicate new account"
        );
    }
    let keys = updates.keys().copied().collect::<Vec<_>>();
    let old_values = updates
        .iter()
        .map(|(k, (v, _))| (*k, *v))
        .collect::<Vec<_>>();
    let new_values = updates
        .iter()
        .map(|(k, (_, v))| (*k, *v))
        .collect::<Vec<_>>();
    let proof: CompiledMerkleProof = old.merkle_proof(keys.clone())?.compile(keys)?;
    let bytes: Vec<u8> = proof.clone().into();
    ensure!(
        proof.verify::<CkbHasher>(old.root(), old_values)?,
        "owner-keyed old proof failed"
    );
    ensure!(
        proof.verify::<CkbHasher>(next.root(), new_values)?,
        "owner-keyed new proof failed"
    );
    Ok(bytes.len())
}
fn owners_for(n: usize) -> Vec<Owner> {
    (0..n)
        .map(|i| {
            let mut p = b"TRADE-BENCH-OWNER".to_vec();
            p.extend_from_slice(&(i as u32).to_le_bytes());
            let id = ckb_hash(&p);
            Owner {
                id,
                slot: i as u16,
                balance: 1,
                revision: 0,
                status: 1,
            }
        })
        .collect()
}
fn run_row(depth: u8, n: usize, k: usize) -> Result<serde_json::Value> {
    let domain = TEST_DOMAIN;
    let initial = owners_for(n);
    let levels = fixed_levels(&domain, depth, &initial)?;
    let old_root = levels[depth as usize][0];
    let mut after = initial.clone();
    let mut changed = Vec::new();
    let existing = k.min(n);
    // Deterministic spread across current owners; added owners fill previously empty slots.
    let mut selected = BTreeSet::new();
    for j in 0..existing {
        selected.insert(((j * n) / existing.max(1)) as usize);
    }
    for idx in selected {
        let mut o = after[idx].clone();
        o.balance += 1;
        o.revision += 1;
        after[idx] = o.clone();
        changed.push(o);
    }
    let mut added = Vec::new();
    for i in n..k {
        let mut o = owners_for(i + 1).pop().unwrap();
        o.slot = i as u16;
        o.balance = 1;
        o.revision = 0;
        o.status = 1;
        added.push(o.clone());
        after.push(o.clone());
        changed.push(o);
    }
    changed.sort_by_key(|o| o.slot);
    let slots = changed.iter().map(|o| o.slot).collect::<Vec<_>>();
    let old_hashes = changed
        .iter()
        .map(|o| {
            let old = if (o.slot as usize) < n {
                initial.iter().find(|x| x.slot == o.slot)
            } else {
                None
            };
            leaf_hash(&domain, o.slot, old)
        })
        .collect::<Vec<_>>();
    let new_hashes = changed
        .iter()
        .map(|o| leaf_hash(&domain, o.slot, Some(o)))
        .collect::<Vec<_>>();
    let proof = fixed_multiproof(&levels, &slots)?;
    ensure!(
        fixed_root_from_proof(&domain, depth, &slots, &old_hashes, &proof)? == old_root,
        "fixed proof failed old root"
    );
    let full_new = fixed_levels(&domain, depth, &after)?[depth as usize][0];
    ensure!(
        fixed_root_from_proof(&domain, depth, &slots, &new_hashes, &proof)? == full_new,
        "fixed proof failed new root"
    );
    let registry = make_smt(&domain, &initial)?;
    let (registry_proof_bytes, old_registry_root, new_registry_root) =
        smt_proof(&domain, &registry, &initial, &changed[..existing], &added)?;
    let balance_old = balance_tree(&domain, &initial)?;
    let balance_new = balance_tree(&domain, &after)?;
    let balance_proof_bytes = balance_smt_proof(
        &domain,
        &balance_old,
        &balance_new,
        &changed[..existing],
        &added,
        &initial,
    )?;
    let fixed_leaf_rows = changed.len() * 68; // slot(2), owner lock hash(32), old/new balance-revision-status(17 each)
    let registry_rows = changed.len() * 96; // owner map key(32), old value(32), new value(32)
    let header = 16usize; // magic/version/depth/counts/proof length fields
    let fixed_bytes = header + fixed_leaf_rows + proof.len();
    let dual_bytes = fixed_bytes + registry_rows + registry_proof_bytes;
    Ok(serde_json::json!({
       "depth":depth,"owners_before":n,"owners_after":after.len(),"updates":k,
       "fixed_tree_proof_bytes":proof.len(),"fixed_tree_witness_bytes":fixed_bytes,
       "owner_keyed_smt_proof_bytes":balance_proof_bytes,"owner_keyed_smt_witness_bytes":12+changed.len()*96+balance_proof_bytes,
       "owner_registry_smt_proof_bytes":registry_proof_bytes,"dual_tree_witness_bytes":dual_bytes,
       "fixed_root_verified":true,"owner_registry_old_root":format!("0x{}",hex::encode(old_registry_root)),
       "owner_registry_new_root":format!("0x{}",hex::encode(new_registry_root)),
       "unique_owner_slots":after.len()==after.iter().map(|o|o.id).collect::<BTreeSet<_>>().len() && after.len()==after.iter().map(|o|o.slot).collect::<BTreeSet<_>>().len()
    }))
}
fn bench() -> Result<()> {
    let mut rows = Vec::new();
    for depth in [10, 12] {
        for n in [1usize, 3, 8, 32, 128, 1024] {
            for k in [1usize, 3, 8, 16] {
                if n.max(k) > (1usize << depth) {
                    continue;
                }
                rows.push(run_row(depth, n, k)?);
            }
        }
    }
    let out = serde_json::json!({"format":"trade-v2-fixed-depth-indexed-v1","disclaimer":"Rust/off-chain proof bytes and root reconstruction only; not CKB-VM cycles or deployed contract measurements. Each transition verifies a fixed-depth slot multiproof plus a Nervos CSMT owner-to-slot registry proof to enforce uniqueness.","rows":rows});
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("benchmarks/size-matrix.json");
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(path, serde_json::to_vec_pretty(&out)?)?;
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn duplicate_owner_cannot_claim_two_slots() {
        let id = ckb_hash(b"same owner");
        let a = Owner {
            id,
            slot: 0,
            balance: 1,
            revision: 0,
            status: 1,
        };
        let b = Owner {
            id,
            slot: 1,
            balance: 1,
            revision: 0,
            status: 1,
        };
        assert!(fixed_levels(&TEST_DOMAIN, 10, &[a.clone(), b.clone()]).is_err());
        assert!(make_smt(&TEST_DOMAIN, &[a, b]).is_err());
        assert_eq!(reg_slot(reg_value(Some(0))).unwrap(), Some(0));
        assert_eq!(reg_slot(reg_value(Some(1))).unwrap(), Some(1));
    }
    #[test]
    fn fixed_multiproof_proves_old_and_new_roots_for_intersecting_paths() {
        let owners = owners_for(128);
        let levels = fixed_levels(&TEST_DOMAIN, 10, &owners).unwrap();
        let slots = vec![0, 1, 2, 3, 7, 64, 127];
        let proof = fixed_multiproof(&levels, &slots).unwrap();
        let old = slots
            .iter()
            .map(|s| leaf_hash(&TEST_DOMAIN, *s, owners.iter().find(|o| o.slot == *s)))
            .collect::<Vec<_>>();
        assert_eq!(
            fixed_root_from_proof(&TEST_DOMAIN, 10, &slots, &old, &proof).unwrap(),
            levels[10][0]
        );
    }
    #[test]
    fn malformed_and_duplicate_slots_rejected() {
        let owners = owners_for(8);
        let levels = fixed_levels(&TEST_DOMAIN, 10, &owners).unwrap();
        assert!(fixed_multiproof(&levels, &[1, 1]).is_err());
        assert!(fixed_multiproof(&levels, &[2, 1]).is_err());
        assert!(fixed_levels(
            &TEST_DOMAIN,
            10,
            &[Owner {
                slot: 1024,
                ..owners[0].clone()
            }]
        )
        .is_err());
        let proof = fixed_multiproof(&levels, &[1]).unwrap();
        assert!(fixed_root_from_proof(
            &TEST_DOMAIN,
            10,
            &[1],
            &[leaf_hash(&TEST_DOMAIN, 1, Some(&owners[1]))],
            &proof[..proof.len() - 1]
        )
        .is_err());
    }
    #[test]
    fn market_domain_separates_slot_roots_and_owner_registry() {
        let owners = owners_for(8);
        let other = ckb_hash(b"distinct market/xUDT/custody identity");
        let a = fixed_levels(&TEST_DOMAIN, 10, &owners).unwrap();
        let b = fixed_levels(&other, 10, &owners).unwrap();
        assert_ne!(a[10][0], b[10][0]);
        assert_ne!(
            *make_smt(&TEST_DOMAIN, &owners).unwrap().root(),
            *make_smt(&other, &owners).unwrap().root()
        );
        assert_ne!(
            *balance_tree(&TEST_DOMAIN, &owners).unwrap().root(),
            *balance_tree(&other, &owners).unwrap().root()
        );
    }
    #[test]
    fn benchmarks_cover_required_populations_and_updates() {
        for d in [10, 12] {
            for n in [1, 3, 8, 32, 128, 1024] {
                for k in [1, 3, 8, 16] {
                    assert!(
                        run_row(d, n, k).unwrap()["dual_tree_witness_bytes"]
                            .as_u64()
                            .unwrap()
                            > 0
                    );
                }
            }
        }
    }
}
fn main() -> Result<()> {
    match std::env::args().nth(1).as_deref() {
        Some("bench") => bench(),
        _ => bail!("usage: trade-v2-fixed-tree-bench bench"),
    }
}
