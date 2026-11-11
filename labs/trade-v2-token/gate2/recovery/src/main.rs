use anyhow::{anyhow, bail, ensure, Context, Result};
use blake2b_rs::{Blake2b, Blake2bBuilder};
use serde::Deserialize;
use serde_json::{json, Value};
use sparse_merkle_tree::{
    ckb_smt::SMTBuilder, default_store::DefaultStore, traits::Hasher, CompiledMerkleProof,
    SparseMerkleTree, H256,
};
use std::{
    collections::BTreeMap,
    fs,
    io::{self, Read, Write},
    path::Path,
};

type Tree = SparseMerkleTree<CkbHasher, H256, DefaultStore<H256>>;

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
        let mut h = [0u8; 32];
        self.0.finalize(&mut h);
        h.into()
    }
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct Bundle {
    format: String,
    init_tx_hash: String,
    owner_lock_hash: String,
    custody_lock: Value,
    xudt_type_script: Value,
    #[serde(default, rename = "collection")]
    _collection: Option<Value>,
    history: Vec<HistoryRow>,
    live: LiveRow,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct HistoryRow {
    tx_hash: String,
    block_number: String,
    tx_index: String,
    #[serde(default)]
    block_hash: Option<String>,
    transaction: Value,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct LiveRow {
    tx_hash: String,
    index: String,
    #[serde(rename = "capacity")]
    _capacity: String,
    data: String,
    output: Value,
}

#[derive(Clone)]
struct Update {
    owner: [u8; 32],
    key: H256,
    old: H256,
    new: H256,
}
#[derive(Clone)]
struct Position {
    value: H256,
    balance: u64,
    revision: u64,
    active: bool,
}

fn bytes32(s: &str, what: &str) -> Result<[u8; 32]> {
    ensure!(
        s.len() == 66 && s.starts_with("0x"),
        "{what} must be 0x plus 64 hex digits"
    );
    let b = hex::decode(&s[2..]).with_context(|| format!("decode {what}"))?;
    Ok(b.try_into()
        .map_err(|_| anyhow!("{what} must be 32 bytes"))?)
}
fn hex_bytes(s: &str, what: &str) -> Result<Vec<u8>> {
    ensure!(
        s.starts_with("0x") && s.len() % 2 == 0,
        "{what} must be even-length 0x hex"
    );
    hex::decode(&s[2..]).with_context(|| format!("decode {what}"))
}
fn fmt(b: &[u8]) -> String {
    format!("0x{}", hex::encode(b))
}
fn rpc_u64(v: &Value, what: &str) -> Result<u64> {
    let s = v
        .as_str()
        .ok_or_else(|| anyhow!("{what} must be a 0x quantity"))?;
    ensure!(s.starts_with("0x"), "{what} must be hex quantity");
    u64::from_str_radix(&s[2..], 16).with_context(|| format!("parse {what}"))
}
fn ckb_hash(bytes: &[u8]) -> H256 {
    let mut h = CkbHasher::default();
    for b in bytes {
        h.write_byte(*b);
    }
    h.finish()
}
fn script_hash(script: &Value) -> Result<H256> {
    let code = bytes32(
        script["code_hash"]
            .as_str()
            .ok_or_else(|| anyhow!("script code_hash missing"))?,
        "script code_hash",
    )?;
    let ht = match script["hash_type"]
        .as_str()
        .ok_or_else(|| anyhow!("script hash_type missing"))?
    {
        "data" => 0u8,
        "type" => 1,
        "data1" => 2,
        "data2" => 4,
        other => bail!("unknown script hash type {other}"),
    };
    let args = hex_bytes(
        script["args"]
            .as_str()
            .ok_or_else(|| anyhow!("script args missing"))?,
        "script args",
    )?;
    ensure!(args.len() <= u32::MAX as usize, "script args too large");
    // Molecule Script table: offsets [16,48,49,53+args_len], followed by fields.
    let mut data = Vec::with_capacity(53 + args.len());
    data.extend_from_slice(&((53 + args.len()) as u32).to_le_bytes());
    data.extend_from_slice(&16u32.to_le_bytes());
    data.extend_from_slice(&48u32.to_le_bytes());
    data.extend_from_slice(&49u32.to_le_bytes());
    data.extend_from_slice(&code);
    data.push(ht);
    data.extend_from_slice(&(args.len() as u32).to_le_bytes());
    data.extend_from_slice(&args);
    Ok(ckb_hash(&data))
}
fn script_equal(a: &Value, b: &Value) -> Result<bool> {
    Ok(script_hash(a)? == script_hash(b)?)
}
fn ckb_data(cell_data: &str) -> Result<Vec<u8>> {
    hex_bytes(cell_data, "cell data")
}
fn u64le(v: &[u8]) -> Result<u64> {
    ensure!(v.len() >= 8, "leaf value shorter than u64");
    Ok(u64::from_le_bytes(v[..8].try_into().unwrap()))
}
fn zero_h256() -> H256 {
    H256::zero()
}
fn h256_slice(b: &[u8]) -> Result<H256> {
    let a: [u8; 32] = b.try_into().map_err(|_| anyhow!("hash must be 32 bytes"))?;
    Ok(H256::from(a))
}
fn parse_leaf(v: H256) -> Result<Position> {
    let b = v.as_slice();
    let any = b.iter().any(|x| *x != 0);
    if !any {
        return Ok(Position {
            value: v,
            balance: 0,
            revision: 0,
            active: false,
        });
    }
    ensure!(b[17..].iter().all(|x| *x == 0), "noncanonical leaf padding");
    let balance = u64le(b)?;
    let revision = u64le(&b[8..])?;
    match b[16] {
        1 => ensure!(balance > 0, "active leaf must hold positive balance"),
        2 => ensure!(
            balance == 0 && revision > 0,
            "tombstone must have zero balance and a revision"
        ),
        x => bail!("invalid leaf status {x}"),
    }
    Ok(Position {
        value: v,
        balance,
        revision,
        active: b[16] == 1,
    })
}
fn derive_key(domain: &[u8; 128], owner: &[u8; 32]) -> H256 {
    let mut h = CkbHasher::default();
    for b in b"TRADE-V2-XUDT-OWNER-KEY-v1" {
        h.write_byte(*b);
    }
    for b in domain {
        h.write_byte(*b)
    }
    for b in owner {
        h.write_byte(*b)
    }
    h.finish()
}
fn key_less(a: H256, b: H256) -> bool {
    for i in (0..32).rev() {
        if a.as_slice()[i] != b.as_slice()[i] {
            return a.as_slice()[i] < b.as_slice()[i];
        }
    }
    false
}
fn parse_tms1(witnesses: &Value, domain: &[u8; 128]) -> Result<(u8, Vec<Update>, Vec<u8>)> {
    let ws = witnesses
        .as_array()
        .ok_or_else(|| anyhow!("transaction witnesses missing"))?;
    let mut found: Vec<Vec<u8>> = Vec::new();
    for w in ws {
        let raw = hex_bytes(
            w.as_str().ok_or_else(|| anyhow!("witness must be hex"))?,
            "witness",
        )?;
        if raw.len() >= 4 && &raw[..4] == b"TMS1" {
            found.push(raw);
        }
    }
    ensure!(
        found.len() == 1,
        "expected exactly one raw TMS1 witness, found {}",
        found.len()
    );
    let w = &found[0];
    ensure!(w.len() >= 12, "truncated TMS1 header");
    ensure!(w[4] == 1, "unsupported TMS1 version");
    ensure!(w[7] == 0, "nonzero TMS1 reserved byte");
    let op = w[5];
    let count = w[6] as usize;
    ensure!(count > 0 && count <= 16, "TMS1 update count out of bounds");
    let proof_len = u32::from_le_bytes(w[8..12].try_into().unwrap()) as usize;
    let proof_start = 12usize
        .checked_add(
            count
                .checked_mul(96)
                .ok_or_else(|| anyhow!("TMS1 size overflow"))?,
        )
        .ok_or_else(|| anyhow!("TMS1 size overflow"))?;
    let end = proof_start
        .checked_add(proof_len)
        .ok_or_else(|| anyhow!("TMS1 proof length overflow"))?;
    ensure!(
        proof_len > 0 && end <= w.len() && w.len() - end <= 2048,
        "invalid TMS1 proof or extension bounds"
    );
    let proof = w[proof_start..end].to_vec();
    let mut updates: Vec<Update> = Vec::with_capacity(count);
    for i in 0..count {
        let p = 12 + i * 96;
        let owner: [u8; 32] = w[p..p + 32].try_into().unwrap();
        let key = derive_key(domain, &owner);
        let old = h256_slice(&w[p + 32..p + 64])?;
        let new = h256_slice(&w[p + 64..p + 96])?;
        parse_leaf(old)?;
        parse_leaf(new)?;
        if i > 0 {
            ensure!(
                key_less(updates[i - 1].key, key),
                "TMS1 updates not strictly ordered by derived key"
            );
        }
        updates.push(Update {
            owner,
            key,
            old,
            new,
        });
    }
    Ok((op, updates, proof))
}
fn csmt_verify(root: H256, pairs: &[(H256, H256)], proof: &[u8]) -> Result<()> {
    let mut b = SMTBuilder::new();
    for (k, v) in pairs {
        b = b
            .insert(k, v)
            .map_err(|e| anyhow!("CSMT pair insertion: {e}"))?;
    }
    let smt = b
        .build()
        .map_err(|e| anyhow!("CSMT state construction: {e}"))?;
    smt.verify(&root, proof)
        .map_err(|e| anyhow!("CSMT proof rejected with code {e}"))?;
    Ok(())
}
fn tree_root(map: &BTreeMap<H256, Position>) -> Result<H256> {
    let mut t = Tree::default();
    for (k, p) in map {
        if p.value != zero_h256() {
            t.update(*k, p.value).context("rebuild SMT state")?;
        }
    }
    Ok(*t.root())
}
fn amount_root(data: &[u8]) -> Result<(u64, H256)> {
    ensure!(data.len() == 48, "custody singleton data must be 48 bytes");
    ensure!(
        data[8..16].iter().all(|b| *b == 0),
        "custody amount exceeds supported u64"
    );
    Ok((u64le(data)?, h256_slice(&data[16..48])?))
}
fn value_at<'a>(tx: &'a Value, field: &str) -> Result<&'a Vec<Value>> {
    tx[field]
        .as_array()
        .ok_or_else(|| anyhow!("transaction {field} missing"))
}

fn replay(bundle: &Bundle) -> Result<Value> {
    ensure!(
        bundle.format == "trade-v2-recovery-bundle-v1",
        "unsupported bundle format"
    );
    let init = bytes32(&bundle.init_tx_hash, "initialization tx hash")?;
    let owner = bytes32(&bundle.owner_lock_hash, "owner lock hash")?;
    let args = hex_bytes(
        bundle.custody_lock["args"]
            .as_str()
            .ok_or_else(|| anyhow!("custody lock args missing"))?,
        "custody lock args",
    )?;
    ensure!(
        args.len() == 128,
        "current custody lock must have 128-byte domain args"
    );
    let mut domain = [0u8; 128];
    domain.copy_from_slice(&args);
    let market_hash = &domain[0..32];
    let asset_hash = &domain[32..64];
    let genesis_hash = &domain[64..96];
    let marker_hash = &domain[96..128];
    ensure!(
        script_hash(&bundle.xudt_type_script)?.as_slice() == asset_hash,
        "provided xUDT type script hash does not match custody lock args"
    );
    let history = bundle.history.clone();
    let init_hex = fmt(&init);
    let init_pos = history
        .iter()
        .position(|h| h.tx_hash.to_lowercase() == init_hex)
        .ok_or_else(|| anyhow!("initialization transaction is absent from indexed history"))?;
    ensure!(
        init_pos == 0,
        "history must begin at the supplied market initialization transaction"
    );
    ensure!(!history.is_empty(), "empty custody history");
    let mut map: BTreeMap<H256, Position> = BTreeMap::new();
    let mut owner_keys: BTreeMap<[u8; 32], H256> = BTreeMap::new();
    let mut current_point: Option<(String, u64)> = None;
    let mut marker_point: Option<(String, u64)> = None;
    let mut current_data: Option<Vec<u8>> = None;
    let mut prior_tx_order: Option<(u64, u64)> = None;
    let mut transitions = Vec::new();
    for (tx_no, row) in history.iter().enumerate() {
        let bno = rpc_u64(&Value::String(row.block_number.clone()), "history block")?;
        let tino = rpc_u64(
            &Value::String(row.tx_index.clone()),
            "history transaction index",
        )?;
        let order = (bno, tino);
        if let Some(prev) = prior_tx_order {
            ensure!(
                order > prev,
                "history has duplicate or noncanonical transaction ordering"
            );
        }
        prior_tx_order = Some(order);
        let tx = &row.transaction;
        let tx_hash = row.tx_hash.to_lowercase();
        ensure!(tx_hash.starts_with("0x"), "transaction hash malformed");
        if let Some(raw_hash) = tx["hash"].as_str() {
            ensure!(
                raw_hash.to_lowercase() == tx_hash,
                "retrieved transaction hash differs from indexer result"
            );
        }
        let outputs = value_at(tx, "outputs")?;
        let outputs_data = value_at(tx, "outputs_data")?;
        ensure!(
            outputs.len() == outputs_data.len(),
            "outputs/output_data count mismatch"
        );
        let mut all_custody_outputs = Vec::new();
        let mut custody_outputs = Vec::new();
        let mut marker_outputs = Vec::new();
        let custody_script_hash = script_hash(&bundle.custody_lock)?;
        for (i, o) in outputs.iter().enumerate() {
            if script_equal(&o["lock"], &bundle.custody_lock)? {
                all_custody_outputs.push((i, o, &outputs_data[i]));
                if o["type"].is_object() {
                    let th = script_hash(&o["type"])?;
                    if th.as_slice() == asset_hash {
                        custody_outputs.push((i, o, &outputs_data[i]));
                    } else if th.as_slice() == marker_hash {
                        marker_outputs.push((i, o, &outputs_data[i]));
                    }
                }
            }
        }
        ensure!(
            all_custody_outputs.len() == 2,
            "{} must create exactly the custody xUDT and marker singleton outputs",
            row.tx_hash
        );
        ensure!(
            custody_outputs.len() == 1,
            "{} must create exactly one matching custody xUDT output, found {}",
            row.tx_hash,
            custody_outputs.len()
        );
        let (out_index, _out_cell, out_data_hex) = custody_outputs[0];
        let output_data = ckb_data(
            out_data_hex
                .as_str()
                .ok_or_else(|| anyhow!("output data not hex"))?,
        )?;
        let (out_amount, out_root) = amount_root(&output_data)?;
        ensure!(
            marker_outputs.len() == 1,
            "{} must create exactly one custody marker output",
            row.tx_hash
        );
        let (marker_index, _, marker_data_hex) = marker_outputs[0];
        let marker_data = ckb_data(
            marker_data_hex
                .as_str()
                .ok_or_else(|| anyhow!("marker output data not hex"))?,
        )?;
        let mut expected_marker = Vec::with_capacity(64);
        expected_marker.extend_from_slice(custody_script_hash.as_slice());
        expected_marker.extend_from_slice(asset_hash);
        ensure!(
            marker_data == expected_marker,
            "custody marker data does not bind this lock and xUDT Type Script"
        );
        let inputs = value_at(tx, "inputs")?;
        let matching_inputs: Vec<(usize, &Value)> = inputs
            .iter()
            .enumerate()
            .filter_map(|(i, x)| {
                let p = &x["previous_output"];
                let h = p["tx_hash"].as_str().unwrap_or("").to_lowercase();
                let ix = rpc_u64(&p["index"], "input index").ok()?;
                if current_point
                    .as_ref()
                    .is_some_and(|(ch, ci)| ch == &h && *ci == ix)
                {
                    Some((i, x))
                } else {
                    None
                }
            })
            .collect();
        let marker_inputs: Vec<(usize, &Value)> = inputs
            .iter()
            .enumerate()
            .filter_map(|(i, x)| {
                let p = &x["previous_output"];
                let h = p["tx_hash"].as_str().unwrap_or("").to_lowercase();
                let ix = rpc_u64(&p["index"], "input outpoint index").ok()?;
                if marker_point
                    .as_ref()
                    .is_some_and(|(ch, ci)| ch == &h && *ci == ix)
                {
                    Some((i, x))
                } else {
                    None
                }
            })
            .collect();
        if tx_no == 0 {
            ensure!(
                row.tx_hash.to_lowercase() == init_hex,
                "first history row differs from initialization tx"
            );
            ensure!(
                current_point.is_none() && marker_point.is_none(),
                "initial state unexpectedly has prior custody cells"
            );
        } else {
            ensure!(
                matching_inputs.len() == 1,
                "transition must spend the previous custody singleton exactly once"
            );
            ensure!(
                marker_inputs.len() == 1,
                "transition must spend the previous custody marker exactly once"
            );
        }
        let witnesses = tx
            .get("witnesses")
            .ok_or_else(|| anyhow!("transaction witnesses missing"))?;
        let (op, updates, proof) = parse_tms1(witnesses, &domain)?;
        ensure!(op <= 8, "unknown TMS1 operation code {op}");
        let is_init = tx_no == 0;
        if is_init {
            ensure!(op == 0, "initialization transaction must use TMS1 init op");
            ensure!(
                updates.len() == 1,
                "initialization must enroll exactly one owner"
            );
        } else {
            ensure!(op != 0, "later custody update cannot reuse init op");
        }
        let input_root = if is_init {
            H256::zero()
        } else {
            amount_root(current_data.as_ref().unwrap())?.1
        };
        let input_amount = if is_init {
            0
        } else {
            amount_root(current_data.as_ref().unwrap())?.0
        };
        let mut old_pairs = Vec::with_capacity(updates.len());
        let mut new_pairs = Vec::with_capacity(updates.len());
        let mut delta: i128 = 0;
        let mut increases = 0usize;
        let mut decreases = 0usize;
        for u in &updates {
            let expected = map.get(&u.key).map(|p| p.value).unwrap_or_else(zero_h256);
            ensure!(
                u.old == expected,
                "old leaf does not match independently reconstructed owner state"
            );
            let old = parse_leaf(u.old)?;
            let new = parse_leaf(u.new)?;
            if old.value == zero_h256() {
                let expected_revision = if is_init { 0 } else { 1 };
                ensure!(
                    new.active && new.revision == expected_revision,
                    "new enrollment has the wrong initial revision for this operation"
                );
            } else {
                ensure!(
                    new.revision
                        == old
                            .revision
                            .checked_add(1)
                            .ok_or_else(|| anyhow!("owner revision overflow"))?,
                    "existing owner revision must increment exactly once"
                );
            }
            if let Some(existing) = owner_keys.get(&u.owner) {
                ensure!(*existing == u.key, "same owner maps to inconsistent keys");
            } else {
                owner_keys.insert(u.owner, u.key);
            }
            let old_bal = if old.active { old.balance as i128 } else { 0 };
            let new_bal = if new.active { new.balance as i128 } else { 0 };
            delta = delta
                .checked_add(new_bal - old_bal)
                .ok_or_else(|| anyhow!("balance delta overflow"))?;
            if new_bal > old_bal {
                increases += 1;
            } else if new_bal < old_bal {
                decreases += 1;
            }
            old_pairs.push((u.key, u.old));
            new_pairs.push((u.key, u.new));
        }
        if is_init {
            ensure!(
                delta > 0,
                "initialization must create positive custody entitlement"
            );
        } else {
            match op {
                1 => ensure!(
                    updates.len() == 1 && increases == 1 && delta > 0,
                    "buy transition must increase one owner's entitlement"
                ),
                2 => ensure!(
                    updates.len() >= 2
                        && updates.len() <= 8
                        && increases == updates.len()
                        && delta > 0,
                    "batch buy transition must increase each participant"
                ),
                3 => ensure!(
                    updates.len() == 2 && increases == 1 && decreases == 1 && delta == 0,
                    "peer transfer must move the same quantity between two owners"
                ),
                4 | 5 => ensure!(
                    updates.len() == 1 && decreases == 1 && delta < 0,
                    "sale or withdrawal must reduce one owner's entitlement"
                ),
                6 => ensure!(
                    updates.len() == 1 && increases == 1 && delta > 0,
                    "deposit must increase one owner's entitlement"
                ),
                7 => ensure!(
                    updates.len() == 1
                        && delta == 0
                        && updates[0].old.as_slice()[..8] == updates[0].new.as_slice()[..8],
                    "cancellation must preserve owner balance"
                ),
                8 => {}
                _ => bail!("invalid TMS1 operation"),
            }
        }
        csmt_verify(input_root, &old_pairs, &proof)
            .with_context(|| format!("old root proof in {}", row.tx_hash))?;
        let next = if delta >= 0 {
            input_amount
                .checked_add(delta as u64)
                .ok_or_else(|| anyhow!("custody total overflow"))?
        } else {
            input_amount
                .checked_sub((-delta) as u64)
                .ok_or_else(|| anyhow!("custody total underflow"))?
        };
        ensure!(
            out_amount == next,
            "actual custody amount does not equal old amount plus authenticated leaf deltas"
        );
        csmt_verify(out_root, &new_pairs, &proof)
            .with_context(|| format!("new root proof in {}", row.tx_hash))?;
        for u in &updates {
            let p = parse_leaf(u.new)?;
            if p.value == zero_h256() {
                map.remove(&u.key);
            } else {
                map.insert(u.key, p);
            }
        }
        ensure!(
            tree_root(&map)? == out_root,
            "full independently reconstructed ownership root does not match committed output root"
        );
        let sum = map.values().filter(|p| p.active).try_fold(0u64, |n, p| {
            n.checked_add(p.balance)
                .ok_or_else(|| anyhow!("reconstructed entitlement sum overflow"))
        })?;
        ensure!(sum==out_amount,"sum of independently reconstructed entitlements differs from actual custody xUDT amount");
        current_point = Some((row.tx_hash.to_lowercase(), out_index as u64));
        marker_point = Some((row.tx_hash.to_lowercase(), marker_index as u64));
        current_data = Some(output_data);
        transitions.push(json!({"tx_hash":row.tx_hash,"block_number":row.block_number,"tx_index":row.tx_index,"op":op,"update_count":updates.len(),"root":fmt(out_root.as_slice()),"custody_amount":out_amount.to_string(),"reconstructed_entitlement_total":sum.to_string()}));
    }
    ensure!(
        script_equal(&bundle.live.output["lock"], &bundle.custody_lock)?,
        "live output lock differs from supplied custody lock"
    );
    ensure!(
        bundle.live.output["type"].is_object()
            && script_hash(&bundle.live.output["type"])?.as_slice() == asset_hash,
        "live output xUDT Type Script differs from the domain asset"
    );
    let live_point = (
        bundle.live.tx_hash.to_lowercase(),
        rpc_u64(
            &Value::String(bundle.live.index.clone()),
            "live output index",
        )?,
    );
    ensure!(Some(live_point.clone())==current_point,"replayed tip is not the live canonical custody output; indexer history may be incomplete or stale");
    let live_data = ckb_data(&bundle.live.data)?;
    let (live_amount, live_root) = amount_root(&live_data)?;
    ensure!(
        current_data.as_ref() == Some(&live_data),
        "live custody data differs from replayed final output"
    );
    let owner_key = derive_key(&domain, &owner);
    let position = map.get(&owner_key).cloned().unwrap_or(Position {
        value: zero_h256(),
        balance: 0,
        revision: 0,
        active: false,
    });
    let mut tree = Tree::default();
    for (k, p) in &map {
        tree.update(*k, p.value)
            .context("build current proof tree")?;
    }
    let compiled: CompiledMerkleProof = tree
        .merkle_proof(vec![owner_key])
        .context("generate owner recovery proof")?
        .compile(vec![owner_key])
        .context("compile owner recovery proof")?;
    let current_leaf = position.value;
    let valid = compiled
        .verify::<CkbHasher>(&live_root, vec![(owner_key, current_leaf)])
        .context("self-check owner proof")?;
    ensure!(
        valid,
        "generated owner proof did not verify against current root"
    );
    let proof: Vec<u8> = compiled.clone().into();
    let old_hex = fmt(current_leaf.as_slice());
    let withdrawal_template = if position.active && position.balance > 0 {
        let mut next_value = [0u8; 32];
        next_value[8..16].copy_from_slice(
            &position
                .revision
                .checked_add(1)
                .ok_or_else(|| anyhow!("owner revision overflow"))?
                .to_le_bytes(),
        );
        next_value[16] = 2;
        let new_h = H256::from(next_value);
        let new_pairs = vec![(owner_key, new_h)];
        let next_tree_root = compiled
            .compute_root::<CkbHasher>(new_pairs)
            .context("compute post-withdrawal root")?;
        let mut witness = Vec::with_capacity(12 + 96 + proof.len());
        witness.extend_from_slice(b"TMS1");
        witness.push(1);
        witness.push(5);
        witness.push(1);
        witness.push(0);
        witness.extend_from_slice(&(proof.len() as u32).to_le_bytes());
        witness.extend_from_slice(&owner);
        witness.extend_from_slice(current_leaf.as_slice());
        witness.extend_from_slice(new_h.as_slice());
        witness.extend_from_slice(&proof);
        json!({"op":5,"quantity":position.balance.to_string(),"remaining_custody_amount":(live_amount-position.balance).to_string(),"input_custody_outpoint":{"tx_hash":bundle.live.tx_hash,"index":bundle.live.index},"old_root":fmt(live_root.as_slice()),"new_root":fmt(next_tree_root.as_slice()),"old_leaf":old_hex,"new_leaf":fmt(new_h.as_slice()),"tms1_witness":fmt(&witness),"witness_bytes":witness.len(),"authorization":"transaction must include an input locked by this owner and satisfy the compiled custody contract's withdrawal cell layout"})
    } else {
        Value::Null
    };
    let script_args = hex_bytes(
        bundle.custody_lock["args"].as_str().unwrap(),
        "custody args",
    )?;
    let current_custody_outpoint = json!({"tx_hash":bundle.live.tx_hash,"index":bundle.live.index});
    Ok(json!({
        "format":"trade-v2-recovery-result-v1",
        "network_scope":"reconstruction only; native withdrawal requires compatible built script and a signed CKB transaction",
        "init_tx_hash":bundle.init_tx_hash,
        "tip_tx_hash":bundle.live.tx_hash,
        "tip_outpoint":current_custody_outpoint,
        "custody_amount":live_amount.to_string(),
        "ownership_root":fmt(live_root.as_slice()),
        "entitlement_total":map.values().filter(|p|p.active).map(|p|p.balance as u128).sum::<u128>().to_string(),
        "owner_lock_hash":bundle.owner_lock_hash,
        "owner":{"balance":position.balance.to_string(),"revision":position.revision.to_string(),"active":position.active},
        "owner_membership_proof":{"key":fmt(owner_key.as_slice()),"leaf_value":old_hex,"compiled_proof":fmt(&proof),"proof_bytes":proof.len(),"root_verified":valid},
        "withdrawal_template":withdrawal_template,
        "domain":{"market_script_hash":fmt(market_hash),"xudt_type_script_hash":fmt(asset_hash),"genesis_hash":fmt(genesis_hash),"custody_marker_type_hash":fmt(marker_hash),"args_len":script_args.len()},
        "transitions":transitions
    }))
}

fn read_json(path: Option<&str>) -> Result<String> {
    match path {
        Some("-") | None => {
            let mut s = String::new();
            io::stdin().read_to_string(&mut s)?;
            Ok(s)
        }
        Some(p) => fs::read_to_string(p).with_context(|| format!("read {p}")),
    }
}
fn write_json(v: &Value, path: Option<&str>) -> Result<()> {
    let data = format!("{}\n", serde_json::to_string_pretty(v)?);
    match path {
        Some("-") | None => io::stdout().write_all(data.as_bytes())?,
        Some(p) => fs::write(Path::new(p), data).with_context(|| format!("write {p}"))?,
    }
    Ok(())
}
fn run() -> Result<()> {
    let a = std::env::args().skip(1).collect::<Vec<_>>();
    match a.first().map(String::as_str) {
        Some("replay") if a.len() == 2 || a.len() == 3 => {
            let raw = read_json(Some(&a[1]))?;
            let b: Bundle = serde_json::from_str(&raw).context("parse recovery bundle")?;
            write_json(&replay(&b)?, a.get(2).map(String::as_str))
        }
        Some("help") | Some("--help") | Some("-h") | None => {
            println!("trade-v2-recovery\n  replay <rpc-bundle.json|-> [result.json|-]\n\nRPC collection is performed by recover.cjs; this verifier independently checks TMS1 roots, revision transitions, entitlement conservation, full tree reconstruction, and a generated owner proof.");
            Ok(())
        }
        _ => bail!("usage: trade-v2-recovery replay <rpc-bundle.json|-> [result.json|-]"),
    }
}
fn main() {
    if let Err(e) = run() {
        eprintln!("recovery error: {e:#}");
        std::process::exit(2)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn s(code: u8, args: &[u8], ht: &str) -> Value {
        json!({"code_hash":fmt(&[code;32]),"hash_type":ht,"args":fmt(args)})
    }
    fn leaf(balance: u64, revision: u64, status: u8) -> H256 {
        let mut v = [0u8; 32];
        v[..8].copy_from_slice(&balance.to_le_bytes());
        v[8..16].copy_from_slice(&revision.to_le_bytes());
        v[16] = status;
        H256::from(v)
    }
    fn witness(op: u8, owner: [u8; 32], old: H256, new: H256, proof: &[u8]) -> String {
        let mut v = Vec::new();
        v.extend_from_slice(b"TMS1");
        v.extend_from_slice(&[1, op, 1, 0]);
        v.extend_from_slice(&(proof.len() as u32).to_le_bytes());
        v.extend_from_slice(&owner);
        v.extend_from_slice(old.as_slice());
        v.extend_from_slice(new.as_slice());
        v.extend_from_slice(proof);
        fmt(&v)
    }
    fn cell(lock: &Value, ty: &Value, _data: &[u8]) -> Value {
        json!({"capacity":"0x1000000000","lock":lock,"type":ty})
    }
    fn transaction(
        inputs: Vec<Value>,
        lock: &Value,
        asset: &Value,
        marker: &Value,
        amount: u64,
        root: H256,
        marker_data: &[u8],
        tms: String,
    ) -> Value {
        let mut data = [0u8; 48];
        data[..8].copy_from_slice(&amount.to_le_bytes());
        data[16..].copy_from_slice(root.as_slice());
        json!({"inputs":inputs,"outputs":[cell(lock,asset,&data),cell(lock,marker,marker_data)],"outputs_data":[fmt(&data),fmt(marker_data)],"witnesses":[tms]})
    }
    fn reference_bundle() -> Bundle {
        let asset = s(0x41, b"asset args", "data1");
        let marker = s(0x42, b"marker args", "data1");
        let asset_hash = script_hash(&asset).unwrap();
        let marker_hash = script_hash(&marker).unwrap();
        let mut domain = [0u8; 128];
        domain[..32].fill(0x11);
        domain[32..64].copy_from_slice(asset_hash.as_slice());
        domain[64..96].fill(0x22);
        domain[96..].copy_from_slice(marker_hash.as_slice());
        let lock = s(0x43, &domain, "data1");
        let lock_hash = script_hash(&lock).unwrap();
        let mut md = Vec::new();
        md.extend_from_slice(lock_hash.as_slice());
        md.extend_from_slice(asset_hash.as_slice());
        let owner1 = [0x61; 32];
        let owner2 = [0x62; 32];
        let key1 = derive_key(&domain, &owner1);
        let key2 = derive_key(&domain, &owner2);
        let mut empty = Tree::default();
        let proof1: CompiledMerkleProof = empty
            .merkle_proof(vec![key1])
            .unwrap()
            .compile(vec![key1])
            .unwrap();
        let proof1b: Vec<u8> = proof1.into();
        let v1 = leaf(5, 0, 1);
        let root1 = {
            empty.update(key1, v1).unwrap();
            *empty.root()
        };
        let tx1hash = fmt(&[0x91; 32]);
        let tx1 = transaction(
            vec![],
            &lock,
            &asset,
            &marker,
            5,
            root1,
            &md,
            witness(0, owner1, H256::zero(), v1, &proof1b),
        );
        let proof2: CompiledMerkleProof = empty
            .merkle_proof(vec![key2])
            .unwrap()
            .compile(vec![key2])
            .unwrap();
        let proof2b: Vec<u8> = proof2.into();
        let v2 = leaf(2, 1, 1);
        let root2 = {
            empty.update(key2, v2).unwrap();
            *empty.root()
        };
        let tx2hash = fmt(&[0x92; 32]);
        let block_a = fmt(&[0xa1; 32]);
        let block_b = fmt(&[0xb2; 32]);
        let in1 = json!({"previous_output":{"tx_hash":tx1hash,"index":"0x0"}});
        let in2 = json!({"previous_output":{"tx_hash":tx1hash,"index":"0x1"}});
        let tx2 = transaction(
            vec![in1, in2],
            &lock,
            &asset,
            &marker,
            7,
            root2,
            &md,
            witness(1, owner2, H256::zero(), v2, &proof2b),
        );
        let history = vec![
            HistoryRow {
                tx_hash: tx1hash.clone(),
                block_number: "0x1".into(),
                tx_index: "0x0".into(),
                block_hash: Some(block_a.clone()),
                transaction: tx1,
            },
            HistoryRow {
                tx_hash: tx2hash.clone(),
                block_number: "0x2".into(),
                tx_index: "0x0".into(),
                block_hash: Some(block_b.clone()),
                transaction: tx2,
            },
        ];
        let live_output = cell(&lock, &asset, &{
            let mut d = [0u8; 48];
            d[..8].copy_from_slice(&7u64.to_le_bytes());
            d[16..].copy_from_slice(root2.as_slice());
            d
        });
        Bundle {
            format: "trade-v2-recovery-bundle-v1".into(),
            init_tx_hash: tx1hash,
            owner_lock_hash: fmt(&owner2),
            custody_lock: lock,
            xudt_type_script: asset,
            _collection: None,
            history,
            live: LiveRow {
                tx_hash: tx2hash,
                index: "0x0".into(),
                _capacity: "0x1000000000".into(),
                data: {
                    let mut d = [0u8; 48];
                    d[..8].copy_from_slice(&7u64.to_le_bytes());
                    d[16..].copy_from_slice(root2.as_slice());
                    fmt(&d)
                },
                output: live_output,
            },
        }
    }
    #[test]
    fn script_hash_matches_known_serialization_roundtrip() {
        assert_eq!(
            fmt(ckb_hash(&[]).as_slice()),
            "0x44f4c69744d5f8c55d642062949dcae49bc4e7ef43d388c5a12f42b5633d163e"
        );
        let s = json!({"code_hash":format!("0x{}","11".repeat(32)),"hash_type":"data1","args":"0x010203"});
        let h = script_hash(&s).unwrap();
        assert_eq!(h.as_slice().len(), 32);
        assert_eq!(h, script_hash(&s).unwrap());
        let known =
            json!({"code_hash":format!("0x{}","41".repeat(32)),"hash_type":"data1","args":"0x"});
        assert_eq!(
            fmt(script_hash(&known).unwrap().as_slice()),
            "0x46b7502dffb808c5c492fe5882bf588b6df8241affceff5243ed67ab8a98e66c"
        );
    }
    #[test]
    fn canonical_leaf_states_are_checked() {
        assert!(!parse_leaf(H256::zero()).unwrap().active);
        let mut b = [0u8; 32];
        b[..8].copy_from_slice(&1u64.to_le_bytes());
        b[16] = 1;
        assert!(parse_leaf(H256::from(b)).unwrap().active);
        b[16] = 2;
        assert!(parse_leaf(H256::from(b)).is_err());
    }
    #[test]
    fn replay_reconstructs_two_committed_owner_transitions_and_withdrawal_proof() {
        let result = replay(&reference_bundle()).unwrap();
        assert_eq!(result["custody_amount"], "7");
        assert_eq!(result["entitlement_total"], "7");
        assert_eq!(result["owner"]["balance"], "2");
        assert_eq!(result["owner"]["revision"], "1");
        assert_eq!(result["owner_membership_proof"]["root_verified"], true);
        assert_eq!(result["transitions"].as_array().unwrap().len(), 2);
        assert_eq!(result["withdrawal_template"]["quantity"], "2");
    }
    #[test]
    fn replay_rejects_stale_old_leaf_even_when_chain_bundle_is_otherwise_valid() {
        let mut b = reference_bundle();
        let witness = hex_bytes(
            b.history[1].transaction["witnesses"][0].as_str().unwrap(),
            "witness",
        )
        .unwrap();
        let mut changed = witness;
        changed[12 + 32..12 + 64].copy_from_slice(leaf(1, 0, 1).as_slice());
        b.history[1].transaction["witnesses"][0] = Value::String(fmt(&changed));
        assert!(format!("{:#}", replay(&b).unwrap_err()).contains("old leaf does not match"));
    }
}
