// Experimental singleton curve purchase creating one indexed custody lineage.
#include "../wo09-open-markets/contracts/common.h"
#include "codes.h"
static int amt(int i,size_t s,uint64_t*v){uint8_t d[16];if(bytes(d,16,i,s))return 1;for(int j=8;j<16;j++)if(d[j])return 1;*v=rd(d);return 0;}
static int custody_amt(int i,size_t s,uint64_t*v){uint8_t d[48];if(bytes(d,48,i,s))return 1;for(int j=8;j<16;j++)if(d[j])return 1;*v=rd(d);return 0;}
static int cp(int i,size_t s,uint64_t*v){return field(v,8,i,s,CKB_CELL_FIELD_CAPACITY);}
static void digest(const uint8_t*p,size_t n,uint8_t*out){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,out,32);}
static void root(const uint8_t *records,uint8_t*out){uint8_t h[8][32],buf[65];for(uint64_t i=0;i<8;i++){uint8_t p[57];p[0]=1;for(int j=0;j<8;j++)p[1+j]=(uint8_t)(i>>(8*j));memcpy(p+9,records+48*i,48);digest(p,57,h[i]);}for(int width=8;width>1;width/=2)for(int i=0;i<width/2;i++){buf[0]=2;memcpy(buf+1,h[2*i],32);memcpy(buf+33,h[2*i+1],32);digest(buf,65,h[i]);}memcpy(out,h[0],32);}
int main(void){uint8_t script[141],self[32],asset[32],buyer[32],w[400],marker[64],cl[181],d[48],r[32],hdr[208],gh[32],id[32],in[44],msg[52],mt[85],mth[32],custody[32],cm[64];uint64_t n=141,before,after,ci,co;
if(ckb_load_script(script,&n,0)||n!=141||script[49]!=88||script[50]||script[51]||script[52])return 1;uint64_t base=rd(script+85),step=rd(script+93),supply=rd(script+101);if(!base||!step||!supply||supply>0xffffffffULL)return 2;n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 3;
if(count_cells(CKB_SOURCE_INPUT)==5&&count_cells(CKB_SOURCE_OUTPUT)==5){
/* Coupled continuation: market pair 0/1, custody pair 2/3, buyer 4. */
if(!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!lock_is(1,CKB_SOURCE_INPUT,self)||!lock_is(1,CKB_SOURCE_OUTPUT,self)||!type_is(1,CKB_SOURCE_INPUT,script+109)||!type_is(1,CKB_SOURCE_OUTPUT,script+109))return 21;
if(bytes(marker,64,1,CKB_SOURCE_INPUT)||bytes(cm,64,1,CKB_SOURCE_OUTPUT)||memcmp(marker,cm,64)||memcmp(marker,self,32)||field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(marker+32,asset,32)||!type_is(0,CKB_SOURCE_OUTPUT,asset)||!type_is(2,CKB_SOURCE_INPUT,asset)||!type_is(2,CKB_SOURCE_OUTPUT,asset))return 22;
if(field(custody,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(2,CKB_SOURCE_OUTPUT,custody)||!lock_is(3,CKB_SOURCE_INPUT,custody)||!lock_is(3,CKB_SOURCE_OUTPUT,custody)||bytes(cm,64,3,CKB_SOURCE_INPUT)||memcmp(cm,custody,32)||memcmp(cm+32,asset,32)||bytes(marker,64,3,CKB_SOURCE_OUTPUT)||memcmp(cm,marker,64))return 23;
n=181;if(ckb_load_cell_by_field(cl,&n,0,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK)||n!=181||memcmp(cl+16,custody_code,32)||cl[48]!=2||cl[49]!=128||cl[50]||cl[51]||cl[52]||memcmp(cl+53,self,32)||memcmp(cl+85,asset,32)||field(mth,32,3,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(cl+149,mth,32)||!type_is(3,CKB_SOURCE_OUTPUT,mth))return 24;
n=85;if(ckb_load_cell_by_field(mt,&n,0,3,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE)||n!=85||memcmp(mt+16,marker_code,32)||mt[48]!=2||mt[49]!=32||mt[50]||mt[51]||mt[52]||memcmp(mt+53,self,32))return 24;
if(!plain(4,CKB_SOURCE_INPUT)||!standard_owner(4,CKB_SOURCE_INPUT)||field(buyer,32,4,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(4,CKB_SOURCE_OUTPUT,buyer)||!plain(4,CKB_SOURCE_OUTPUT))return 25;
if(amt(0,CKB_SOURCE_INPUT,&before)||amt(0,CKB_SOURCE_OUTPUT,&after)||before>=supply||after>=before)return 26;uint64_t q=before-after,cb,ca;if(custody_amt(2,CKB_SOURCE_INPUT,&cb)||custody_amt(2,CKB_SOURCE_OUTPUT,&ca)||(__uint128_t)cb+q!=ca)return 27;
__uint128_t price=((__uint128_t)base+(__uint128_t)step*(supply-before))*q+(__uint128_t)step*q*(q-1)/2;if(price>UINT64_MAX||cp(0,CKB_SOURCE_INPUT,&ci)||cp(0,CKB_SOURCE_OUTPUT,&co)||(__uint128_t)ci+price!=co)return 28;
for(int j=1;j<=3;j++){if(cp(j,CKB_SOURCE_INPUT,&ci)||cp(j,CKB_SOURCE_OUTPUT,&co)||ci!=co)return 29;}__uint128_t it=0,ot=0;for(int j=0;j<5;j++){if(cp(j,CKB_SOURCE_INPUT,&ci)||cp(j,CKB_SOURCE_OUTPUT,&co))return 30;it+=ci;ot+=co;}if(it<ot||it-ot>FEE_LIMIT)return 30;return 0;
}
if(count_cells(CKB_SOURCE_INPUT)!=3||count_cells(CKB_SOURCE_OUTPUT)!=5)return 4;
if(!type_is(1,CKB_SOURCE_INPUT,script+109)||!type_is(1,CKB_SOURCE_OUTPUT,script+109)||!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!lock_is(1,CKB_SOURCE_INPUT,self)||!lock_is(1,CKB_SOURCE_OUTPUT,self))return 5;
if(bytes(marker,64,1,CKB_SOURCE_INPUT)||memcmp(marker,self,32)||field(asset,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(marker+32,asset,32)||!type_is(0,CKB_SOURCE_OUTPUT,asset)||!type_is(2,CKB_SOURCE_OUTPUT,asset))return 6;
if(!plain(2,CKB_SOURCE_INPUT)||!standard_owner(2,CKB_SOURCE_INPUT)||field(buyer,32,2,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(4,CKB_SOURCE_OUTPUT,buyer)||!plain(4,CKB_SOURCE_OUTPUT))return 7;
if(amt(0,CKB_SOURCE_INPUT,&before)||amt(0,CKB_SOURCE_OUTPUT,&after)||before!=supply||after>=before)return 8;uint64_t q=before-after;
memcpy(id,self,32);
n=85;if(ckb_load_cell_by_field(mt,&n,0,3,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE)||n!=85||memcmp(mt+16,marker_code,32)||mt[48]!=2||mt[49]!=32||mt[50]||mt[51]||mt[52]||memcmp(mt+53,id,32))return 9;if(field(mth,32,3,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH))return 9;
n=208;if(ckb_load_header(hdr,&n,0,0,CKB_SOURCE_HEADER_DEP)||n!=208||rd(hdr+16))return 10;digest(hdr,208,gh);
n=181;if(ckb_load_cell_by_field(cl,&n,0,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=181||memcmp(cl+16,custody_code,32)||cl[48]!=2||cl[49]!=128||cl[50]||cl[51]||cl[52]||memcmp(cl+53,self,32)||memcmp(cl+85,asset,32)||memcmp(cl+117,gh,32)||memcmp(cl+149,mth,32))return 11;
if(field(custody,32,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(3,CKB_SOURCE_OUTPUT,custody)||bytes(cm,64,3,CKB_SOURCE_OUTPUT)||memcmp(cm,custody,32)||memcmp(cm+32,asset,32))return 11;
if(bytes(d,48,2,CKB_SOURCE_OUTPUT)||rd(d)!=q)return 12;for(int j=8;j<16;j++)if(d[j])return 12;
n=400;if(ckb_load_witness(w,&n,0,3,CKB_SOURCE_INPUT)||n!=400||rd(w)!=q)return 13;__uint128_t total=0;for(int i=0;i<8;i++){const uint8_t *rec=w+16+48*i;uint8_t any=0;for(int j=0;j<32;j++)any|=rec[j];uint64_t bal=rd(rec+32),rev=rd(rec+40);if(rev||(!any&&bal)||(any&&!bal))return 14;if(i==0&&memcmp(rec,buyer,32))return 14;for(int j=0;j<i;j++)if(any&&!memcmp(rec,w+16+48*j,32))return 14;total+=bal;}if(total!=q)return 14;root(w+16,r);if(memcmp(r,d+16,32))return 15;
__uint128_t price=((__uint128_t)base+(__uint128_t)step*(supply-before))*q+(__uint128_t)step*q*(q-1)/2;if(price>UINT64_MAX||price>rd(w+8)||cp(0,CKB_SOURCE_INPUT,&ci)||cp(0,CKB_SOURCE_OUTPUT,&co)||(__uint128_t)ci+price!=co)return 16;
if(cp(1,CKB_SOURCE_INPUT,&ci)||cp(1,CKB_SOURCE_OUTPUT,&co)||ci!=co)return 19;__uint128_t it=0,ot=0;for(int j=0;j<3;j++){if(cp(j,CKB_SOURCE_INPUT,&ci))return 20;it+=ci;}for(int j=0;j<5;j++){if(cp(j,CKB_SOURCE_OUTPUT,&co))return 20;ot+=co;}if(it<ot||it-ot>FEE_LIMIT)return 20;return 0;}
