// Experimental inventory lock, purchase-only; no production use.
// args: identity (32), initial price (u64), price step (u64), supply (u64).
#include "../wo09-open-markets/contracts/common.h"
static int f(void *p,uint64_t n,size_t i,size_t s,size_t field_id){return field(p,n,i,s,field_id);}
static int amount(size_t i,size_t s,uint64_t *v){uint8_t d[16];if(bytes(d,16,i,s))return 1;for(int j=8;j<16;j++)if(d[j])return 1;*v=rd(d);return 0;}
static int capacity(size_t i,size_t s,uint64_t *v){return f(v,8,i,s,CKB_CELL_FIELD_CAPACITY);}
int main(void){
 uint8_t script[109],self[32],asset[32],other[32],buyer[32],w[16];uint64_t n=sizeof(script),before,after,delivered,ci,co;
 if(ckb_load_script(script,&n,0)||n!=sizeof(script)||script[49]!=56||script[50]||script[51]||script[52])return 1;
 uint64_t base=rd(script+85),step=rd(script+93),supply=rd(script+101);if(!base||!step||!supply||supply>0xffffffffULL)return 2;
 n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 3;
 int ni=count_cells(CKB_SOURCE_INPUT);if((ni!=2&&ni!=3)||count_cells(CKB_SOURCE_OUTPUT)!=3)return 4;
 __uint128_t in_total=0,out_total=0;for(int i=0;i<ni;i++){uint64_t c;if(capacity(i,CKB_SOURCE_INPUT,&c))return 22;in_total+=c;}for(int i=0;i<3;i++){uint64_t c;if(capacity(i,CKB_SOURCE_OUTPUT,&c))return 22;out_total+=c;}if(in_total<out_total||in_total-out_total>FEE_LIMIT)return 23;
 if(!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self))return 5;
 if(f(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||f(other,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,other,32))return 6;
 if(ni==3){
  uint64_t input_tokens,output_tokens;
  if(amount(0,CKB_SOURCE_INPUT,&before)||amount(0,CKB_SOURCE_OUTPUT,&after)||after> supply||after<=before)return 13;
  uint64_t q=after-before,sold=supply-after;
  if(amount(1,CKB_SOURCE_INPUT,&input_tokens)||amount(1,CKB_SOURCE_OUTPUT,&output_tokens)||input_tokens<q||output_tokens!=input_tokens-q)return 14;
  if(f(other,32,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(other,asset,32)||f(other,32,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(other,asset,32))return 15;
  if(!standard_owner(1,CKB_SOURCE_INPUT)||f(buyer,32,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(2,CKB_SOURCE_INPUT,buyer)||!plain(2,CKB_SOURCE_INPUT)||!lock_is(1,CKB_SOURCE_OUTPUT,buyer)||!lock_is(2,CKB_SOURCE_OUTPUT,buyer)||!plain(2,CKB_SOURCE_OUTPUT))return 16;
  n=sizeof(w);if(ckb_load_witness(w,&n,0,3,CKB_SOURCE_INPUT)||n!=sizeof(w)||rd(w)!=q)return 17;
  __uint128_t start=(__uint128_t)base+(__uint128_t)step*sold;if(start>UINT64_MAX)return 18;
  __uint128_t first=start*q,slope=(__uint128_t)step*q*(q-1)/2;if(first>UINT64_MAX||slope>UINT64_MAX)return 18;
  __uint128_t cost=first+slope;if(cost>UINT64_MAX||cost<rd(w+8))return 18;
  if(capacity(0,CKB_SOURCE_INPUT,&ci)||capacity(0,CKB_SOURCE_OUTPUT,&co)||(__uint128_t)co+cost!=ci)return 19;
  uint64_t sin1,sin2,sout1,sout2;
  if(capacity(1,CKB_SOURCE_INPUT,&sin1)||capacity(2,CKB_SOURCE_INPUT,&sin2)||capacity(1,CKB_SOURCE_OUTPUT,&sout1)||capacity(2,CKB_SOURCE_OUTPUT,&sout2))return 20;
  if((__uint128_t)sout1+sout2+FEE_LIMIT<(__uint128_t)sin1+sin2+cost)return 21;
  return 0;
 }
 if(amount(0,CKB_SOURCE_INPUT,&before)||amount(0,CKB_SOURCE_OUTPUT,&after)||before>supply||after>=before)return 7;
 uint64_t q=before-after,sold=supply-before;
 if(amount(1,CKB_SOURCE_OUTPUT,&delivered)||delivered!=q||f(other,32,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(asset,other,32))return 8;
 if(!plain(1,CKB_SOURCE_INPUT)||!standard_owner(1,CKB_SOURCE_INPUT)||f(buyer,32,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(1,CKB_SOURCE_OUTPUT,buyer)||!lock_is(2,CKB_SOURCE_OUTPUT,buyer)||!plain(2,CKB_SOURCE_OUTPUT))return 9;
 n=sizeof(w);if(ckb_load_witness(w,&n,0,2,CKB_SOURCE_INPUT)||n!=sizeof(w)||rd(w)!=q)return 10;
 __uint128_t start=(__uint128_t)base+(__uint128_t)step*sold;
 if(start>UINT64_MAX)return 11;
 __uint128_t first=start*q, slope=(__uint128_t)step*q*(q-1)/2;
 if(first>UINT64_MAX||slope>UINT64_MAX)return 11;
 __uint128_t cost=first+slope;
 if(cost>UINT64_MAX||cost>rd(w+8))return 11;
 if(capacity(0,CKB_SOURCE_INPUT,&ci)||capacity(0,CKB_SOURCE_OUTPUT,&co)||(__uint128_t)ci+cost!=co)return 12;
 return 0;
}
