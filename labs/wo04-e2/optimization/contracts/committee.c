/* Immutable Capella bootstrap committee certificate, not finalized root state.
 * Every creation proves the fixed external checkpoint. No update/spend is valid.
 */
#include "common.h"
static const uint8_t checkpoint[32]={0x5a,0xfc,0x21,0x2a,0x79,0x24,0x78,0x9b,0x2b,0xc8,0x6a,0xca,0xd3,0xab,0x3a,0x6f,0xfb,0x1f,0x6e,0x97,0x25,0x3e,0xa5,0x0b,0xee,0x7f,0x4f,0x51,0x42,0x2c,0x92,0x75};
int main(void){
 uint8_t b[448],out[264],script[64],h[32],expected[264]={0};uint64_t n=0;
 if(ckb_load_cell(h,&n,0,0,CKB_SOURCE_GROUP_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 40;
 n=0;if(ckb_load_cell(h,&n,0,1,CKB_SOURCE_GROUP_OUTPUT)!=CKB_INDEX_OUT_OF_BOUND)return 41;
 n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=53||memcmp(script+49,"\0\0\0\0",4))return 42;
 n=448;if(ckb_load_witness(b,&n,0,0,CKB_SOURCE_INPUT)||n!=448)return 43;
 beacon_root(b,h);if(memcmp(h,checkpoint,32))return 44;
 uint8_t*kr=b+272,*agg=kr+32,*uncompressed=agg+48;
 uint8_t pair[64]={0},pk[64]={0};memcpy(pair,kr,32);memcpy(pk,agg,48);sha(pk,64,pair+32);sha(pair,64,h);
 memcpy(expected+8,h,32);branch(h,b+112,54,5);if(memcmp(h,b+48,32))return 45;
 blst_p1_affine p;uint8_t c[48],u[96];
 if(blst_p1_deserialize(&p,uncompressed)!=BLST_SUCCESS||blst_p1_affine_is_inf(&p)||!blst_p1_affine_in_g1(&p))return 46;
 blst_p1_affine_compress(c,&p);blst_p1_affine_serialize(u,&p);if(memcmp(c,agg,48)||memcmp(u,uncompressed,96))return 47;
 memcpy(expected,"E2COM01",7);memcpy(expected+40,kr,32);memcpy(expected+72,agg,48);memcpy(expected+120,uncompressed,96);
 uint64_t period=le(b)/8192;for(unsigned i=0;i<8;i++)expected[216+i]=(uint8_t)(period>>(i*8));memcpy(expected+224,checkpoint,32);expected[256]=1;
 n=264;if(ckb_load_cell_data(out,&n,0,0,CKB_SOURCE_GROUP_OUTPUT)||n!=264||memcmp(out,expected,264))return 48;
 return 0;
}
