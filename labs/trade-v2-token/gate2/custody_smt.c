// Gate 2 experimental xUDT custody using the pinned compacted SMT verifier.
#include "../../wo09-open-markets/contracts/common.h"
#include "smt_transition.h"
#include "../../wo15-merkle-intent/r6/secp256k1_helper.h"

#define ORDER_EXTRA_BYTES 210

static secp256k1_context order_ctx;
static unsigned char order_precomputed[CKB_SECP256K1_DATA_SIZE] __attribute__((aligned(16)));

static void order_hash(const uint8_t *p, size_t n, uint8_t out[32]) {
  blake2b_state s;
  blake2b_init(&s, 32);
  blake2b_update(&s, p, n);
  blake2b_final(&s, out, 32);
}

static void order_text(blake2b_state *s, const char *v) {
  blake2b_update(s, v, strlen(v));
}

static void order_hex32(blake2b_state *s, const uint8_t *v) {
  static const char digits[] = "0123456789abcdef";
  char text[66] = {'0', 'x'};
  for (int i = 0; i < 32; ++i) {
    text[2 + i * 2] = digits[v[i] >> 4];
    text[3 + i * 2] = digits[v[i] & 15];
  }
  blake2b_update(s, text, sizeof(text));
}

static void order_number(blake2b_state *s, uint64_t v) {
  char digits[20];
  int n = 0;
  do { digits[n++] = (char)('0' + v % 10); v /= 10; } while (v);
  while (n) blake2b_update(s, &digits[--n], 1);
}

static int order_signature(const uint8_t *script, const uint8_t *self,
                           const uint8_t *extra, uint64_t seller_revision) {
  uint8_t header[208], genesis[32], digest[32], recovered[33], owner[32];
  uint8_t owner_script[73] = {73, 0, 0, 0, 16, 0, 0, 0, 48, 0, 0, 0, 49, 0, 0, 0};
  uint64_t n = sizeof(header);
  size_t pub_len = sizeof(recovered);
  if (ckb_load_header(header, &n, 0, 0, CKB_SOURCE_HEADER_DEP) ||
      n != sizeof(header) || rd(header + 16)) return 1;
  order_hash(header, sizeof(header), genesis);
  if (memcmp(genesis, script + 117, 32)) return 1;

  blake2b_state state;
  blake2b_init(&state, 32);
  order_text(&state, "Nervos Message:TRADE V2 MERKLE TOKEN SALE v1\nGenesis: ");
  order_hex32(&state, genesis);
  order_text(&state, "\nMarket: ");
  order_hex32(&state, script + 53);
  order_text(&state, "\nAsset: ");
  order_hex32(&state, script + 85);
  order_text(&state, "\nCustody: ");
  order_hex32(&state, self);
  order_text(&state, "\nSeller: ");
  order_hex32(&state, extra + 48);
  order_text(&state, "\nRevision: ");
  order_number(&state, seller_revision);
  order_text(&state, "\nQuantity: ");
  order_number(&state, rd(extra));
  order_text(&state, "\nMinimum shannons: ");
  order_number(&state, rd(extra + 8));
  order_text(&state, "\nPayout: ");
  order_hex32(&state, extra + 80);
  order_text(&state, "\nOrder id: ");
  order_hex32(&state, extra + 16);
  order_text(&state, "\nBuyer: any\nExpiry: none");
  blake2b_final(&state, digest, 32);

  if (ckb_secp256k1_custom_verify_only_initialize(&order_ctx, order_precomputed)) return 2;
  secp256k1_ecdsa_recoverable_signature sig;
  secp256k1_pubkey pub;
  if (extra[209] > 3 ||
      !secp256k1_ecdsa_recoverable_signature_parse_compact(
          &order_ctx, &sig, extra + 145, extra[209]) ||
      !secp256k1_ecdsa_recover(&order_ctx, &pub, &sig, digest) ||
      !secp256k1_ec_pubkey_serialize(&order_ctx, recovered, &pub_len, &pub,
                                     SECP256K1_EC_COMPRESSED) ||
      pub_len != sizeof(recovered) || memcmp(recovered, extra + 112, sizeof(recovered))) return 3;

  order_hash(recovered, sizeof(recovered), owner);
  static const uint8_t secp_code[32] = {
      0x9b, 0xd7, 0xe0, 0x6f, 0x3e, 0xcf, 0x4b, 0xe0, 0xf2, 0xfc, 0xd2,
      0x18, 0x8b, 0x23, 0xf1, 0xb9, 0xfc, 0xc8, 0x8e, 0x5d, 0x4b, 0x65,
      0xa8, 0x63, 0x7b, 0x17, 0x72, 0x3b, 0xbd, 0xa3, 0xcc, 0xe8};
  memcpy(owner_script + 16, secp_code, 32);
  owner_script[48] = 1;
  owner_script[49] = 20;
  memcpy(owner_script + 53, owner, 20);
  order_hash(owner_script, sizeof(owner_script), owner);
  return memcmp(owner, extra + 48, 32) != 0;
}

static int cell_capacity(int i, size_t source, uint64_t *v) {
  return field(v, 8, i, source, CKB_CELL_FIELD_CAPACITY);
}

static int empty_data(int i, size_t source) {
  uint64_t n = 0;
  return ckb_load_cell_data(0, &n, 0, i, source) == 0 && n == 0;
}

static int find_group_cell(const uint8_t *self, const uint8_t *type_hash,
                           size_t source, int *found) {
  int n = count_cells(source), count = 0;
  for (int i = 0; i < n; ++i) {
    if (lock_is(i, source, self) && type_is(i, source, type_hash)) {
      *found = i;
      ++count;
    }
  }
  return count == 1 ? 0 : 1;
}

static int count_type(const uint8_t *type_hash, size_t source) {
  int count = 0;
  for (int i = 0; i < count_cells(source); ++i) if (type_is(i, source, type_hash)) ++count;
  return count;
}

static int count_lock(const uint8_t *lock_hash, size_t source) {
  int count = 0;
  for (int i = 0; i < count_cells(source); ++i) if (lock_is(i, source, lock_hash)) ++count;
  return count;
}

static int owner_input(const uint8_t owner[32], int require_empty_data) {
  int n = count_cells(CKB_SOURCE_INPUT);
  for (int i = 0; i < n; ++i) {
    uint8_t h[32];
    if (!standard_owner(i, CKB_SOURCE_INPUT) ||
        field(h, 32, i, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH) ||
        memcmp(h, owner, 32)) continue;
    if (!require_empty_data || (plain(i, CKB_SOURCE_INPUT) && empty_data(i, CKB_SOURCE_INPUT))) return i;
  }
  return -1;
}

static int xudt_amount(int i, size_t source, uint64_t *amount) {
  uint8_t d[16];
  if (bytes(d, 16, i, source)) return 1;
  for (int j = 8; j < 16; ++j) if (d[j]) return 1;
  *amount = rd(d);
  return 0;
}

static int fee_ok(void) {
  __uint128_t in = 0, out = 0;
  for (int i = 0; i < count_cells(CKB_SOURCE_INPUT); ++i) {
    uint64_t c;
    if (cell_capacity(i, CKB_SOURCE_INPUT, &c)) return 0;
    in += c;
  }
  for (int i = 0; i < count_cells(CKB_SOURCE_OUTPUT); ++i) {
    uint64_t c;
    if (cell_capacity(i, CKB_SOURCE_OUTPUT, &c)) return 0;
    out += c;
  }
  return in >= out && in - out <= FEE_LIMIT;
}

static int revision_valid(const trade_smt_update_t *u) {
  uint64_t ob = rd(u->old_value), or = rd(u->old_value + 8);
  uint64_t nb = rd(u->new_value), nr = rd(u->new_value + 8);
  int old_empty = u->old_value[16] == 0;
  if (old_empty) return nr == 1 && u->new_value[16] == 1 && nb > 0;
  if (or == UINT64_MAX || nr != or + 1) return 0;
  if (nb) return u->new_value[16] == 1;
  return u->new_value[16] == 2;
}

int main(void) {
  uint8_t script[181], self[32], token_in[48], token_out[48],
          marker_in[64], marker_out[64];
  uint64_t n = sizeof(script);
  if (ckb_load_script(script, &n, 0) || n != sizeof(script) ||
      script[49] != 128 || script[50] || script[51] || script[52]) return 1;
  n = 32;
  if (ckb_load_script_hash(self, &n, 0) || n != 32) return 2;

  int ti = -1, to = -1, mi = -1, mo = -1;
  if (find_group_cell(self, script + 85, CKB_SOURCE_INPUT, &ti) ||
      find_group_cell(self, script + 85, CKB_SOURCE_OUTPUT, &to) ||
      find_group_cell(self, script + 149, CKB_SOURCE_INPUT, &mi) ||
      find_group_cell(self, script + 149, CKB_SOURCE_OUTPUT, &mo)) return 3;
  if (count_lock(self, CKB_SOURCE_INPUT) != 2 || count_lock(self, CKB_SOURCE_OUTPUT) != 2) return 3;
  uint8_t th[32];
  if (field(th, 32, ti, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH) ||
      memcmp(th, script + 85, 32) ||
      field(th, 32, to, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH) ||
      memcmp(th, script + 85, 32)) return 4;

  if (bytes(token_in, 48, ti, CKB_SOURCE_INPUT) ||
      bytes(token_out, 48, to, CKB_SOURCE_OUTPUT) ||
      bytes(marker_in, 64, mi, CKB_SOURCE_INPUT) ||
      bytes(marker_out, 64, mo, CKB_SOURCE_OUTPUT) ||
      memcmp(marker_in, marker_out, 64) ||
      memcmp(marker_in, self, 32) || memcmp(marker_in + 32, script + 85, 32)) return 5;
  uint64_t ci, co, cmi, cmo;
  if (cell_capacity(ti, CKB_SOURCE_INPUT, &ci) ||
      cell_capacity(to, CKB_SOURCE_OUTPUT, &co) || ci != co ||
      cell_capacity(mi, CKB_SOURCE_INPUT, &cmi) ||
      cell_capacity(mo, CKB_SOURCE_OUTPUT, &cmo) || cmi != cmo || !fee_ok()) return 6;

  int ni = count_cells(CKB_SOURCE_INPUT);
  trade_smt_transition_t t;
  memset(&t, 0, sizeof(t));
  if (trade_smt_load((uint64_t)ni, CKB_SOURCE_INPUT, script, &t)) return 7;
  __int128 delta = 0;
  if (trade_smt_roots(token_in, token_out, &t, &delta)) return 8;

  __int128 signed_delta = 0;
  int decreases = 0, increases = 0;
  for (uint16_t i = 0; i < t.count; ++i) {
    trade_smt_update_t *u = &t.updates[i];
    if (!revision_valid(u)) return 9;
    uint64_t old_balance = rd(u->old_value), new_balance = rd(u->new_value);
    signed_delta += (__int128)new_balance - (__int128)old_balance;
    if (new_balance < old_balance) ++decreases;
    if (new_balance > old_balance) ++increases;
  }
  if (signed_delta != delta) return 10;

  switch (t.op) {
    case TRADE_SMT_BUY:
      if (increases != t.count || t.count != 1) return 20;
      for (uint16_t i = 0; i < t.count; ++i) if (owner_input(t.updates[i].owner, 1) < 0) return 21;
      break;
    case TRADE_SMT_BATCH_BUY:
      if (increases != t.count || t.count < 2 || t.count > 16) return 22;
      for (uint16_t i = 0; i < t.count; ++i) if (owner_input(t.updates[i].owner, 1) < 0) return 23;
      break;
    case TRADE_SMT_TRANSFER:
      if (t.count != 2 || decreases != 1 || increases != 1 || delta) return 24;
      if (count_type(script + 85, CKB_SOURCE_INPUT) != 1 || count_type(script + 85, CKB_SOURCE_OUTPUT) != 1) return 24;
      for (uint16_t i = 0; i < t.count; ++i) if (rd(t.updates[i].new_value) < rd(t.updates[i].old_value) && owner_input(t.updates[i].owner, 1) < 0) return 25;
      if (xudt_amount(ti, CKB_SOURCE_INPUT, &ci) || xudt_amount(to, CKB_SOURCE_OUTPUT, &co) || ci != co) return 26;
      break;
    case TRADE_SMT_CURVE_SELL:
      if (t.count != 1 || decreases != 1 || delta >= 0 || owner_input(t.updates[0].owner, 1) < 0) return 27;
      break;
    case TRADE_SMT_WITHDRAW: {
      if (t.count != 1 || decreases != 1 || delta >= 0 || owner_input(t.updates[0].owner, 1) < 0) return 28;
      if (count_type(script + 85, CKB_SOURCE_INPUT) != 1 || count_type(script + 85, CKB_SOURCE_OUTPUT) != 2) return 28;
      uint64_t q = (uint64_t)(-delta), external_total = 0;
      int external = -1, count = 0;
      for (int i = 0; i < count_cells(CKB_SOURCE_OUTPUT); ++i) {
        if (i == to || !type_is(i, CKB_SOURCE_OUTPUT, script + 85)) continue;
        ++count; external = i;
      }
      if (count != 1 || xudt_amount(external, CKB_SOURCE_OUTPUT, &external_total) || external_total != q ||
          !lock_is(external, CKB_SOURCE_OUTPUT, t.updates[0].owner)) return 29;
      break;
    }
    case TRADE_SMT_DEPOSIT: {
      if (t.count != 1 || increases != 1 || delta <= 0) return 30;
      if (count_type(script + 85, CKB_SOURCE_INPUT) != 2 || count_type(script + 85, CKB_SOURCE_OUTPUT) != 1) return 30;
      uint64_t q = (uint64_t)delta, external_total = 0;
      int external = -1, count = 0;
      for (int i = 0; i < count_cells(CKB_SOURCE_INPUT); ++i) {
        if (i == ti || !type_is(i, CKB_SOURCE_INPUT, script + 85)) continue;
        ++count; external = i;
      }
      if (count != 1 || xudt_amount(external, CKB_SOURCE_INPUT, &external_total) || external_total != q ||
          !lock_is(external, CKB_SOURCE_INPUT, t.updates[0].owner) ||
          owner_input(t.updates[0].owner, 0) < 0) return 31;
      break;
    }
    case TRADE_SMT_CANCEL:
      if (t.count != 1 || delta || rd(t.updates[0].old_value) != rd(t.updates[0].new_value) ||
          owner_input(t.updates[0].owner, 1) < 0) return 32;
      break;
    case TRADE_SMT_ORDER_FILL:
      if (t.count != 2 || delta || t.extra_len != ORDER_EXTRA_BYTES ||
          count_cells(CKB_SOURCE_INPUT) != 3 || count_cells(CKB_SOURCE_OUTPUT) != 4 ||
          count_type(script + 85, CKB_SOURCE_INPUT) != 1 ||
          count_type(script + 85, CKB_SOURCE_OUTPUT) != 1 ||
          rd(token_in) != rd(token_out)) return 33;
      {
        uint8_t buyer[32], payout[32];
        if (!standard_owner(2, CKB_SOURCE_INPUT) || !plain(2, CKB_SOURCE_INPUT) ||
            field(buyer, 32, 2, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH) ||
            !plain(2, CKB_SOURCE_OUTPUT) || !lock_is(2, CKB_SOURCE_OUTPUT, buyer) ||
            !plain(3, CKB_SOURCE_OUTPUT) ||
            field(payout, 32, 3, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH) ||
            memcmp(payout, t.extra + 80, 32) ||
            field(&co, 8, 3, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY) ||
            co < rd(t.extra + 8)) return 34;
        uint8_t nonzero = 0;
        for (int i = 0; i < 32; ++i) nonzero |= t.extra[48 + i];
        uint64_t quantity = rd(t.extra);
        if (!quantity || !rd(t.extra + 8) || !nonzero ||
            !memcmp(buyer, t.extra + 48, 32)) return 35;

        int seller_i = -1, buyer_i = -1;
        for (uint16_t i = 0; i < t.count; ++i) {
          if (!memcmp(t.updates[i].owner, t.extra + 48, 32)) seller_i = (int)i;
          if (!memcmp(t.updates[i].owner, buyer, 32)) buyer_i = (int)i;
        }
        if (seller_i < 0 || buyer_i < 0 || seller_i == buyer_i ||
            owner_input(t.extra + 48, 0) >= 0) return 36;
        const trade_smt_update_t *seller = &t.updates[seller_i];
        const trade_smt_update_t *recipient = &t.updates[buyer_i];
        uint64_t seller_balance = rd(seller->old_value);
        uint64_t seller_revision = rd(seller->old_value + 8);
        uint64_t buyer_balance = rd(recipient->old_value);
        uint64_t buyer_revision = rd(recipient->old_value + 8);
        if (seller->old_value[16] != 1 || seller_balance < quantity ||
            seller_revision == UINT64_MAX ||
            rd(seller->new_value) != seller_balance - quantity ||
            rd(seller->new_value + 8) != seller_revision + 1 ||
            (rd(seller->new_value) ? seller->new_value[16] != 1 : seller->new_value[16] != 2) ||
            (recipient->old_value[16] == 0
                 ? (buyer_balance != 0 || buyer_revision != 0 ||
                    rd(recipient->new_value) != quantity || rd(recipient->new_value + 8) != 1 ||
                    recipient->new_value[16] != 1)
                 : (buyer_revision == UINT64_MAX || buyer_balance > UINT64_MAX - quantity ||
                    rd(recipient->new_value) != buyer_balance + quantity ||
                    rd(recipient->new_value + 8) != buyer_revision + 1 ||
                    recipient->new_value[16] != 1))) return 37;
        if (order_signature(script, self, t.extra, seller_revision)) return 38;
      }
      break;
    default:
      return 34;
  }
  return 0;
}
