/* Single-committee, Capella mainnet cryptographic harness.
 * NOT a deployable light-client state cell: bootstrap/rotation are host verified.
 * General paths check member subgroups; the full-participation path authenticates
 * the canonical aggregate and keeps blst's aggregate/signature subgroup checks.
 */
#include "ckb_syscalls.h"
#include "blst.h"
#include "hash.h"


static uint8_t packet[30000];
static uint64_t le(const uint8_t*p){uint64_t v=0;for(int i=0;i<8;i++)v|=(uint64_t)p[i]<<(8*i);return v;}
static void merkle(uint8_t out[32],const uint8_t*p,unsigned count,unsigned width){
 uint8_t chunks[512][32]={0};memcpy(chunks,p,count*32);
 while(width>1){for(unsigned i=0;i<width;i+=2)sha(chunks[i],64,chunks[i/2]);width/=2;}
 memcpy(out,chunks[0],32);
}
static void beacon_root(const uint8_t*b,uint8_t out[32]){
 uint8_t c[8][32]={0};memcpy(c[0],b,8);memcpy(c[1],b+8,8);memcpy(c[2],b+16,96);merkle(out,(uint8_t*)c,8,8);
}
static int branch(uint8_t root[32],const uint8_t*nodes,unsigned index,unsigned depth){
 uint8_t b[64];for(unsigned i=0;i<depth;i++){if(index&1){memcpy(b,nodes+32*i,32);memcpy(b+32,root,32);}else{memcpy(b,root,32);memcpy(b+32,nodes+32*i,32);}sha(b,64,root);index>>=1;}return index!=1;
}
static const uint8_t genesis[32]={75,54,61,185,78,40,97,32,215,110,185,5,52,15,221,78,84,191,233,240,107,243,63,246,207,90,210,127,81,27,254,149};
