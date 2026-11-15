#ifndef WO09_COMMON_H
#define WO09_COMMON_H
#include "ckb_syscalls.h"
#include "blake2b.h"
#include <stdint.h>
#include <string.h>
#define U 100000000ULL
#define FEE_LIMIT 1000000ULL
#define LIMIT 128
static uint64_t rd(const uint8_t*p){uint64_t n=0;for(int i=7;i>=0;i--)n=(n<<8)|p[i];return n;}
static int field(void*p,uint64_t size,size_t i,size_t s,size_t f){uint64_t n=size;int r=ckb_load_cell_by_field(p,&n,0,i,s,f);return r?r:(n==size?0:90);}
static int bytes(void*p,uint64_t size,size_t i,size_t s){uint64_t n=size;int r=ckb_load_cell_data(p,&n,0,i,s);return r?r:(n==size?0:91);}
static int type_is(size_t i,size_t s,const uint8_t*h){uint8_t x[32];return !field(x,32,i,s,CKB_CELL_FIELD_TYPE_HASH)&&!memcmp(x,h,32);}
static int lock_is(size_t i,size_t s,const uint8_t*h){uint8_t x[32];return !field(x,32,i,s,CKB_CELL_FIELD_LOCK_HASH)&&!memcmp(x,h,32);}
static int plain(size_t i,size_t s){uint8_t x[32];uint64_t n=32;return ckb_load_cell_by_field(x,&n,0,i,s,CKB_CELL_FIELD_TYPE_HASH)==CKB_ITEM_MISSING;}
static int count_cells(size_t s){for(size_t i=0;i<=LIMIT;i++){uint64_t c,n=8;int r=ckb_load_cell_by_field(&c,&n,0,i,s,CKB_CELL_FIELD_CAPACITY);if(r==CKB_INDEX_OUT_OF_BOUND)return (int)i;if(r)return -1;}return -1;}
static int standard_owner(size_t i,size_t s){
 static const uint8_t code[32]={0x9b,0xd7,0xe0,0x6f,0x3e,0xcf,0x4b,0xe0,0xf2,0xfc,0xd2,0x18,0x8b,0x23,0xf1,0xb9,0xfc,0xc8,0x8e,0x5d,0x4b,0x65,0xa8,0x63,0x7b,0x17,0x72,0x3b,0xbd,0xa3,0xcc,0xe8};
 uint8_t script[128];uint64_t n=sizeof(script);return !ckb_load_cell_by_field(script,&n,0,i,s,CKB_CELL_FIELD_LOCK)&&n==73&&script[48]==1&&script[49]==20&&!script[50]&&!script[51]&&!script[52]&&!memcmp(script+16,code,32);
}
static int script32(uint8_t script[85],uint8_t self[32]){uint64_t n=85;if(ckb_load_script(script,&n,0)||n!=85||script[49]!=32||script[50]||script[51]||script[52])return 1;n=32;return ckb_load_script_hash(self,&n,0);}
static int minted_id(const uint8_t*args,size_t output){uint8_t in[44],message[52],h[32];uint64_t n=44;if(!standard_owner(0,CKB_SOURCE_INPUT)||ckb_load_input(in,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 1;memcpy(message,in,44);for(int j=0;j<8;j++)message[44+j]=(uint8_t)((uint64_t)output>>(j*8));blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,message,52);blake2b_final(&st,h,32);return memcmp(h,args,32)!=0;}
static int absolute_since(size_t i,uint64_t maturity){uint64_t x,n=8;if(ckb_load_input_by_field(&x,&n,0,i,CKB_SOURCE_INPUT,CKB_INPUT_FIELD_SINCE)||n!=8)return 0;return !(x>>56)&&x>=maturity;}
#endif
