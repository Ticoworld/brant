// Small generative reservation identity. Research implementation, not audited.
#include "ckb_syscalls.h"
#include "blake2b.h"
#include <stdint.h>
#include <string.h>
int main(void){uint8_t s[128],h[32],input[44],message[52],dummy[8];uint64_t n=sizeof(s);if(ckb_load_script(s,&n,0)||n!=85||s[49]!=32||s[50]||s[51]||s[52])return 10;
 n=0;int hasInput=ckb_load_cell(dummy,&n,0,0,CKB_SOURCE_GROUP_INPUT)==CKB_SUCCESS;n=0;if(ckb_load_cell(dummy,&n,0,1,CKB_SOURCE_GROUP_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 11;n=0;if(ckb_load_cell(dummy,&n,0,1,CKB_SOURCE_GROUP_OUTPUT)!=CKB_INDEX_OUT_OF_BOUND)return 12;if(hasInput)return 0;
 n=32;if(ckb_load_script_hash(h,&n,0))return 13;size_t index;for(index=0;index<100;index++){uint8_t v[32];n=32;int r=ckb_load_cell_by_field(v,&n,0,index,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)return 14;if(!r&&n==32&&!memcmp(v,h,32))break;}if(index==100)return 15;n=44;if(ckb_load_input(input,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 16;memcpy(message,input,44);for(int i=0;i<8;i++)message[44+i]=(uint8_t)((uint64_t)index>>(8*i));blake2b_state state;blake2b_init(&state,32);blake2b_update(&state,message,52);blake2b_final(&state,h,32);if(memcmp(h,s+53,32))return 17;return 0;}
