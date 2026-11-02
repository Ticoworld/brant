use sha3::{Digest, Keccak256};
use std::{env, fs};

#[derive(Clone)]
struct Record {
    key: [u8; 32],
    balance: u128,
    nonce: u64,
}

fn keccak(data: &[u8]) -> [u8; 32] {
    let out = Keccak256::digest(data);
    let mut result = [0; 32];
    result.copy_from_slice(&out);
    result
}

fn leaf_hash(balance: u128, nonce: u64) -> [u8; 32] {
    if balance == 0 && nonce == 0 {
        return [0; 32];
    }
    let mut encoded = [0; 24];
    encoded[..16].copy_from_slice(&balance.to_be_bytes());
    encoded[16..].copy_from_slice(&nonce.to_be_bytes());
    keccak(&encoded)
}

fn bit(key: &[u8; 32], depth: usize) -> u8 {
    (key[depth / 8] >> (7 - depth % 8)) & 1
}

fn defaults() -> Vec<[u8; 32]> {
    let mut out = vec![[0; 32]; 257];
    for depth in (0..256).rev() {
        let mut node = [0; 64];
        node[..32].copy_from_slice(&out[depth + 1]);
        node[32..].copy_from_slice(&out[depth + 1]);
        out[depth] = keccak(&node);
    }
    out
}

fn subtree(records: &[Record], depth: usize, empty: &[[u8; 32]]) -> [u8; 32] {
    if records.is_empty() {
        return empty[depth];
    }
    if depth == 256 {
        return leaf_hash(records[0].balance, records[0].nonce);
    }
    let mid = records.partition_point(|record| bit(&record.key, depth) == 0);
    let left = subtree(&records[..mid], depth + 1, empty);
    let right = subtree(&records[mid..], depth + 1, empty);
    let mut node = [0; 64];
    node[..32].copy_from_slice(&left);
    node[32..].copy_from_slice(&right);
    keccak(&node)
}

fn siblings(records: &[Record], key: &[u8; 32], depth: usize, empty: &[[u8; 32]], out: &mut Vec<[u8; 32]>) {
    if depth == 256 {
        return;
    }
    let mid = records.partition_point(|record| bit(&record.key, depth) == 0);
    if bit(key, depth) == 0 {
        out.push(subtree(&records[mid..], depth + 1, empty));
        siblings(&records[..mid], key, depth + 1, empty, out);
    } else {
        out.push(subtree(&records[..mid], depth + 1, empty));
        siblings(&records[mid..], key, depth + 1, empty, out);
    }
}

fn main() {
    let args: Vec<_> = env::args().collect();
    assert_eq!(args.len(), 4, "usage: helper <da_blob.bin> <public_values.bin> <compressed_pubkey_hex>");
    let da = fs::read(&args[1]).expect("read DA blob");
    let pv = fs::read(&args[2]).expect("read public values");
    assert_eq!(da.len() % 56, 0, "fixed-width DA blob malformed");
    assert_eq!(pv.len(), 288, "public values length mismatch");
    let mut records: Vec<Record> = da.chunks_exact(56).map(|chunk| {
        let mut key = [0; 32];
        key.copy_from_slice(&chunk[..32]);
        let mut balance = [0; 16];
        balance.copy_from_slice(&chunk[32..48]);
        let mut nonce = [0; 8];
        nonce.copy_from_slice(&chunk[48..56]);
        Record { key, balance: u128::from_be_bytes(balance), nonce: u64::from_be_bytes(nonce) }
    }).collect();
    records.sort_by_key(|record| record.key);
    let pubkey = hex::decode(args[3].strip_prefix("0x").unwrap_or(&args[3])).expect("decode pubkey");
    assert_eq!(pubkey.len(), 33, "expected compressed secp256k1 pubkey");
    let key = keccak(&pubkey);
    let record = records.iter().find(|record| record.key == key).expect("owner key absent from DA").clone();
    let empty = defaults();
    let root = subtree(&records, 0, &empty);
    assert_eq!(&root[..], &pv[80..112], "replayed DA root differs from checkpoint public values");
    let mut path = Vec::with_capacity(256);
    siblings(&records, &key, 0, &empty, &mut path);
    assert_eq!(path.len(), 256);

    let mut witness = Vec::with_capacity(8249);
    witness.extend_from_slice(&pubkey);
    witness.extend_from_slice(&record.balance.to_be_bytes());
    witness.extend_from_slice(&record.nonce.to_be_bytes());
    for sibling in &path { witness.extend_from_slice(sibling); }
    let mut nullified = records.clone();
    let leaf = nullified.iter_mut().find(|item| item.key == key).unwrap();
    leaf.balance = 0;
    let next_root = subtree(&nullified, 0, &empty);
    println!("{{\"owner_key\":\"0x{}\",\"balance_shannons\":\"{}\",\"nonce\":{},\"root\":\"0x{}\",\"nullified_root\":\"0x{}\",\"siblings\":256,\"witness_hex\":\"0x{}\"}}",
        hex::encode(key), record.balance, record.nonce, hex::encode(root), hex::encode(next_root), hex::encode(witness));
}
