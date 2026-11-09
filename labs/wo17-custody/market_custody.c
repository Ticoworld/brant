// Experimental WO16 singleton curve adapted for one custody purchase.
#include "../wo09-open-markets/contracts/common.h"
#include "custody_hash.h"
static int amt(int i,size_t s,uint64_t*v){uint8_t d[16];if(bytes(d,16,i,s))return 1;for(int j=8;j<16;j++)if(d[j])return 1;*v=rd(d);return 0;}
static int cp(int i,size_t s,uint64_t*v){return field(v,8,i,s,CKB_CELL_FIELD_CAPACITY);}
static void root(const uint8_t *buyer,const uint8_t *q,uint8_t *out){uint8_t leaf[32],tag=0,zero[32]={0};blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,buyer,32);blake2b_update(&s,q,8);blake2b_final(&s,leaf,32);tag=1;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,leaf,32);blake2b_update(&s,zero,32);blake2b_final(&s,out,32);}
int main(void){uint8_t script[141],self[32],asset[32],buyer[32],w[16],marker[64],cl[149],d[48],r[32];uint64_t n=sizeof(script),before,after,ci,co;
if(ckb_load_script(script,&n,0)||n!=141||script[49]!=88||script[50]||script[51]||script[52])return 1;uint64_t base=rd(script+85),step=rd(script+93),supply=rd(script+101);if(!base||!step||!supply||supply>0xffffffffULL)return 2;n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 3;
if(count_cells(CKB_SOURCE_INPUT)!=3||count_cells(CKB_SOURCE_OUTPUT)!=4)return 4;
if(!type_is(1,CKB_SOURCE_INPUT,script+109)||!type_is(1,CKB_SOURCE_OUTPUT,script+109)||!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!lock_is(1,CKB_SOURCE_INPUT,self)||!lock_is(1,CKB_SOURCE_OUTPUT,self))return 5;
if(bytes(marker,64,1,CKB_SOURCE_INPUT)||memcmp(marker,self,32)||field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(marker+32,asset,32)||!type_is(0,CKB_SOURCE_OUTPUT,asset)||!type_is(2,CKB_SOURCE_OUTPUT,asset))return 6;
if(!plain(2,CKB_SOURCE_INPUT)||!standard_owner(2,CKB_SOURCE_INPUT)||field(buyer,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(3,CKB_SOURCE_OUTPUT,buyer)||!plain(3,CKB_SOURCE_OUTPUT))return 7;
if(amt(0,CKB_SOURCE_INPUT,&before)||amt(0,CKB_SOURCE_OUTPUT,&after)||before>supply||after>=before)return 8;uint64_t q=before-after;
n=149;if(ckb_load_cell_by_field(cl,&n,0,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=149||memcmp(cl+16,custody_code,32)||cl[48]!=2||cl[49]!=96||cl[50]||cl[51]||cl[52]||memcmp(cl+53,self,32)||memcmp(cl+85,buyer,32)||memcmp(cl+117,asset,32))return 9;
if(bytes(d,48,2,CKB_SOURCE_OUTPUT)||rd(d)!=q)return 10;for(int j=8;j<16;j++)if(d[j])return 10;root(buyer,d,r);if(memcmp(r,d+16,32))return 11;
n=16;if(ckb_load_witness(w,&n,0,3,CKB_SOURCE_INPUT)||n!=16||rd(w)!=q)return 12;__uint128_t price=((__uint128_t)base+(__uint128_t)step*(supply-before))*q+(__uint128_t)step*q*(q-1)/2;if(price>UINT64_MAX||price>rd(w+8)||cp(0,CKB_SOURCE_INPUT,&ci)||cp(0,CKB_SOURCE_OUTPUT,&co)||(__uint128_t)ci+price!=co)return 13;
if(cp(1,CKB_SOURCE_INPUT,&ci)||cp(1,CKB_SOURCE_OUTPUT,&co)||ci!=co)return 14;__uint128_t it=0,ot=0;for(int j=0;j<3;j++){if(cp(j,CKB_SOURCE_INPUT,&ci))return 15;it+=ci;}for(int j=0;j<4;j++){if(cp(j,CKB_SOURCE_OUTPUT,&co))return 15;ot+=co;}if(it<ot||it-ot>FEE_LIMIT)return 16;return 0;}
