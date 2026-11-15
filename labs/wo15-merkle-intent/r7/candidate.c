#include "merkle_intent.c"
#include "../r6/secp256k1_helper.h"
static secp256k1_context context;
static unsigned char precomputed[CKB_SECP256K1_DATA_SIZE] __attribute__((aligned(16)));
static int initialized;
static void ccc_text(blake2b_state *s,const char *v){blake2b_update(s,v,strlen(v));}
static void ccc_hex(blake2b_state *s,const uint8_t *v){char h[66]={'0','x'};const char *d="0123456789abcdef";for(int i=0;i<32;i++){h[2+2*i]=d[v[i]>>4];h[3+2*i]=d[v[i]&15];}blake2b_update(s,h,66);}
static void ccc_number(blake2b_state *s,uint64_t v){char b[20];int n=0;do{b[n++]='0'+v%10;v/=10;}while(v);while(n)blake2b_update(s,&b[--n],1);}
int trade_ccc_verify(const uint8_t *pub,const uint8_t *signature,const uint8_t *genesis,const uint8_t *vault,const uint8_t *covenant,uint64_t index,const uint8_t *leaf,uint64_t price){
 if(!initialized){if(ckb_secp256k1_custom_verify_only_initialize(&context,precomputed))return 1;initialized=1;}
 blake2b_state s;uint8_t digest[32],recovered[33];size_t n=33;
 blake2b_init(&s,32);
 ccc_text(&s,"Nervos Message:TRADE SALE AUTHORIZATION v1\nScope: sell one funded financial position; any buyer; no expiry\nNetwork: CKB chain identified by genesis\nGenesis: ");ccc_hex(&s,genesis);
 ccc_text(&s,"\nVault: ");ccc_hex(&s,vault);ccc_text(&s,"\nCovenant script hash: ");ccc_hex(&s,covenant);
 ccc_text(&s,"\nPosition: ");ccc_number(&s,index);ccc_text(&s,"\nSeller lock hash: ");ccc_hex(&s,leaf);
 ccc_text(&s,"\nPrincipal shannons: ");ccc_number(&s,rd(leaf+32));ccc_text(&s,"\nBacking shannons: ");ccc_number(&s,rd(leaf+40));ccc_text(&s,"\nRevision: ");ccc_number(&s,rd(leaf+48));
 ccc_text(&s,"\nMinimum payment shannons: ");ccc_number(&s,price);ccc_text(&s,"\nPayment recipient lock hash: ");ccc_hex(&s,leaf);blake2b_final(&s,digest,32);
 secp256k1_ecdsa_recoverable_signature sig;secp256k1_pubkey key;
 if(signature[64]>3||!secp256k1_ecdsa_recoverable_signature_parse_compact(&context,&sig,signature,signature[64])||!secp256k1_ecdsa_recover(&context,&key,&sig,digest)||!secp256k1_ec_pubkey_serialize(&context,recovered,&n,&key,SECP256K1_EC_COMPRESSED))return 2;
 return n!=33||memcmp(recovered,pub,33);
}
