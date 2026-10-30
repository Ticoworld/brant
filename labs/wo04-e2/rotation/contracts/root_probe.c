/* Laboratory authorization / E1 MPT interface probe, NOT principal settlement. */
#include "layout.h"
#include "root_hash.h"
#include "proof.h"
int main(void){
 uint8_t script[180],rt[200],s[STATE_SIZE],data[104],expected[104];uint64_t n=sizeof(script);
 if(ckb_load_script(script,&n,0)||n!=125||script[49]!=72)return 20;uint8_t*a=script+53;
 n=sizeof(rt);if(ckb_load_cell_by_field(rt,&n,0,0,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=157||rt[48]!=4||memcmp(rt+16,root_hash,32)||memcmp(rt+53,a,64))return 21;
 if(!type_matches(1,CKB_SOURCE_CELL_DEP,a)||cell_data(s,STATE_SIZE,1,CKB_SOURCE_CELL_DEP)||state_policy(s))return 22;
 uint8_t st[100];n=100;if(ckb_load_cell_by_field(st,&n,0,1,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=85||st[48]!=4||memcmp(st+16,a+32,32))return 23;
 if(le(rt+117)!=le(s+72)||le(s+72)<le(a+64)||memcmp(rt+125,s+88,32))return 24;
 domain(a,expected);memcpy(expected+32,s+120,72);if(cell_data(data,104,0,CKB_SOURCE_CELL_DEP)||memcmp(data,expected,104))return 25;
 n=sizeof(packet);if(ckb_load_witness(packet,&n,0,0,CKB_SOURCE_INPUT)||!n)return 26;
 if(packet[0]==0)return n==1?0:27;
 if(packet[0]!=1||n<85)return 28;
 Wire w={packet+85,(size_t)n-85,0};uint8_t value[32];int r=prove(&w,data+32,packet+1,packet+21,packet+53,value);if(r)return r;return w.off==w.n?0:29;
}
