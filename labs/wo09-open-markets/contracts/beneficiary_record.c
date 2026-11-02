// Minimal transferable beneficiary registry. Deliberately permanent: cleanup NOT solved.
// Normal owner lock authorizes every transfer; anchored type prevents duplicate identities.
#include "common.h"
int main(void){uint8_t script[85],self[32],a[32],b[32];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ii=-1,oi=-1,ins=0,outs=0;if(ni<1||no<0)return 11;
 for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ii=i;ins++;}for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oi=i;outs++;}
 if(outs!=1||ins>1||bytes(b,32,oi,CKB_SOURCE_OUTPUT)||!standard_owner(oi,CKB_SOURCE_OUTPUT))return 12;
 if(!ins)return minted_id(script+53,oi)?13:0;
 uint64_t x,y;if(bytes(a,32,ii,CKB_SOURCE_INPUT)||memcmp(a,b,32)||!standard_owner(ii,CKB_SOURCE_INPUT)||field(&x,8,ii,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||field(&y,8,oi,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||x!=y)return 14;
 return 0;
}
