// Experimental singleton pairing marker for one xUDT custody lineage.
#include "../wo09-open-markets/contracts/common.h"
static void hash(const uint8_t *p,size_t n,uint8_t *h){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,h,32);}
int main(void){uint8_t script[85],self[32],before[64],after[64],in[44],message[52],id[32],asset[32];uint64_t n=85;
if(ckb_load_script(script,&n,0)||n!=85||script[49]!=32||script[50]||script[51]||script[52])return 1;n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 1;
int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ic=0,oc=0,ii=-1,oi=-1;if(ni<1||no<2)return 2;
for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ic++;ii=i;}for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oc++;oi=i;}if(oc!=1||ic>1)return 3;
if(!ic){if(oi!=3)return 4;n=44;if(ckb_load_input(in,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 5;memcpy(message,in,44);for(int j=0;j<8;j++)message[44+j]=(uint8_t)((uint64_t)3>>(8*j));hash(message,52,id);if(memcmp(id,script+53,32))return 5;if(bytes(after,64,3,CKB_SOURCE_OUTPUT)||!lock_is(2,CKB_SOURCE_OUTPUT,after)||!lock_is(3,CKB_SOURCE_OUTPUT,after)||field(asset,32,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,after+32,32))return 6;return 0;}
if(ii!=1||oi!=1||bytes(before,64,1,CKB_SOURCE_INPUT)||bytes(after,64,1,CKB_SOURCE_OUTPUT)||memcmp(before,after,64))return 7;
if(!lock_is(0,CKB_SOURCE_INPUT,before)||!lock_is(1,CKB_SOURCE_INPUT,before)||!lock_is(0,CKB_SOURCE_OUTPUT,before)||!lock_is(1,CKB_SOURCE_OUTPUT,before))return 8;
if(field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32)||field(asset,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32))return 9;return 0;}
