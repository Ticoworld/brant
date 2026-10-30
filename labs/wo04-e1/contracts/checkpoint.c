// Execution proof checkpoint. Bootstrap root authentication is NOT implemented.
#include "ckb_syscalls.h"
#include <stdint.h>
#include <string.h>
#include "proof.h"
static uint8_t script[256],proof[MAX_PROOF],boot[104],out[72];
int main(void){uint64_t n=0;uint8_t b[32];if(ckb_load_cell(b,&n,0,0,CKB_SOURCE_GROUP_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 10;n=0;if(ckb_load_cell(b,&n,0,1,CKB_SOURCE_GROUP_OUTPUT)!=CKB_INDEX_OUT_OF_BOUND)return 11;n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=201||le32(script+49)!=148)return 12;uint8_t*a=script+53;n=104;if(dep(a,boot,&n)||n!=104||memcmp(boot,a+84,32))return 13;n=72;if(ckb_load_cell_data(out,&n,0,0,CKB_SOURCE_GROUP_OUTPUT)||n!=72||memcmp(out,a+84,32)||memcmp(out+64,boot+64,8))return 14;n=sizeof(proof);if(ckb_load_witness(proof,&n,0,1,CKB_SOURCE_INPUT)||n>sizeof(proof))return 15;Wire w={proof,(size_t)n,0};uint8_t value[32];int r=prove(&w,boot+32,a+32,a+52,a+116,value);if(r||w.off!=w.n)return 40+r;if(memcmp(value,out+32,32))return 16;return 0;}
