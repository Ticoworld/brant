// One uniquely typed maturity event. Publisher trust is explicit; price truth is NOT proved.
#include "common.h"
int main(void){uint8_t script[85],self[32],input[80],output[80];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT),ii=-1,oi=-1,ins=0,outs=0;if(ni<1||no<0)return 11;
 for(int i=0;i<ni;i++)if(type_is(i,CKB_SOURCE_INPUT,self)){ii=i;ins++;}for(int i=0;i<no;i++)if(type_is(i,CKB_SOURCE_OUTPUT,self)){oi=i;outs++;}
 if(outs!=1||ins>1||bytes(output,80,oi,CKB_SOURCE_OUTPUT)||!standard_owner(oi,CKB_SOURCE_OUTPUT))return 12;
 if(!lock_is(oi,CKB_SOURCE_OUTPUT,output+48)||!rd(output+32)||(rd(output+32)>>56))return 13;
 if(!ins){if(rd(output+40)||minted_id(script+53,oi))return 14;return 0;}
 if(bytes(input,80,ii,CKB_SOURCE_INPUT)||!lock_is(ii,CKB_SOURCE_INPUT,input+48)||!standard_owner(ii,CKB_SOURCE_INPUT))return 15;
 if(rd(input+40)||!rd(output+40)||memcmp(input,output,40)||memcmp(input+48,output+48,32))return 16;
 uint64_t a,b;if(field(&a,8,ii,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||field(&b,8,oi,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||a!=b)return 17;
 if(!absolute_since(ii,rd(input+32)))return 18;return 0;
}
