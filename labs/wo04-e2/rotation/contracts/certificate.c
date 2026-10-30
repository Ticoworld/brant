#include "layout.h"
int main(void){
 uint8_t script[200],h[32],s[STATE_SIZE],out[CERT_SIZE],expected[CERT_SIZE]={0};uint64_t n=0;
 if(ckb_load_cell(h,&n,0,0,CKB_SOURCE_GROUP_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 40;
 n=0;if(ckb_load_cell(h,&n,0,1,CKB_SOURCE_GROUP_OUTPUT)!=CKB_INDEX_OUT_OF_BOUND)return 41;
 n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=165||script[49]!=112||script[50]||script[51]||script[52])return 42;
 uint8_t*a=script+53;int found=0;if(memcmp(a+32,script+16,32))return 51;
 for(unsigned i=0;i<64;i++)if(type_matches(i,CKB_SOURCE_CELL_DEP,a)){
  uint8_t t[100];uint64_t z=100;if(ckb_load_cell_by_field(t,&z,0,i,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||z!=85||t[48]!=4||memcmp(t+16,a+32,32))return 43;
  if(cell_data(s,STATE_SIZE,i,CKB_SOURCE_CELL_DEP)||state_policy(s))return 44;found=1;break;
 }
 if(!found||le(a+64)!=le(s+72))return 45;
 uint64_t period=le(a+72),p=le(s+192);const uint8_t*root=period==p?s+200:period==p+1?s+232:0;
 if(!root||zero32(root)||memcmp(root,a+80,32))return 46;
 n=sizeof(packet);if(ckb_load_witness(packet,&n,0,0,CKB_SOURCE_INPUT)||n!=24720)return 47;
 uint8_t roots[512][32],b[64]={0};for(unsigned i=0;i<512;i++){memcpy(b,packet+48*i,48);memset(b+48,0,16);sha(b,64,roots[i]);}
 merkle(b,(uint8_t*)roots,512,512);uint8_t kr[32];memcpy(kr,b,32);memset(b+32,0,32);memcpy(b+32,packet+24576,32);
 uint8_t pkbytes[64]={0};memcpy(pkbytes,packet+24576,48);sha(pkbytes,64,b+32);sha(b,64,h);if(memcmp(h,root,32))return 48;
 blst_p1_affine point;if(point1(&point,packet+24576,packet+24624)||!blst_p1_affine_in_g1(&point))return 49;
 memcpy(expected,"E2BCERT1",8);memcpy(expected+8,a,64);memcpy(expected+72,a+64,16);memcpy(expected+88,root,32);memcpy(expected+120,kr,32);memcpy(expected+152,packet+24576,144);
 if(cell_data(out,CERT_SIZE,0,CKB_SOURCE_GROUP_OUTPUT)||memcmp(out,expected,CERT_SIZE))return 50;
 return 0;
}
