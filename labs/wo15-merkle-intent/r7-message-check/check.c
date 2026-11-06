#define main r7_unused_main
#include "../r7/candidate.c"
#undef main

// Isolated signature check only: no claim that a vault or entitlement exists.
int main(void) {
  uint8_t w[266], h[32], script[73]={73,0,0,0,16,0,0,0,48,0,0,0,49,0,0,0};
  uint64_t n=sizeof(w);
  if(ckb_load_witness(w,&n,0,1,CKB_SOURCE_INPUT)||n!=sizeof(w))return 90;
  const uint8_t *leaf=w+96,*pub=w+168,*sig=w+201;
  static const uint8_t code[32]={0x9b,0xd7,0xe0,0x6f,0x3e,0xcf,0x4b,0xe0,0xf2,0xfc,0xd2,0x18,0x8b,0x23,0xf1,0xb9,0xfc,0xc8,0x8e,0x5d,0x4b,0x65,0xa8,0x63,0x7b,0x17,0x72,0x3b,0xbd,0xa3,0xcc,0xe8};
  hash(pub,33,h);memcpy(script+16,code,32);script[48]=1;script[49]=20;memcpy(script+53,h,20);hash(script,73,h);
  if(memcmp(h,leaf,32))return 84;
  return trade_ccc_verify(pub,sig,w,w+32,w+64,rd(w+152),leaf,rd(w+160))?85:0;
}
