#include "layout.h"
int main(void){
 uint8_t script[200],h[32],before[STATE_SIZE],after[STATE_SIZE],out[104],want[104];uint64_t n=0;
 if(ckb_load_cell(h,&n,0,0,CKB_SOURCE_GROUP_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 60;
 n=0;if(ckb_load_cell(h,&n,0,1,CKB_SOURCE_GROUP_OUTPUT)!=CKB_INDEX_OUT_OF_BOUND)return 61;
 n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=157||script[49]!=104||script[50]||script[51]||script[52])return 62;
 uint8_t*a=script+53;if(memcmp(a+32,script+16,32))return 68;
 if(!type_matches(0,CKB_SOURCE_INPUT,a)||!type_matches(0,CKB_SOURCE_OUTPUT,a))return 63;
 uint8_t st[100];n=100;if(ckb_load_cell_by_field(st,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE)||n!=85||st[48]!=4||memcmp(st+16,a+32,32))return 64;
 if(cell_data(before,STATE_SIZE,0,CKB_SOURCE_INPUT)||cell_data(after,STATE_SIZE,0,CKB_SOURCE_OUTPUT)||state_policy(before)||state_policy(after))return 65;
 if(le(before+72)==UINT64_MAX||le(after+72)!=le(before+72)+1||le(after+80)<=le(before+80)||le(a+64)!=le(after+72)||memcmp(a+72,after+88,32))return 66;
 domain(a,want);memcpy(want+32,after+120,72);
 if(cell_data(out,104,0,CKB_SOURCE_GROUP_OUTPUT)||memcmp(out,want,104))return 67;
 return 0;
}
