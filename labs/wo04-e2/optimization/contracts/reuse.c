/* Read-only certificate probe. Does NOT publish a finalized execution root. */
#include "common.h"
#include "certificate_hash.h"
int main(void){
 uint8_t type[64],data[264],c[48],u[96];uint64_t n=64;
 if(ckb_load_cell_by_field(type,&n,0,0,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=53||memcmp(type+16,certificate_hash,32)||type[48]!=4||memcmp(type+49,"\0\0\0\0",4))return 50;
 n=264;if(ckb_load_cell_data(data,&n,0,0,CKB_SOURCE_CELL_DEP)||n!=264||memcmp(data,"E2COM01\0",8)||data[256]!=1)return 51;
 blst_p1_affine p;if(blst_p1_deserialize(&p,data+120)!=BLST_SUCCESS||blst_p1_affine_is_inf(&p))return 52;
 blst_p1_affine_compress(c,&p);blst_p1_affine_serialize(u,&p);
 if(memcmp(c,data+72,48)||memcmp(u,data+120,96))return 53;
 /* Subgroup validation is amortized ONLY because the code-hash-authenticated
  * immutable constructor checked this exact point and cannot be spent/updated.
  * A mutable or merely host-named cell would not establish this invariant. */
 return 0;
}
