// Candidate singleton type: args = minted_id(first input, output index 1).
// Data = market lock hash || xUDT type hash. Unverified research code.
#include "../wo09-open-markets/contracts/common.h"
int main(void){
 uint8_t script[85],self[32],a[64],b[64],h[32];
 if(script32(script,self))return 1;
 int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ic=0,oc=0,ii=-1,oi=-1;
 if(ni<1||no<2)return 2;
 for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ic++;ii=i;}
 for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oc++;oi=i;}
 if(oc!=1||oi!=1||ic>1||(ic&&ii!=1))return 3;
 if(bytes(b,64,1,CKB_SOURCE_OUTPUT))return 4;
 if(!lock_is(0,CKB_SOURCE_OUTPUT,b)||!lock_is(1,CKB_SOURCE_OUTPUT,b))return 5;
 if(field(h,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(h,b+32,32))return 6;
 if(!ic){if(minted_id(script+53,1))return 7;return 0;}
 if(bytes(a,64,1,CKB_SOURCE_INPUT)||memcmp(a,b,64)||!lock_is(0,CKB_SOURCE_INPUT,a)||!lock_is(1,CKB_SOURCE_INPUT,a))return 8;
 if(field(h,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(h,a+32,32))return 9;
 return 0;
}
