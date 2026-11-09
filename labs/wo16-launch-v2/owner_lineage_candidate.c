// Experimental one-shot plain xUDT issuer. Args: anchor outpoint (36),
// xUDT code hash (32), inventory lock hash (32), supply LE128 (16).
// The anchor must be independently controlled. This is unverified research code.
#include "ckb_syscalls.h"
#include "blake2b.h"
#include <stdint.h>
#include <string.h>
int main(void) {
  uint8_t script[169], self[32], input[44], typ[85], lock[32], data[16], market[141], identity[32];
  uint64_t n=sizeof(script);
  if (ckb_load_script(script,&n,0)||n!=sizeof(script)||script[49]!=116||script[50]||script[51]||script[52]) return 1;
  n=32; if (ckb_load_script_hash(self,&n,0)||n!=32) return 2;
  for(int j=4;j<16;j++)if(script[153+j])return 11;
  if(!(script[153]|script[154]|script[155]|script[156]))return 11;
  blake2b_state state;blake2b_init(&state,32);blake2b_update(&state,script+53,36);blake2b_final(&state,identity,32);
  int anchor=0, outputs=0;
  for(size_t i=0;i<128;i++) {
    n=sizeof(input); int r=ckb_load_input(input,&n,0,i,CKB_SOURCE_INPUT);
    if(r==CKB_INDEX_OUT_OF_BOUND) break;
    if(r||n!=sizeof(input)) return 3;
    if(!memcmp(input+8,script+53,36)) anchor++;
  }
  if(anchor!=1) return 4;
  n=sizeof(input); if(ckb_load_input(input,&n,0,128,CKB_SOURCE_INPUT)!=CKB_INDEX_OUT_OF_BOUND) return 9;
  for(size_t i=0;i<128;i++) {
    n=sizeof(typ); int r=ckb_load_cell_by_field(typ,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE);
    if(r==CKB_INDEX_OUT_OF_BOUND) break;
    if(r==CKB_ITEM_MISSING) continue;
    if(r) return 5;
    if(n!=85||memcmp(typ+16,script+89,32)||typ[48]!=2||typ[49]!=32||typ[50]||typ[51]||typ[52]||memcmp(typ+53,self,32)) continue;
    n=32; if(ckb_load_cell_by_field(lock,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||n!=32||memcmp(lock,script+121,32)) return 6;
    n=sizeof(market);if(ckb_load_cell_by_field(market,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=sizeof(market)||market[49]!=88||market[50]||market[51]||market[52]||memcmp(market+53,identity,32)||memcmp(market+101,script+153,8))return 12;
    n=16; if(ckb_load_cell_data(data,&n,0,i,CKB_SOURCE_OUTPUT)||n!=16||memcmp(data,script+153,16)) return 7;
    outputs++;
  }
  n=sizeof(typ); int end=ckb_load_cell_by_field(typ,&n,0,128,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK);
  if(end!=CKB_INDEX_OUT_OF_BOUND) return 10;
  return outputs==1 ? 0 : 8;
}

