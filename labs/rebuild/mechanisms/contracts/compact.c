// Reconstructed compact funded CKB bid primitive. Research, not audited.
// Data: hash(120-byte intent). Witness: intent. Entire script group is validated.
#include "ckb_syscalls.h"
#include "blake2b.h"
#include <stdint.h>
#include <string.h>
#define MAX 2048
#define INTENT 120
static uint8_t ids[MAX][32], terms[MAX][INTENT];
static uint64_t used[MAX], count;
static uint8_t authorization[MAX];
static uint64_t rd(const uint8_t *p){uint64_t x=0;for(int i=7;i>=0;i--)x=(x<<8)|p[i];return x;}
static int same_hash(size_t i,size_t source,size_t field,const uint8_t *h){uint8_t x[32];uint64_t n=32;return !ckb_load_cell_by_field(x,&n,0,i,source,field)&&n==32&&!memcmp(x,h,32);}
int main(void){uint8_t script[64],self[32];uint64_t n=64;if(ckb_load_script(script,&n,0)||n!=53)return 10;n=32;if(ckb_load_script_hash(self,&n,0))return 11;
 for(size_t i=0;;i++){uint8_t h[32];n=32;int r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r)return 12;if(memcmp(h,self,32))continue;if(count>=MAX)return 13;
  n=32;if(ckb_load_cell_data(ids[count],&n,0,i,CKB_SOURCE_INPUT)||n!=32)return 14;
  n=INTENT;if(ckb_load_witness(terms[count],&n,0,i,CKB_SOURCE_INPUT)||n!=INTENT)return 15;
  blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,terms[count],INTENT);blake2b_final(&st,h,32);if(memcmp(h,ids[count],32))return 16;
  for(size_t j=0;j<count;j++)if(!memcmp(ids[j],ids[count],32))return 17; // explicit one-input-per-intent bound
  n=32;r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH);if(r!=CKB_ITEM_MISSING)return 18;
  uint64_t cap;n=8;if(ckb_load_cell_by_field(&cap,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY))return 19;
  int owner=0,cached=0;for(size_t k=0;k<count;k++)if(!memcmp(terms[k],terms[count],32)){owner=authorization[k];cached=1;break;}if(!cached)for(size_t j=0;;j++){n=32;r=ckb_load_cell_by_field(h,&n,0,j,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r)return 20;if(!memcmp(h,terms[count],32))owner=1;}
  authorization[count]=(uint8_t)owner;used[count]=0;if(!owner){uint64_t remaining=0;int successors=0;for(size_t j=0;;j++){n=32;r=ckb_load_cell_by_field(h,&n,0,j,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r)return 21;if(memcmp(h,self,32))continue;n=32;uint8_t id[32];if(ckb_load_cell_data(id,&n,0,j,CKB_SOURCE_OUTPUT)||n!=32)return 22;if(memcmp(id,ids[count],32))continue;if(++successors>1)return 23;n=32;r=ckb_load_cell_by_field(h,&n,0,j,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH);if(r!=CKB_ITEM_MISSING)return 24;n=8;if(ckb_load_cell_by_field(&remaining,&n,0,j,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY))return 25;}
   if(remaining>=cap)return 26;used[count]=cap-remaining;uint64_t num=rd(terms[count]+96),den=rd(terms[count]+104),min=rd(terms[count]+112);if(!num||!den)return 27;if(remaining&&used[count]<min)return 28;
  }count++;
 }
 // Aggregate obligations by exact recipient and token type; never reuse one payout twice.
 for(size_t i=0;i<count;i++){if(!used[i])continue;int earlier=0;for(size_t j=0;j<i;j++)if(used[j]&&!memcmp(terms[j]+32,terms[i]+32,64))earlier=1;if(earlier)continue;
  __uint128_t required=0;for(size_t j=i;j<count;j++)if(used[j]&&!memcmp(terms[j]+32,terms[i]+32,64)){__uint128_t product=(__uint128_t)used[j]*rd(terms[j]+96),den=rd(terms[j]+104);__uint128_t q=product/den+(product%den!=0);if(required+q<required)return 29;required+=q;}
  __uint128_t paid=0;for(size_t j=0;;j++){uint8_t h[32];n=32;int r=ckb_load_cell_by_field(h,&n,0,j,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r)return 30;if(memcmp(h,terms[i]+32,32)||!same_hash(j,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH,terms[i]+64))continue;uint8_t amount[16];n=16;r=ckb_load_cell_data(amount,&n,0,j,CKB_SOURCE_OUTPUT);if(r!=0&&r!=CKB_LENGTH_NOT_ENOUGH)return 31;if(n<16)return 32;__uint128_t value=(__uint128_t)rd(amount)+((__uint128_t)rd(amount+8)<<64);if(paid+value<paid)return 33;paid+=value;}
  if(paid<required)return 34;
 }return 0;
}
