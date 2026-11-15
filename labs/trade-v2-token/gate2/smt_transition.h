#ifndef TRADE_V2_SMT_TRANSITION_H
#define TRADE_V2_SMT_TRANSITION_H

#include "../..//wo09-open-markets/contracts/common.h"
#include "vendor/ckb_smt.h"

#define TRADE_SMT_MAX_UPDATES 16
#define TRADE_SMT_MAX_WITNESS 65536
#define TRADE_SMT_ENTRY_BYTES 96
#define TRADE_SMT_HEADER_BYTES 12
#define TRADE_SMT_VERSION 1

enum {
  TRADE_SMT_INIT = 0,
  TRADE_SMT_BUY = 1,
  TRADE_SMT_BATCH_BUY = 2,
  TRADE_SMT_TRANSFER = 3,
  TRADE_SMT_CURVE_SELL = 4,
  TRADE_SMT_WITHDRAW = 5,
  TRADE_SMT_DEPOSIT = 6,
  TRADE_SMT_CANCEL = 7,
  TRADE_SMT_ORDER_FILL = 8
};

typedef struct {
  uint8_t owner[32];
  uint8_t key[32];
  uint8_t old_value[32];
  uint8_t new_value[32];
} trade_smt_update_t;

typedef struct {
  uint8_t op;
  uint16_t count;
  uint32_t proof_len;
  const uint8_t *proof;
  const uint8_t *extra;
  uint32_t extra_len;
  trade_smt_update_t updates[TRADE_SMT_MAX_UPDATES];
} trade_smt_transition_t;

static uint8_t trade_smt_witness[TRADE_SMT_MAX_WITNESS];
static smt_pair_t trade_smt_old_pairs[TRADE_SMT_MAX_UPDATES];
static smt_pair_t trade_smt_new_pairs[TRADE_SMT_MAX_UPDATES];

static void trade_smt_hash(const uint8_t *p, size_t n, uint8_t out[32]) {
  blake2b_state h;
  ckb_blake2b_init(&h, 32);
  blake2b_update(&h, p, n);
  blake2b_final(&h, out, 32);
}

static void trade_smt_key(const uint8_t *script_args, const uint8_t owner[32], uint8_t out[32]) {
  static const uint8_t domain[] = "TRADE-V2-XUDT-OWNER-KEY-v1";
  blake2b_state h;
  ckb_blake2b_init(&h, 32);
  blake2b_update(&h, domain, sizeof(domain) - 1);
  blake2b_update(&h, script_args + 53, 32);  // market script hash
  blake2b_update(&h, script_args + 85, 32);  // complete xUDT Type Script hash
  blake2b_update(&h, script_args + 117, 32); // initialization genesis hash
  blake2b_update(&h, script_args + 149, 32); // custody marker Type Script hash
  blake2b_update(&h, owner, 32);
  blake2b_final(&h, out, 32);
}

static int trade_smt_key_cmp(const uint8_t a[32], const uint8_t b[32]) {
  for (int i = 31; i >= 0; --i) {
    if (a[i] != b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

static int trade_smt_value_valid(const uint8_t v[32]) {
  uint8_t any = 0;
  for (int i = 0; i < 32; ++i) any |= v[i];
  if (!any) return 1; // canonical non-membership leaf
  for (int i = 17; i < 32; ++i) if (v[i]) return 0;
  uint64_t balance = rd(v), revision = rd(v + 8);
  if (v[16] == 1) return balance > 0;
  if (v[16] == 2) return balance == 0 && revision > 0;
  return 0;
}

static int trade_smt_load(uint64_t witness_index, size_t source,
                          const uint8_t *script_args,
                          trade_smt_transition_t *out) {
  uint64_t n = TRADE_SMT_MAX_WITNESS;
  if (ckb_load_witness(trade_smt_witness, &n, 0, witness_index, source) ||
      n < TRADE_SMT_HEADER_BYTES || n > TRADE_SMT_MAX_WITNESS) return 1;
  const uint8_t *w = trade_smt_witness;
  if (memcmp(w, "TMS1", 4) || w[4] != TRADE_SMT_VERSION || w[7] != 0) return 2;
  uint16_t count = w[6];
  uint32_t proof_len = (uint32_t)w[8] | ((uint32_t)w[9] << 8) |
                       ((uint32_t)w[10] << 16) | ((uint32_t)w[11] << 24);
  uint64_t proof_end = TRADE_SMT_HEADER_BYTES + (uint64_t)count * TRADE_SMT_ENTRY_BYTES + proof_len;
  if (!count || count > TRADE_SMT_MAX_UPDATES || !proof_len || proof_end > n || n - proof_end > 2048) return 3;
  out->op = w[5];
  out->count = count;
  out->proof_len = proof_len;
  out->proof = w + TRADE_SMT_HEADER_BYTES + (uint64_t)count * TRADE_SMT_ENTRY_BYTES;
  out->extra = out->proof + proof_len;
  out->extra_len = (uint32_t)(n - proof_end);
  for (uint16_t i = 0; i < count; ++i) {
    const uint8_t *p = w + TRADE_SMT_HEADER_BYTES + i * TRADE_SMT_ENTRY_BYTES;
    trade_smt_update_t *u = &out->updates[i];
    memcpy(u->owner, p, 32);
    trade_smt_key(script_args, u->owner, u->key);
    memcpy(u->old_value, p + 32, 32);
    memcpy(u->new_value, p + 64, 32);
    if (!trade_smt_value_valid(u->old_value) || !trade_smt_value_valid(u->new_value)) return 4;
    if (i && trade_smt_key_cmp(out->updates[i - 1].key, u->key) >= 0) return 5;
    memcpy(trade_smt_old_pairs[i].key, u->key, 32);
    memcpy(trade_smt_old_pairs[i].value, u->old_value, 32);
    trade_smt_old_pairs[i].order = i;
    memcpy(trade_smt_new_pairs[i].key, u->key, 32);
    memcpy(trade_smt_new_pairs[i].value, u->new_value, 32);
    trade_smt_new_pairs[i].order = i;
  }
  return 0;
}

static int trade_smt_initialize_root(const uint8_t output_data[48], const trade_smt_transition_t *t) {
  uint8_t old_root[32], new_root[32], zero[32] = {0};
  for (uint16_t i = 0; i < t->count; ++i) {
    for (int j = 0; j < 32; ++j) if (t->updates[i].old_value[j]) return 1;
  }
  smt_state_t old_state, new_state;
  smt_state_init(&old_state, trade_smt_old_pairs, t->count);
  smt_state_init(&new_state, trade_smt_new_pairs, t->count);
  for (uint16_t i = 0; i < t->count; ++i) {
    if (smt_state_insert(&old_state, trade_smt_old_pairs[i].key, trade_smt_old_pairs[i].value) ||
        smt_state_insert(&new_state, trade_smt_new_pairs[i].key, trade_smt_new_pairs[i].value)) return 5;
  }
  if (smt_calculate_root(old_root, &old_state, t->proof, t->proof_len)) return 1;
  if (memcmp(old_root, zero, 32)) return 2;
  if (smt_calculate_root(new_root, &new_state, t->proof, t->proof_len)) return 3;
  if (memcmp(new_root, output_data + 16, 32)) return 4;
  return 0;
}

static int trade_smt_roots(const uint8_t input_data[48], const uint8_t output_data[48],
                           const trade_smt_transition_t *t, __int128 *delta) {
  if (rd(input_data + 8) || rd(output_data + 8)) return 1;
  smt_state_t old_state, new_state;
  smt_state_init(&old_state, trade_smt_old_pairs, t->count);
  smt_state_init(&new_state, trade_smt_new_pairs, t->count);
  for (uint16_t i = 0; i < t->count; ++i) {
    if (smt_state_insert(&old_state, trade_smt_old_pairs[i].key, trade_smt_old_pairs[i].value) ||
        smt_state_insert(&new_state, trade_smt_new_pairs[i].key, trade_smt_new_pairs[i].value)) return 5;
  }
  uint8_t old_root[32], new_root[32];
  if (smt_calculate_root(old_root, &old_state, t->proof, t->proof_len) ||
      memcmp(old_root, input_data + 16, 32)) return 2;
  if (smt_calculate_root(new_root, &new_state, t->proof, t->proof_len) ||
      memcmp(new_root, output_data + 16, 32)) return 3;
  __int128 d = 0;
  for (uint16_t i = 0; i < t->count; ++i) {
    d += (__int128)rd(t->updates[i].new_value) - (__int128)rd(t->updates[i].old_value);
  }
  *delta = d;
  __int128 expected = (__int128)rd(input_data) + d;
  if (expected < 0 || expected > UINT64_MAX || expected != rd(output_data)) return 4;
  return 0;
}

#endif
