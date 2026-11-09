// Singleton-backed market candidate. Args: original 56 bytes || marker type hash.
#include "../wo09-open-markets/contracts/common.h"
static int amt(int i,size_t s,uint64_t*v){uint8_t d[16];if(bytes(d,16,i,s))return 1;for(int j=8;j<16;j++)if(d[j])return 1;*v=rd(d);return 0;}
static int cp(int i,size_t s,uint64_t*v){return field(v,8,i,s,CKB_CELL_FIELD_CAPACITY);}
int main(void){
 uint8_t script[141],self[32],asset[32],h[32],buyer[32],w[16],marker[64];uint64_t n=sizeof(script),before,after,ci,co;
 if(ckb_load_script(script,&n,0)||n!=sizeof(script)||script[49]!=88||script[50]||script[51]||script[52])return 1;
 uint64_t base=rd(script+85),step=rd(script+93),supply=rd(script+101);if(!base||!step||!supply||supply>0xffffffffULL)return 2;
 n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 3;
 int ni=count_cells(CKB_SOURCE_INPUT);if((ni!=3&&ni!=4)||count_cells(CKB_SOURCE_OUTPUT)!=4)return 4;
 if(!type_is(1,CKB_SOURCE_INPUT,script+109)||!type_is(1,CKB_SOURCE_OUTPUT,script+109)||!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!lock_is(1,CKB_SOURCE_INPUT,self)||!lock_is(1,CKB_SOURCE_OUTPUT,self))return 5;
 if(bytes(marker,64,1,CKB_SOURCE_INPUT)||memcmp(marker,self,32)||field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(marker+32,asset,32)||!type_is(0,CKB_SOURCE_OUTPUT,asset))return 6;
 __uint128_t it=0,ot=0;for(int i=0;i<ni;i++){uint64_t c;if(cp(i,CKB_SOURCE_INPUT,&c))return 22;it+=c;}for(int i=0;i<4;i++){uint64_t c;if(cp(i,CKB_SOURCE_OUTPUT,&c))return 22;ot+=c;}if(it<ot||it-ot>FEE_LIMIT)return 23;
 if(amt(0,CKB_SOURCE_INPUT,&before)||amt(0,CKB_SOURCE_OUTPUT,&after)||before>supply||after>supply)return 7;
 uint64_t q,sold;
 if(ni==3){
  if(after>=before)return 7;q=before-after;sold=supply-before;uint64_t delivered;
  if(amt(2,CKB_SOURCE_OUTPUT,&delivered)||delivered!=q||!type_is(2,CKB_SOURCE_OUTPUT,asset))return 8;
  if(!plain(2,CKB_SOURCE_INPUT)||!standard_owner(2,CKB_SOURCE_INPUT)||field(buyer,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(2,CKB_SOURCE_OUTPUT,buyer)||!lock_is(3,CKB_SOURCE_OUTPUT,buyer)||!plain(3,CKB_SOURCE_OUTPUT))return 9;
 }else{
  if(after<=before)return 13;q=after-before;sold=supply-after;uint64_t x,y;
  if(amt(2,CKB_SOURCE_INPUT,&x)||amt(2,CKB_SOURCE_OUTPUT,&y)||x<q||y!=x-q||!type_is(2,CKB_SOURCE_INPUT,asset)||!type_is(2,CKB_SOURCE_OUTPUT,asset))return 14;
  if(!standard_owner(2,CKB_SOURCE_INPUT)||field(buyer,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(3,CKB_SOURCE_INPUT,buyer)||!plain(3,CKB_SOURCE_INPUT)||!lock_is(2,CKB_SOURCE_OUTPUT,buyer)||!lock_is(3,CKB_SOURCE_OUTPUT,buyer)||!plain(3,CKB_SOURCE_OUTPUT))return 16;
 }
 n=16;if(ckb_load_witness(w,&n,0,ni,CKB_SOURCE_INPUT)||n!=16||rd(w)!=q)return 10;
 __uint128_t start=(__uint128_t)base+(__uint128_t)step*sold;if(start>UINT64_MAX)return 11;
 __uint128_t first=start*q,slope=(__uint128_t)step*q*(q-1)/2;if(first>UINT64_MAX||slope>UINT64_MAX)return 11;__uint128_t price=first+slope;if(price>UINT64_MAX)return 11;
 if(cp(0,CKB_SOURCE_INPUT,&ci)||cp(0,CKB_SOURCE_OUTPUT,&co))return 12;
 if(ni==3){if(price>rd(w+8)||(__uint128_t)ci+price!=co)return 12;}
 else{if(price<rd(w+8)||(__uint128_t)co+price!=ci)return 19;}
 // Marker occupied capacity cannot subsidize trades.
 if(cp(1,CKB_SOURCE_INPUT,&ci)||cp(1,CKB_SOURCE_OUTPUT,&co)||ci!=co)return 24;
 return 0;
}
