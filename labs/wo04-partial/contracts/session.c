// WO04 ISOLATED RESEARCH. Not production-safe or audited.
#include "ckb_syscalls.h"
#include "monocypher-ed25519.h"
#include <stdint.h>
#include <string.h>
#define SZ 112
#define FEE 100000ULL
#define MARK 20000000000ULL
static uint64_t u64(const uint8_t*p){uint64_t v=0;for(int i=0;i<8;i++)v|=(uint64_t)p[i]<<(8*i);return v;}
static int count(size_t src,size_t idx,int input){uint8_t b[64];uint64_t n=sizeof(b);return input?ckb_load_input(b,&n,0,idx,src):ckb_load_cell(b,&n,0,idx,src);}
static int cap(size_t src,size_t idx,uint64_t want){uint64_t v=0,n=8;return ckb_load_cell_by_field(&v,&n,0,idx,src,CKB_CELL_FIELD_CAPACITY)||n!=8||v!=want;}
static int lock(size_t idx,const uint8_t*h){uint8_t b[32];uint64_t n=32;return ckb_load_cell_by_field(b,&n,0,idx,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||n!=32||memcmp(b,h,32);}
static int plain(size_t idx){uint8_t b[32];uint64_t n=32;if(ckb_load_cell_by_field(b,&n,0,idx,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)!=CKB_ITEM_MISSING)return 1;n=32;return ckb_load_cell_data(b,&n,0,idx,CKB_SOURCE_OUTPUT)||n;}
int main(void){uint8_t script[256],data[128],out[128],w[256],lh[32];uint64_t n=sizeof(script);
 if(ckb_load_script(script,&n,0)||n!=245||script[49]!=192||script[50]||script[51]||script[52])return 10;
 const uint8_t*a=script+53;n=sizeof(data);if(ckb_load_cell_data(data,&n,0,0,CKB_SOURCE_GROUP_INPUT)||n!=121||data[0]>1)return 11;
 if(count(CKB_SOURCE_GROUP_INPUT,1,1)!=CKB_INDEX_OUT_OF_BOUND)return 12;
 const uint8_t*old=data+1;uint64_t total=u64(old+48),reserve=u64(data+113);if(reserve<FEE||total+reserve<total||total+reserve+MARK<total+reserve||cap(CKB_SOURCE_INPUT,0,total+reserve+MARK))return 13;
 if(memcmp(old,a+128,32)||memcmp(old+80,a+160,32)||u64(old+64)>total||u64(old+72)>u64(old+56))return 14;
 n=sizeof(w);if(ckb_load_witness(w,&n,0,0,CKB_SOURCE_INPUT))return 15;uint8_t mode=w[0];
 if(mode==2){uint64_t since=0,nn=8;if(n!=1||data[0]!=1||ckb_load_input_by_field(&since,&nn,0,0,CKB_SOURCE_INPUT,CKB_INPUT_FIELD_SINCE)||since!=(0x8000000000000000ULL|5))return 16;
  if(count(CKB_SOURCE_INPUT,1,1)!=CKB_INDEX_OUT_OF_BOUND||count(CKB_SOURCE_OUTPUT,3,0)!=CKB_INDEX_OUT_OF_BOUND)return 17;
  uint64_t x=u64(old+64);if(x+reserve-FEE<x||cap(CKB_SOURCE_OUTPUT,0,x+reserve-FEE)||cap(CKB_SOURCE_OUTPUT,1,total-x)||cap(CKB_SOURCE_OUTPUT,2,MARK)||lock(0,a+64)||lock(1,a+96)||lock(2,a+64)||plain(0)||plain(1))return 18;
  nn=sizeof(out);if(ckb_load_cell_data(out,&nn,0,2,CKB_SOURCE_OUTPUT)||nn!=SZ||memcmp(out,old,SZ))return 19;nn=32;if(ckb_load_cell_by_field(lh,&nn,0,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)!=CKB_ITEM_MISSING)return 20;return 0;
 }
 if(n!=241||mode>5)return 21;const uint8_t*s=w+1;
 if(memcmp(s,a+128,32)||memcmp(s+80,a+160,32)||u64(s+64)>u64(s+48)||u64(s+72)>u64(s+56))return 22;
 if(crypto_ed25519_check(w+113,a,s,SZ)||crypto_ed25519_check(w+177,a+32,s,SZ))return 23;
 if(mode==0||mode==1){if(data[0]!=(mode==0?0:1)||u64(s+32)!=u64(old+32)||u64(s+48)!=total||u64(s+56)!=u64(old+56)||u64(s+40)<u64(old+40)||(mode==1&&u64(s+40)==u64(old+40)))return 24;}
 else if(mode==3||mode==4||mode==5){if(data[0]!=0||u64(old+32)==UINT64_MAX||u64(s+32)!=u64(old+32)+1||u64(s+40)!=0)return 25;if(mode==3&&u64(s+48)<=total)return 26;if(mode==5&&(u64(s+48)!=total||u64(s+56)<u64(old+56)))return 39;if(mode==4&&(u64(s+48)>=total||u64(s+56)!=u64(old+56)||u64(s+72)!=u64(old+72)||u64(old+64)<total-u64(s+48)||u64(s+64)!=u64(old+64)-(total-u64(s+48))))return 27;}
 else return 28;
 n=sizeof(out);if(ckb_load_cell_data(out,&n,0,0,CKB_SOURCE_OUTPUT)||n!=121||out[0]!=((mode<2)?1:0)||memcmp(out+1,s,SZ)||u64(out+113)!=reserve-FEE)return 29;
 n=32;if(ckb_load_cell_by_field(lh,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||lock(0,lh))return 30;
 n=32;if(ckb_load_cell_by_field(lh,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)!=CKB_ITEM_MISSING)return 31;
 uint64_t nt=u64(s+48);if(nt+reserve-FEE<nt||nt+reserve-FEE+MARK<nt||cap(CKB_SOURCE_OUTPUT,0,nt+reserve-FEE+MARK))return 32;
 if(mode==3){if(count(CKB_SOURCE_INPUT,2,1)!=CKB_INDEX_OUT_OF_BOUND||count(CKB_SOURCE_OUTPUT,2,0)!=CKB_INDEX_OUT_OF_BOUND)return 33;uint64_t donor=0,nn=8;if(ckb_load_cell_by_field(&donor,&nn,0,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||donor<nt-total||cap(CKB_SOURCE_OUTPUT,1,donor-(nt-total))||plain(1))return 34;nn=32;if(ckb_load_cell_by_field(lh,&nn,0,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||lock(1,lh))return 35;}
 else {if(count(CKB_SOURCE_INPUT,1,1)!=CKB_INDEX_OUT_OF_BOUND)return 36;if(mode==4){if(count(CKB_SOURCE_OUTPUT,2,0)!=CKB_INDEX_OUT_OF_BOUND||cap(CKB_SOURCE_OUTPUT,1,total-nt)||lock(1,a+64)||plain(1))return 37;}else if(count(CKB_SOURCE_OUTPUT,1,0)!=CKB_INDEX_OUT_OF_BOUND)return 38;}
 return 0;
}
