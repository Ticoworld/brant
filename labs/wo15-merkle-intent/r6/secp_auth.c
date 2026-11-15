// R5 wire/digest compatibility adapter. Upstream provenance in README.md.
#include "secp256k1_helper.h"
static secp256k1_context context;
static unsigned char precomputed[CKB_SECP256K1_DATA_SIZE] __attribute__((aligned(16)));
static int initialized;
int trade_secp_verify(const unsigned char *pub, const unsigned char *compact, const unsigned char *message) {
  if (!initialized) {
    int ret = ckb_secp256k1_custom_verify_only_initialize(&context, precomputed);
    if (ret) return ret;
    initialized = 1;
  }
  secp256k1_pubkey key;
  secp256k1_ecdsa_signature sig, normalized;
  unsigned char digest[32];
  secp256k1_sha256 hash;
  secp256k1_sha256_initialize(&hash);
  secp256k1_sha256_write(&hash, message, 32);
  secp256k1_sha256_finalize(&hash, digest);
  if (!secp256k1_ec_pubkey_parse(&context, &key, pub, 33)) return 1;
  if (!secp256k1_ecdsa_signature_parse_compact(&context, &sig, compact)) return 2;
  // Zig accepts both S forms. libsecp verifies low-S: normalize without changing validity.
  secp256k1_ecdsa_signature_normalize(&context, &normalized, &sig);
  return secp256k1_ecdsa_verify(&context, &normalized, digest, &key) ? 0 : 3;
}
