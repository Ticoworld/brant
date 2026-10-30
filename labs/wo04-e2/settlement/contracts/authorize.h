/* Historical immutable root authorization. No live-state dependency. */
#include "publisher.h"
static int authorize(const uint8_t*a,uint8_t*data){
 uint8_t t[157],expected[32],raw[64];uint64_t n=157;
 if(ckb_load_cell_by_field(t,&n,0,0,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=157||le32(t)!=157||le32(t+49)!=104||t[48]!=4||memcmp(t+16,publisher,32))return 101;
 if(memcmp(t+53,a+324,32)||memcmp(t+85,publisher,32)||le64(t+117)<le64(a+388))return 102;
 n=104;if(ckb_load_cell_data(data,&n,0,0,CKB_SOURCE_CELL_DEP)||n!=104)return 103;
 memcpy(raw,a+356,32);memcpy(raw+32,a+324,32);sha(raw,64,expected);
 if(memcmp(data,expected,32)||memcmp(data,a+116,32))return 104;
 uint64_t b=le64(data+64),hi=le64(a+404);
 if(b<le64(a+396)||(hi&&b>hi))return 105;
 return 0;
}
