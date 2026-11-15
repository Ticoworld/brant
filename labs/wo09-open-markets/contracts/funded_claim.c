// Independently funded fixed-CKB claim family. New bounded research contract.
// Strong standard owner locks; supply cannot increase after one anchored mint.
#include "common.h"
int main(void){uint8_t script[85],self[32],d[24],owner[32];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT);if(ni<1||no<0)return 11;
 __uint128_t in_units=0,out_units=0;uint64_t face=0,maturity=0;int have=0,inputs=0,outputs=0,first_output=-1;
 for(int side=0;side<2;side++){int total=side?no:ni;size_t source=side?CKB_SOURCE_OUTPUT:CKB_SOURCE_INPUT;for(int i=0;i<total;i++)if(type_is(i,source,self)){
  if(bytes(d,24,i,source)||!standard_owner(i,source))return 12;uint64_t f=rd(d),u=rd(d+8),m=rd(d+16),cap,occupied;
  if(f<=FEE_LIMIT||!u||!m||(m>>56))return 13;if(!have){face=f;maturity=m;have=1;}else if(face!=f||maturity!=m)return 14;
  if(field(&cap,8,i,source,CKB_CELL_FIELD_CAPACITY)||field(&occupied,8,i,source,CKB_CELL_FIELD_OCCUPIED_CAPACITY))return 15;
  if((__uint128_t)f*u+occupied>cap)return 16;
  if(side){out_units+=u;outputs++;if(first_output<0)first_output=i;}else{in_units+=u;inputs++;}
 }}
 if(!inputs){if(!outputs||minted_id(script+53,(size_t)first_output))return 17;return 0;}
 if(out_units>in_units)return 18;if(out_units==in_units)return 0;
 // Redemption is deliberately one family and one owner per transaction.
 int got_owner=0;for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){
  if(!absolute_since(i,maturity))return 19;uint8_t h[32];if(field(h,32,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH))return 20;if(!got_owner){memcpy(owner,h,32);got_owner=1;}else if(memcmp(owner,h,32))return 21;
 }
 for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)&&!lock_is(i,CKB_SOURCE_OUTPUT,owner))return 22;
 __uint128_t ordinary_in=0,ordinary_out=0;
 for(int i=0;i<ni;i++)if(!type_is(i,CKB_SOURCE_INPUT,self)){
  uint8_t t[128];uint64_t n=128;int r=ckb_load_cell_by_field(t,&n,0,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE);
  if(!r&&n>=49&&!memcmp(t+16,script+16,33))return 23;
  if(lock_is(i,CKB_SOURCE_INPUT,owner)){uint64_t cap;if(field(&cap,8,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY))return 24;ordinary_in+=cap;}
 }
 for(int i=0;i<no;i++)if(plain(i,CKB_SOURCE_OUTPUT)&&lock_is(i,CKB_SOURCE_OUTPUT,owner)){uint64_t cap;if(field(&cap,8,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY))return 25;ordinary_out+=cap;}
 __uint128_t principal=(in_units-out_units)*face,minimum=principal>FEE_LIMIT?principal-FEE_LIMIT:0;
 if(ordinary_out<ordinary_in+minimum)return 26;return 0;
}
