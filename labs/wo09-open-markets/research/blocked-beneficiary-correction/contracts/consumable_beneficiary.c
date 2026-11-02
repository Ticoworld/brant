// Both lock and type of a uniquely anchored, transferable, settlement-consumed right.
// Data: normal owner args20, bound pool lock hash32, event32.
#include "common.h"
static int owner_input(const uint8_t*h,int ni){for(int i=0;i<ni;i++)if(owner_args_is(i,CKB_SOURCE_INPUT,h))return 1;return 0;}
int main(void){uint8_t script[85],self[32],a[84],b[84];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ii=-1,oi=-1,ins=0,outs=0;if(ni<1||no<0)return 11;
 for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ii=i;ins++;}for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oi=i;outs++;}
 if(ins>1||outs>1)return 12;
 if(outs&&(bytes(b,84,oi,CKB_SOURCE_OUTPUT)||!lock_is(oi,CKB_SOURCE_OUTPUT,self)))return 13;
 if(!ins){if(outs!=1||minted_id(script+53,oi)||!owner_input(b,ni))return 14;return 0;}
 if(bytes(a,84,ii,CKB_SOURCE_INPUT)||!lock_is(ii,CKB_SOURCE_INPUT,self))return 15;
 if(!outs){int pools=0;for(int i=0;i<ni;i++)if(lock_is(i,CKB_SOURCE_INPUT,a+20))pools++;return pools==1?0:16;}
 uint64_t x,y;if(memcmp(a+20,b+20,64)||!owner_input(a,ni)||field(&x,8,ii,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||field(&y,8,oi,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||x!=y)return 17;
 return 0;
}
