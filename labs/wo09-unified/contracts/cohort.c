// Trade bounded cohort research covenant. Reuses reviewed WO09 common syscall helpers.
#include "../../wo09-open-markets/contracts/common.h"
#ifndef COHORT
#define COHORT 3
#endif
#define SIZE (96+48*COHORT)
#ifdef SNAPSHOT
// Authenticated full old/new snapshots in an extra transaction witness.
// No Merkle membership, succinct prover or hidden state database is used.
static int snapshot_bytes(void *dest,uint64_t size,size_t index,size_t src){
 if(size!=SIZE)return 95;
 uint8_t committed[32],w[2*SIZE],h[32];
 if(bytes(committed,32,index,src))return 96;
 uint64_t n=sizeof(w);int inputs=count_cells(CKB_SOURCE_INPUT);
 if(inputs<1||ckb_load_witness(w,&n,0,(size_t)inputs,CKB_SOURCE_INPUT)||n!=sizeof(w))return 97;
 const uint8_t *state=w+(src==CKB_SOURCE_OUTPUT?SIZE:0);
 blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,state,SIZE);blake2b_final(&st,h,32);
 if(memcmp(committed,h,32))return 98;memcpy(dest,state,SIZE);return 0;
}
#define bytes snapshot_bytes
#endif

static int pure(int i,size_t src){uint64_t n=0;return plain(i,src)&&standard_owner(i,src)&&ckb_load_cell_data(0,&n,0,i,src)==0&&n==0;}
static uint64_t cap(int i,size_t src){uint64_t v=0;return field(&v,8,i,src,CKB_CELL_FIELD_CAPACITY)?0:v;}
static int wallet(int i,size_t src,const uint8_t*h){return pure(i,src)&&lock_is(i,src,h);}
static int fee_ok(int ni,int no){__uint128_t a=0,b=0;for(int i=0;i<ni;i++)a+=cap(i,CKB_SOURCE_INPUT);for(int i=0;i<no;i++)b+=cap(i,CKB_SOURCE_OUTPUT);return a>=b&&a-b<=FEE_LIMIT;}
static __uint128_t liability(const uint8_t*d){__uint128_t s=0;for(int i=0;i<COHORT;i++)s+=rd(d+96+48*i+(rd(d+80)?40:32));return s;}
static int valid(const uint8_t*d,uint64_t c){if(memcmp(d,"TCW0001",8)||rd(d+80)>1||rd(d+88)>>56)return 0;for(int i=0;i<COHORT;i++){const uint8_t*r=d+96+48*i;uint64_t p=rd(r+32),b=rd(r+40);if((__uint128_t)p*4/5<b)return 0;if(!p){for(int j=0;j<48;j++)if(r[j])return 0;}}return (__uint128_t)rd(d+72)+liability(d)==c;}
int main(void){uint8_t script[85],self[32],a[SIZE],b[SIZE];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT);if(ni<1||no<1)return 11;int vi=-1,vo=-1;
 for(int s=0;s<2;s++){int n=s?no:ni;size_t src=s?CKB_SOURCE_OUTPUT:CKB_SOURCE_INPUT;for(int i=0;i<n;i++){int t=type_is(i,src,self),l=lock_is(i,src,self);if(t!=l)return 12;if(t){if((s?vo:vi)!=-1)return 13;if(s)vo=i;else vi=i;}}}
 if(vi<0){if(vo!=0||minted_id(script+53,0)||bytes(b,SIZE,vo,CKB_SOURCE_OUTPUT)||!valid(b,cap(vo,CKB_SOURCE_OUTPUT)))return 20;if(rd(b+80)||liability(b)||!lock_is(0,CKB_SOURCE_INPUT,b+8))return 21;for(int i=96;i<SIZE;i++)if(b[i])return 22;return 0;}
 if(vi!=0||bytes(a,SIZE,0,CKB_SOURCE_INPUT)||!valid(a,cap(0,CKB_SOURCE_INPUT)))return 30;
 if(!fee_ok(ni,no))return 31;
 if(vo<0){if(liability(a)||ni!=2||no!=1||!wallet(1,CKB_SOURCE_INPUT,a+8)||!wallet(0,CKB_SOURCE_OUTPUT,a+8)||(__uint128_t)cap(0,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 32;return 0;}
 if(vo!=0||bytes(b,SIZE,0,CKB_SOURCE_OUTPUT)||!valid(b,cap(0,CKB_SOURCE_OUTPUT))||memcmp(a,b,80)||memcmp(a+88,b+88,8))return 33;
 int changed=-1,count=0;for(int i=0;i<COHORT;i++)if(memcmp(a+96+i*48,b+96+i*48,48)){changed=i;count++;}
 if(!rd(a+80)&&rd(b+80)==1){if(count||ni!=2||no!=2||!wallet(1,CKB_SOURCE_INPUT,a+40)||!wallet(1,CKB_SOURCE_OUTPUT,a+40))return 40;for(int i=0;i<COHORT;i++)if(!rd(a+96+i*48+32))return 41;__uint128_t gross=liability(a)-liability(b);if((__uint128_t)cap(0,CKB_SOURCE_OUTPUT)+gross!=cap(0,CKB_SOURCE_INPUT))return 42;return 0;}
 if(rd(a+80)!=rd(b+80)||count!=1)return 43;
 const uint8_t*x=a+96+changed*48,*y=b+96+changed*48;
 if(!rd(a+80)&&!rd(x+32)){ // enrollment: one payer, one exact funded entry
  uint64_t p=rd(y+32);if(ni!=2||no!=2||!p||rd(y+40)!=(__uint128_t)p*4/5||!wallet(1,CKB_SOURCE_INPUT,y)||!wallet(1,CKB_SOURCE_OUTPUT,y))return 50;
  for(int i=0;i<COHORT;i++)if(i!=changed&&rd(a+96+i*48+32)&&!memcmp(y,a+96+i*48,32))return 51;
  if((__uint128_t)cap(0,CKB_SOURCE_INPUT)+p!=cap(0,CKB_SOURCE_OUTPUT))return 52;return 0;
 }
 if(rd(a+80)&&memcmp(x,y,32)){ // atomic assignment; complete seller and buyer signatures required
  if(ni!=3||no!=3||memcmp(x+32,y+32,16)||!rd(x+40)||!wallet(1,CKB_SOURCE_INPUT,x)||!wallet(1,CKB_SOURCE_OUTPUT,x)||!wallet(2,CKB_SOURCE_INPUT,y)||!wallet(2,CKB_SOURCE_OUTPUT,y))return 60;
  if(cap(0,CKB_SOURCE_INPUT)!=cap(0,CKB_SOURCE_OUTPUT)||cap(1,CKB_SOURCE_OUTPUT)<=cap(1,CKB_SOURCE_INPUT))return 61;
  return 0;
 }
 // partial or complete redemption; before activation refund the entire contribution.
 if(ni!=2||no!=2||!wallet(1,CKB_SOURCE_INPUT,x)||!wallet(1,CKB_SOURCE_OUTPUT,x))return 70;
 if(rd(a+80)){if(memcmp(x,y,40)||rd(y+40)>=rd(x+40)||!absolute_since(0,rd(a+88)))return 71;}
 else {for(int j=0;j<48;j++)if(y[j])return 72;}
 if(cap(0,CKB_SOURCE_OUTPUT)>=cap(0,CKB_SOURCE_INPUT))return 73;
 if(cap(1,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 74;
 return 0;
}
