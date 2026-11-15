// Isolated funded cash-right transfer pool. Research only; no issuer grant or operator key.
#include "../../../wo09-open-markets/contracts/common.h"
#define SZ 144
#define MAXW 16384
extern int trade_ed_verify(const uint8_t*,const uint8_t*,const uint8_t*);
static uint8_t w[MAXW];
static uint64_t cap(int i,size_t s){uint64_t v=0;return field(&v,8,i,s,CKB_CELL_FIELD_CAPACITY)?0:v;}
static int pure(int i,size_t s){uint64_t n=0;return plain(i,s)&&standard_owner(i,s)&&ckb_load_cell_data(0,&n,0,i,s)==0&&!n;}
static int same_wallet(int i,int o){uint8_t h[32];return pure(i,CKB_SOURCE_INPUT)&&pure(o,CKB_SOURCE_OUTPUT)&&!field(h,32,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)&&lock_is(o,CKB_SOURCE_OUTPUT,h);}
static void h32(const void*p,size_t n,uint8_t*out){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,out,32);}
static void branch(const uint8_t*l,const uint8_t*r,uint8_t*out){uint8_t p[65];p[0]=2;memcpy(p+1,l,32);memcpy(p+33,r,32);h32(p,65,out);}
static int depth(uint64_t n){int d=0;while((1ULL<<d)<n)d++;return d;}
static int leafvalid(const uint8_t*r){if(!rd(r+32)){for(int j=0;j<48;j++)if(r[j])return 0;}return 1;}
static void root(const uint8_t*id,uint64_t i,const uint8_t*r,const uint8_t*path,int d,uint8_t*out){uint8_t p[89];if(!rd(r+32))memset(out,0,32);else {p[0]=1;memcpy(p+1,id,32);for(int j=0;j<8;j++)p[33+j]=(uint8_t)(i>>(8*j));memcpy(p+41,r,48);h32(p,89,out);}for(int j=0;j<d;j++){uint8_t t[32];if((i>>j)&1)branch(path+32*j,out,t);else branch(out,path+32*j,t);memcpy(out,t,32);}}
static int valid(const uint8_t*s,uint64_t c){return !memcmp(s,"TCAP001",8)&&rd(s+104)>0&&rd(s+104)<=1024&&rd(s+96)<=rd(s+104)&&(__uint128_t)rd(s+72)+rd(s+80)+rd(s+88)==c;}
int main(void){uint8_t script[85],self[32],a[SZ],b[SZ];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),vi=-1,vo=-1;if(ni<1||ni>2||no<1||no>3)return 11;
 for(int side=0;side<2;side++)for(int i=0;i<(side?no:ni);i++){size_t src=side?CKB_SOURCE_OUTPUT:CKB_SOURCE_INPUT;int t=type_is(i,src,self),l=lock_is(i,src,self);if(t!=l)return 12;if(t){if((side?vo:vi)!=-1)return 13;if(side)vo=i;else vi=i;}}
 uint64_t wn=MAXW;if(ckb_load_witness(w,&wn,0,ni,CKB_SOURCE_INPUT)||wn>MAXW||wn<24)return 14;uint64_t z=0;if(ckb_load_witness(0,&z,0,ni+1,CKB_SOURCE_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 14;
 uint64_t op=rd(w),m=rd(w+8);if(m>2)return 15;
 if(vi<0){if(vo!=0||op||m||wn!=24||rd(w+16)||minted_id(script+53,0)||bytes(b,SZ,0,CKB_SOURCE_OUTPUT)||!valid(b,cap(0,CKB_SOURCE_OUTPUT))||rd(b+88)||rd(b+96)||!lock_is(0,CKB_SOURCE_INPUT,b+8))return 20;uint8_t h[32]={0};for(int j=0;j<depth(rd(b+104));j++){uint8_t t[32];branch(h,h,t);memcpy(h,t,32);}return memcmp(h,b+112,32)?21:0;}
 if(vi!=0||bytes(a,SZ,0,CKB_SOURCE_INPUT)||!valid(a,cap(0,CKB_SOURCE_INPUT)))return 30;
 __uint128_t in=0,out=0;for(int i=0;i<ni;i++)in+=cap(i,CKB_SOURCE_INPUT);for(int i=0;i<no;i++)out+=cap(i,CKB_SOURCE_OUTPUT);if(in<out||in-out>FEE_LIMIT)return 31;
 if(vo<0){if(op!=7||m||wn!=24||rd(w+16)||rd(a+88)||rd(a+96)||ni!=2||no!=1||!same_wallet(1,0)||!lock_is(1,CKB_SOURCE_INPUT,a+8)||cap(0,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 32;return 0;}
 if(vo!=0||bytes(b,SZ,0,CKB_SOURCE_OUTPUT)||!valid(b,cap(0,CKB_SOURCE_OUTPUT))||memcmp(a,b,80)||memcmp(a+104,b+104,8))return 33;
 int d=depth(rd(a+104));uint64_t stride=104+32*d,off=16+m*stride;if(off+8>wn)return 40;uint64_t na=rd(w+off);if(na>2||wn!=off+8+96*na)return 41;
 if(op==4){if(m||na||ni!=2||no!=2||!same_wallet(1,1)||memcmp(a+88,b+88,56)||rd(b+80)<=rd(a+80))return 42;return 0;}
 if(op<1||op>3||!m)return 43;
 uint8_t current[32],required[2][32];memcpy(current,a+112,32);__int128 total=rd(a+88),live=rd(a+96);uint64_t indices[2];const uint8_t *old[2],*next[2];
 for(uint64_t j=0;j<m;j++){const uint8_t *p=w+16+j*stride,*x=p+8,*y=x+48;uint64_t i=rd(p);indices[j]=i;old[j]=x;next[j]=y;if(i>=rd(a+104)||(j&&i==indices[0])||!leafvalid(x)||!leafvalid(y))return 44;uint8_t h[32];root(script+53,i,x,y+48,d,h);if(memcmp(h,current,32))return 45;root(script+53,i,y,y+48,d,current);if(!rd(x+32))live++;if(!rd(y+32))live--;total+=(__int128)rd(y+32)-rd(x+32);}
 if(total<0||total>UINT64_MAX||live<0||live>UINT64_MAX||total!=rd(b+88)||live!=rd(b+96)||memcmp(current,b+112,32))return 46;
 if(op==1){if(m!=1||na!=1||rd(old[0]+32)||!rd(next[0]+32)||rd(next[0]+40)||ni!=2||no!=2||!same_wallet(1,1)||rd(a+80)!=rd(b+80))return 50;memcpy(required[0],next[0],32);}
 else if(op==2){if(m!=2||na!=2||!rd(old[0]+32)||rd(next[0]+32)>=rd(old[0]+32)||rd(next[1]+32)<rd(old[1]+32)||!rd(next[1]+32)||rd(b+88)>rd(a+88)||rd(a+88)-rd(b+88)>in-out)return 60;
  for(int j=0;j<2;j++){if(rd(old[j]+32)){if(rd(next[j]+32)&&(memcmp(old[j],next[j],32)||rd(old[j]+40)==UINT64_MAX||rd(next[j]+40)!=rd(old[j]+40)+1))return 61;memcpy(required[j],old[j],32);}else{if(rd(next[j]+40))return 61;memcpy(required[j],next[j],32);}}
  if(ni!=no||(ni==2&&(!same_wallet(1,1)||cap(1,CKB_SOURCE_OUTPUT)>cap(1,CKB_SOURCE_INPUT))))return 62;
 }
 else {if(m!=1||na!=1||!rd(old[0]+32)||rd(next[0]+32)>=rd(old[0]+32)||(rd(next[0]+32)&&(memcmp(old[0],next[0],32)||rd(old[0]+40)==UINT64_MAX||rd(next[0]+40)!=rd(old[0]+40)+1))||(no!=2&&no!=3))return 70;uint64_t paid=rd(old[0]+32)-rd(next[0]+32);if(ni==1){if(!pure(1,CKB_SOURCE_OUTPUT)||cap(1,CKB_SOURCE_OUTPUT)>paid||paid-cap(1,CKB_SOURCE_OUTPUT)>in-out)return 71;}else if(no==3){if(!same_wallet(1,2)||!pure(1,CKB_SOURCE_OUTPUT)||cap(1,CKB_SOURCE_OUTPUT)<paid||cap(2,CKB_SOURCE_OUTPUT)>cap(1,CKB_SOURCE_INPUT))return 74;}else if(!same_wallet(1,1)||cap(1,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT)||(__uint128_t)cap(1,CKB_SOURCE_OUTPUT)>cap(1,CKB_SOURCE_INPUT)+(__uint128_t)paid||cap(1,CKB_SOURCE_INPUT)+(__uint128_t)paid-cap(1,CKB_SOURCE_OUTPUT)>in-out)return 72;memcpy(required[0],old[0],32);}
 if(rd(b+80)>rd(a+80)||rd(a+80)-rd(b+80)>in-out)return 73;
 uint8_t signatures[2][64];for(uint64_t j=0;j<na;j++){uint8_t owner[32];h32(w+off+8+96*j,32,owner);if(memcmp(owner,required[j],32))return 80;memcpy(signatures[j],w+off+40+96*j,64);memset(w+off+40+96*j,0,64);}
 uint8_t txhash[32],msg[32];uint64_t n=32;if(ckb_load_tx_hash(txhash,&n,0)||n!=32)return 81;blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,"TRADE_CAPACITY_V1",17);blake2b_update(&st,self,32);blake2b_update(&st,a+40,32);blake2b_update(&st,txhash,32);blake2b_update(&st,w,wn);blake2b_final(&st,msg,32);
 for(uint64_t j=0;j<na;j++)if(trade_ed_verify(w+off+8+96*j,signatures[j],msg))return 82;
 return 0;
}
