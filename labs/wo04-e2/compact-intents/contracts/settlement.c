/* E2D-P1A: compact pre-OutPoint commitment; consumed-OutPoint settlement identity. */
#include "ckb_syscalls.h"
#include <stdint.h>
#include <string.h>
#include "hash.h"
#include "proof.h"
#include "publisher.h"
#define TERMS 536
#ifndef COMMIT_BYTES
#define COMMIT_BYTES 32
#endif
#define ARGS COMMIT_BYTES
static uint8_t script[128],witness[MAX_PROOF],root[104];
static uint64_t be64(const uint8_t*p){uint64_t v=0;for(int i=0;i<8;i++)v=(v<<8)|p[i];return v;}
static int zero(const uint8_t*p,size_t n){for(size_t i=0;i<n;i++)if(p[i])return 0;return 1;}
static void merkle(uint8_t*out,const uint8_t*p,unsigned count,unsigned width){uint8_t c[16][32]={0};memcpy(c,p,count*32);while(width>1){for(unsigned i=0;i<width;i+=2)sha(c[i],64,c[i/2]);width/=2;}memcpy(out,c[0],32);}
static void beacon_root(const uint8_t*b,uint8_t*out){uint8_t c[8][32]={0};memcpy(c[0],b,8);memcpy(c[1],b+8,8);memcpy(c[2],b+16,96);merkle(out,(uint8_t*)c,8,8);}
static int bound_time(const uint8_t*p,const uint8_t*rt,uint64_t*time){
 uint8_t h[32],v[64];beacon_root(p,h);if(memcmp(h,rt+125,32))return 110;
 const uint8_t*c=p+112;merkle(h,c,15,16);unsigned index=25;
 for(unsigned i=0;i<4;i++){if(index&1){memcpy(v,p+592+32*i,32);memcpy(v+32,h,32);}else{memcpy(v,h,32);memcpy(v+32,p+592+32*i,32);}sha(v,64,h);index>>=1;}
 if(index!=1||memcmp(h,p+80,32))return 111;
 if(memcmp(c+64,root+32,32)||memcmp(c+192,root+64,8)||!zero(c+200,24)||memcmp(c+384,root+72,32)||!zero(c+296,24))return 112;
 *time=le64(c+288);return 0;
}
int main(void){
 uint64_t n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=ARGS+53||le32(script+49)!=ARGS)return 10;uint8_t h[32],it[32],rt[157],input[44];
 /* GLOBAL input count, not merely the lock-group count: no shared-output claims. */
 n=0;if(ckb_load_input(h,&n,0,1,CKB_SOURCE_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 14;
 n=sizeof(witness);if(ckb_load_witness(witness,&n,0,0,CKB_SOURCE_INPUT)||n<1293||n>sizeof(witness))return 17;
 uint64_t witness_size=n;uint8_t*a=witness+1;sha(a,TERMS,h);if(memcmp(h,script+53,COMMIT_BYTES))return 27;
 n=44;if(ckb_load_input(input,&n,0,0,CKB_SOURCE_INPUT)||n!=44||memcmp(input+8,witness+537,36))return 16;
 n=32;if(ckb_load_cell_by_field(it,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)!=CKB_ITEM_MISSING)return 28;
 n=0;if(ckb_load_cell_data(h,&n,0,0,CKB_SOURCE_INPUT)||n)return 29;
 /* Canonical ABI static fields, identities and amounts. */
 uint8_t domain[32];sha((const uint8_t*)"CKB-E2D-P1-ORDER-V1",19,domain);if(memcmp(a,domain,32))return 11;
 if(!zero(a+64,12)||!zero(a+288,12)||!zero(a+352,12)||!zero(a+384,12)||!zero(a+416,24)||!zero(a+448,24)||!zero(a+192,32)||zero(a+224,32)||zero(a+256,32)||zero(a+300,20)||zero(a+320,32)||zero(a+364,20)||zero(a+396,20)||!memcmp(a+364,a+396,20))return 12;
 if(!zero(a+32,24)||be64(a+56)!=1337)return 19;
 uint64_t deadline=be64(a+440),principal=be64(a+472),fee=le64(a+528),cap=0;if(!deadline||!principal||principal+fee<principal)return 13;

 n=8;if(ckb_load_cell_by_field(&cap,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||cap!=principal+fee)return 15;

 n=sizeof(rt);if(ckb_load_cell_by_field(rt,&n,0,0,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=157||rt[48]!=4||le32(rt+49)!=104||memcmp(rt+16,publisher,32)||memcmp(rt+85,publisher,32)||memcmp(rt+53,a+128,32)||le64(rt+117)<le64(a+512))return 101;
 n=104;if(ckb_load_cell_data(root,&n,0,0,CKB_SOURCE_CELL_DEP)||n!=104)return 102;
 uint8_t raw[64];memcpy(raw,a+96,32);memcpy(raw+32,a+128,32);sha(raw,64,h);if(memcmp(root,h,32)||le64(root+64)<le64(a+520))return 103;

 uint8_t mode=witness[0];if(mode>1)return 18;uint64_t timestamp;int r=bound_time(witness+573,rt,&timestamp);if(r)return r;
 uint8_t id[32],slot[32],value[32],preimage[64]={0},identifier[544]={0};
 memcpy(identifier,a,480);memcpy(identifier+480,input+8,32);
 for(unsigned i=0;i<4;i++)identifier[540+i]=input[43-i];
 sha(identifier,sizeof(identifier),id);memcpy(preimage,id,32);kh(preimage,64,slot);
 Wire w={witness+1293,(size_t)witness_size-1293,0};int present;r=prove(&w,root+32,a+76,a+480,slot,value,&present);if(r||w.off!=w.n)return 40+(r?r:34);
 if(mode==1){if(!present||memcmp(value,id,32))return 20;}else{if(present||timestamp<=deadline)return 21;}
 n=32;if(ckb_load_cell_by_field(h,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||memcmp(h,a+(mode?224:256),32))return 22;
 n=8;if(ckb_load_cell_by_field(&cap,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||cap!=principal)return 23;
 n=32;if(ckb_load_cell_by_field(h,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)!=CKB_ITEM_MISSING)return 24;
 n=0;if(ckb_load_cell_data(h,&n,0,0,CKB_SOURCE_OUTPUT)||n)return 25;
 n=8;if(ckb_load_cell_by_field(&cap,&n,0,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)!=CKB_INDEX_OUT_OF_BOUND)return 26;
 return 0;
}
