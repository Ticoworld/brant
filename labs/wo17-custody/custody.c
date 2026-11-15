// One-holder experimental custody: full withdrawal only; not a general ledger.
#include "../wo09-open-markets/contracts/common.h"
static void root(const uint8_t *buyer,const uint8_t *q,const uint8_t *sib,uint8_t *out){uint8_t leaf[32],tag=0;blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,buyer,32);blake2b_update(&s,q,8);blake2b_final(&s,leaf,32);tag=1;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,leaf,32);blake2b_update(&s,sib,32);blake2b_final(&s,out,32);}
int main(void){uint8_t script[149],self[32],data[48],proof[40],r[32],out[16],h[32];uint64_t n=sizeof(script);if(ckb_load_script(script,&n,0)||n!=149||script[49]!=96||script[50]||script[51]||script[52])return 1;n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 2;
if(count_cells(CKB_SOURCE_INPUT)!=2||count_cells(CKB_SOURCE_OUTPUT)!=2||!lock_is(0,CKB_SOURCE_INPUT,self)||!type_is(0,CKB_SOURCE_INPUT,script+117))return 3;
if(!standard_owner(1,CKB_SOURCE_INPUT)||!plain(1,CKB_SOURCE_INPUT)||!lock_is(1,CKB_SOURCE_INPUT,script+85))return 4;
if(bytes(data,48,0,CKB_SOURCE_INPUT)||bytes(out,16,0,CKB_SOURCE_OUTPUT))return 5;
for(int j=8;j<16;j++)if(data[j]||out[j])return 6;
if(!rd(data)||memcmp(data,out,16)||!type_is(0,CKB_SOURCE_OUTPUT,script+117)||!lock_is(0,CKB_SOURCE_OUTPUT,script+85)||!lock_is(1,CKB_SOURCE_OUTPUT,script+85)||!plain(1,CKB_SOURCE_OUTPUT))return 7;
n=40;if(ckb_load_witness(proof,&n,0,2,CKB_SOURCE_INPUT)||n!=40||memcmp(proof,data,8))return 8;root(script+85,proof,proof+8,r);if(memcmp(r,data+16,32))return 9;
(void)h;return 0;}
