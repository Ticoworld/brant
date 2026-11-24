// Experimental singleton pairing marker for one xUDT custody lineage.
#include "../wo09-open-markets/contracts/common.h"
static void hash(const uint8_t *p,size_t n,uint8_t *h){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,h,32);}
int main(void){uint8_t script[85],self[32],before[64],after[64],in[44],message[52],id[32],asset[32];uint64_t n=85;
if(ckb_load_script(script,&n,0)||n!=85||script[49]!=32||script[50]||script[51]||script[52])return 1;n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 1;
int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ic=0,oc=0,ii=-1,oi=-1;if(ni<1||no<2)return 2;
for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ic++;ii=i;}for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oc++;oi=i;}if(oc!=1||ic>1)return 3;
if(!ic){uint8_t cl[181],market[141],mh[32];if(oi!=3)return 4;
 n=181;if(ckb_load_cell_by_field(cl,&n,0,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=181||cl[49]!=128||cl[50]||cl[51]||cl[52]||memcmp(cl+149,self,32))return 5;
 memcpy(mh,cl+53,32);
#ifdef BRANT_ATOMIC_MARKER
#ifdef BRANT_ATOMIC_MULTI
 if(ni>=1&&!lock_is(0,CKB_SOURCE_INPUT,mh)){
#else
 if(ni==1){
#endif
  if(memcmp(script+53,mh,32)||!standard_owner(0,CKB_SOURCE_INPUT)||!plain(0,CKB_SOURCE_INPUT))return 5;
  n=44;if(ckb_load_input(in,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 5;hash(in+8,36,id);
  n=141;if(ckb_load_cell_by_field(market,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=141||market[49]!=88||memcmp(market+53,id,32)||!lock_is(0,CKB_SOURCE_OUTPUT,mh)||!type_is(1,CKB_SOURCE_OUTPUT,market+109))return 5;
 }else
#endif
 {if(memcmp(script+53,mh,32)||!lock_is(0,CKB_SOURCE_INPUT,mh)||!lock_is(1,CKB_SOURCE_INPUT,mh))return 5;
 n=141;if(ckb_load_cell_by_field(market,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK)||n!=141||market[49]!=88||!type_is(1,CKB_SOURCE_INPUT,market+109))return 5;}
 if(bytes(after,64,3,CKB_SOURCE_OUTPUT)||!lock_is(2,CKB_SOURCE_OUTPUT,after)||!lock_is(3,CKB_SOURCE_OUTPUT,after)||field(asset,32,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,after+32,32)||memcmp(asset,cl+85,32))return 6;return 0;}
if(ii==3&&oi==3){if(ni<5||ni>20||no!=ni||bytes(before,64,3,CKB_SOURCE_INPUT)||bytes(after,64,3,CKB_SOURCE_OUTPUT)||memcmp(before,after,64)||!lock_is(2,CKB_SOURCE_INPUT,before)||!lock_is(3,CKB_SOURCE_INPUT,before)||!lock_is(2,CKB_SOURCE_OUTPUT,before)||!lock_is(3,CKB_SOURCE_OUTPUT,before)||field(asset,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32)||field(asset,32,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32))return 10;return 0;}
if(ii!=1||oi!=1||bytes(before,64,1,CKB_SOURCE_INPUT)||bytes(after,64,1,CKB_SOURCE_OUTPUT)||memcmp(before,after,64))return 7;
if(!lock_is(0,CKB_SOURCE_INPUT,before)||!lock_is(1,CKB_SOURCE_INPUT,before)||!lock_is(0,CKB_SOURCE_OUTPUT,before)||!lock_is(1,CKB_SOURCE_OUTPUT,before))return 8;
if(field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32)||field(asset,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,before+32,32))return 9;return 0;}
