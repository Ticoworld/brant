#ifndef E2B_LAYOUT_H
#define E2B_LAYOUT_H
#include "common.h"
#include "blake2b.h"
#define STATE_SIZE 280
#define CERT_SIZE 296
static const uint8_t checkpoint[32]={0x5a,0xfc,0x21,0x2a,0x79,0x24,0x78,0x9b,0x2b,0xc8,0x6a,0xca,0xd3,0xab,0x3a,0x6f,0xfb,0x1f,0x6e,0x97,0x25,0x3e,0xa5,0x0b,0xee,0x7f,0x4f,0x51,0x42,0x2c,0x92,0x75};
static void put64(uint8_t*p,uint64_t v){for(unsigned i=0;i<8;i++)p[i]=(uint8_t)(v>>(8*i));}
static int zero32(const uint8_t*p){uint8_t b[32]={0};return memcmp(p,b,32)==0;}
static void ckh(const uint8_t*p,size_t n,uint8_t*h){blake2b_state b;ckb_blake2b_init(&b,32);blake2b_update(&b,p,n);blake2b_final(&b,h,32);}
static int cell_data(uint8_t*p,uint64_t n,size_t i,size_t source){uint64_t actual=n;return ckb_load_cell_data(p,&actual,0,i,source)||actual!=n;}
static int type_matches(size_t i,size_t source,const uint8_t*hash){uint8_t h[32];uint64_t n=32;return !ckb_load_cell_by_field(h,&n,0,i,source,CKB_CELL_FIELD_TYPE_HASH)&&n==32&&!memcmp(h,hash,32);}
static int state_policy(const uint8_t*s){return memcmp(s,"E2STATE1",8)||memcmp(s+8,genesis,32)||memcmp(s+40,checkpoint,32)||s[272]!=3||s[273]||s[274]||s[275]||memcmp(s+276,"\0\0\0\0",4)||le(s+192)!=le(s+80)/8192;}
static void domain(const uint8_t*lineage,uint8_t*out){uint8_t b[64];memcpy(b,genesis,32);memcpy(b+32,lineage,32);sha(b,64,out);}
static int point1(blst_p1_affine*p,const uint8_t*c,const uint8_t*u){uint8_t canonical[96],compressed[48];if(blst_p1_deserialize(p,u)!=BLST_SUCCESS||blst_p1_affine_is_inf(p))return 1;blst_p1_affine_serialize(canonical,p);blst_p1_affine_compress(compressed,p);return memcmp(canonical,u,96)||memcmp(compressed,c,48);}
static int point2(blst_p2_affine*p,const uint8_t*c,const uint8_t*u){uint8_t canonical[192],compressed[96];if(blst_p2_deserialize(p,u)!=BLST_SUCCESS||blst_p2_affine_is_inf(p))return 1;blst_p2_affine_serialize(canonical,p);blst_p2_affine_compress(compressed,p);return memcmp(canonical,u,192)||memcmp(compressed,c,96);}
#endif
