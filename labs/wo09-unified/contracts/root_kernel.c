// Representation microbenchmark ONLY: no enrollment, owner auth, reserve or closure semantics.
#include "../../wo09-open-markets/contracts/common.h"
static void hash_pair(const uint8_t*l,const uint8_t*r,uint8_t*out){blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,l,32);blake2b_update(&st,r,32);blake2b_final(&st,out,32);}
static void root(uint8_t*out,const uint8_t*leaf,const uint8_t*proof,uint64_t index,int depth){memcpy(out,leaf,32);for(int d=0;d<depth;d++){uint8_t t[32];if((index>>d)&1)hash_pair(proof+32*d,out,t);else hash_pair(out,proof+32*d,t);memcpy(out,t,32);}}
int main(void){uint8_t script[85],self[32],a[160],b[160],w[400],h[32];if(script32(script,self))return 10;int mode=script[53],depth=script[54];if(mode>1||depth<1||depth>10)return 11;int bitmap=mode?(((1<<depth)+7)/8):0,len=32+bitmap;uint64_t capi,capo;
 if(!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!plain(0,CKB_SOURCE_INPUT)||!plain(0,CKB_SOURCE_OUTPUT)||bytes(a,len,0,CKB_SOURCE_INPUT)||bytes(b,len,0,CKB_SOURCE_OUTPUT)||field(&capi,8,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||field(&capo,8,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||capi!=capo)return 12;
 uint64_t n=sizeof(w);if(ckb_load_witness(w,&n,0,0,CKB_SOURCE_INPUT)||n!=(uint64_t)(mode?40:72)+32*depth)return 13;uint64_t i=rd(w);if(i>=(1ULL<<depth))return 14;
 root(h,w+8,w+(mode?40:72),i,depth);if(memcmp(h,a,32))return 15;
 if(!mode){root(h,w+40,w+72,i,depth);if(memcmp(h,b,32))return 16;}
 else {if(memcmp(a,b,32)||a[32+i/8]&(1<<(i%8)))return 17;a[32+i/8]|=1<<(i%8);if(memcmp(a,b,len))return 18;}
 return 0;
}
