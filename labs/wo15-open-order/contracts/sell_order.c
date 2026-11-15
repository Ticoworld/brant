// Experimental full-fill order lock. No expiry or partial fills.
#include "ckb_syscalls.h"
#include <stdint.h>
#include <string.h>
static uint64_t rd(const uint8_t *p){uint64_t x=0;for(int i=7;i>=0;i--)x=(x<<8)|p[i];return x;}
static int field(size_t i,size_t src,size_t f,uint8_t *v){uint64_t n=32;return ckb_load_cell_by_field(v,&n,0,i,src,f)||n!=32;}
int main(void){
 uint8_t script[141],self[32],h[32],buyer[32],data[16]; uint64_t n=sizeof(script);
 if(ckb_load_script(script,&n,0)||n!=sizeof(script))return 10;
 const uint8_t *maker=script+53,*asset=script+85,*amount=script+117;uint64_t price=rd(script+133);if(!price)return 11;
 n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 12;
 size_t order=0,count=0;int maker_input=0;
 for(size_t i=0;;i++){uint8_t lock[512];n=sizeof(lock);int r=ckb_load_cell_by_field(lock,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r||n<53)return 13;
  if(!memcmp(lock+16,script+16,32)){count++;order=i;}
  if(field(i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH,h))return 14;if(!memcmp(h,maker,32))maker_input=1;
 }
 if(count!=1)return 15;
 if(field(order,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH,h)||memcmp(h,self,32))return 16;
 if(field(order,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH,h)||memcmp(h,asset,32))return 17;
 n=16;if(ckb_load_cell_data(data,&n,0,order,CKB_SOURCE_INPUT)||n!=16||memcmp(data,amount,16))return 18;
 if(maker_input)return 0;
 uint8_t witness[52];n=sizeof(witness);if(ckb_load_witness(witness,&n,0,order,CKB_SOURCE_INPUT)||n!=52||rd(witness)!=((uint64_t)16<<32|52)||rd(witness+8)!=((uint64_t)52<<32|52)||witness[16]!=32||witness[17]||witness[18]||witness[19])return 19;
 memcpy(buyer,witness+20,32);if(!memcmp(buyer,maker,32))return 19;
 int buyer_input=0;for(size_t i=0;;i++){n=32;int r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r||n!=32)return 20;if(!memcmp(h,buyer,32))buyer_input=1;}if(!buyer_input)return 21;
 uint64_t cap;n=8;if(ckb_load_cell_by_field(&cap,&n,0,order,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||price>UINT64_MAX-cap)return 22;
 int paid=0,delivered=0;for(size_t i=0;;i++){n=32;int r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r||n!=32)return 23;
  if(!memcmp(h,maker,32)){uint8_t t[32];n=32;r=ckb_load_cell_by_field(t,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH);if(r==CKB_ITEM_MISSING){uint64_t c;n=8;if(ckb_load_cell_by_field(&c,&n,0,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY))return 24;if(c>=cap+price)paid=1;}}
  if(!memcmp(h,buyer,32)){uint8_t t[32];if(!field(i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH,t)&&!memcmp(t,asset,32)){n=16;if(ckb_load_cell_data(data,&n,0,i,CKB_SOURCE_OUTPUT)||n!=16)return 25;if(!memcmp(data,amount,16))delivered++;}}
 }
 return paid&&delivered==1?0:26;
}
