// Isolated atomic family: enhanced-owner authorization, never an ordinary lock.
#include "../../../wo09-open-markets/contracts/common.h"
#include "../../gate2/smt_transition.h"
#include "atomic_codes.h"
static void digest(const uint8_t*p,size_t n,uint8_t*h){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,h,32);}
__attribute__((visibility("default")))
int validate(int mode,size_t index,const uint8_t*a,size_t len){
// args: anchor36, market32, supply8, issuance-floor8. Exactly one creator input.
 uint8_t in[44],mh[32],asset[32],creator[32],m[141],cl[181],mt[85],cm[64],d[48],iv[48],gh[32],hdr[208],id[32];uint64_t n=44,cap;
 if(mode||index||len!=84||count_cells(CKB_SOURCE_INPUT)!=1||count_cells(CKB_SOURCE_OUTPUT)!=5||!standard_owner(0,CKB_SOURCE_INPUT)||!plain(0,CKB_SOURCE_INPUT)||ckb_load_input(in,&n,0,0,CKB_SOURCE_INPUT)||n!=44||memcmp(in+8,a,36))return 60;
 if(field(creator,32,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(4,CKB_SOURCE_OUTPUT,creator)||!plain(4,CKB_SOURCE_OUTPUT)||bytes(d,0,4,CKB_SOURCE_OUTPUT))return 61;
 uint64_t supply=rd(a+68),floor=rd(a+76);if(!supply||supply>0xffffffffULL||floor!=300*U)return 62;
 n=141;if(ckb_load_cell_by_field(m,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=141||memcmp(m+16,atomic_market_code,32)||m[48]!=2||m[49]!=88||m[50]||m[51]||m[52]||rd(m+101)!=supply||!rd(m+85)||!rd(m+93))return 63;
 digest(a,36,id);if(memcmp(id,m+53,32)||field(mh,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||memcmp(mh,a+36,32)||!lock_is(1,CKB_SOURCE_OUTPUT,mh)||!type_is(1,CKB_SOURCE_OUTPUT,m+109))return 64;
 n=85;if(ckb_load_cell_by_field(mt,&n,0,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE)||n!=85||memcmp(mt+16,atomic_market_marker_code,32)||mt[48]!=2||mt[49]!=32||mt[50]||mt[51]||mt[52]||minted_id(mt+53,1))return 64;
 if(field(asset,32,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||!type_is(2,CKB_SOURCE_OUTPUT,asset)||!plain(4,CKB_SOURCE_OUTPUT)||bytes(cm,64,1,CKB_SOURCE_OUTPUT)||memcmp(cm,mh,32)||memcmp(cm+32,asset,32))return 65;
 if(bytes(iv,48,0,CKB_SOURCE_OUTPUT)||bytes(d,48,2,CKB_SOURCE_OUTPUT))return 66;
 for(int j=8;j<16;j++)if(iv[j]||d[j])return 66;
 uint64_t q=rd(d),inventory=rd(iv);if(!q||q>=supply||inventory!=supply-q)return 67;
 n=85;if(ckb_load_cell_by_field(mt,&n,0,3,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE)||n!=85||memcmp(mt+16,atomic_marker_code,32)||mt[48]!=2||mt[49]!=32||mt[50]||mt[51]||mt[52]||memcmp(mt+53,mh,32)||field(id,32,3,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE_HASH)||memcmp(iv+16,id,32))return 68;
 n=208;if(ckb_load_header(hdr,&n,0,0,CKB_SOURCE_HEADER_DEP)||n!=208||rd(hdr+16))return 69;digest(hdr,208,gh);
 n=181;if(ckb_load_cell_by_field(cl,&n,0,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=181||memcmp(cl+16,atomic_custody_code,32)||cl[48]!=2||cl[49]!=128||cl[50]||cl[51]||cl[52]||memcmp(cl+53,mh,32)||memcmp(cl+85,asset,32)||memcmp(cl+117,gh,32)||memcmp(cl+149,id,32))return 70;
 if(field(id,32,2,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(3,CKB_SOURCE_OUTPUT,id)||bytes(cm,64,3,CKB_SOURCE_OUTPUT)||memcmp(cm,id,32)||memcmp(cm+32,asset,32))return 71;
 trade_smt_transition_t st={0};if(trade_smt_load(1,CKB_SOURCE_INPUT,cl,&st)||st.op!=TRADE_SMT_INIT||st.count!=1||memcmp(st.updates[0].owner,creator,32)||rd(st.updates[0].new_value)!=q||rd(st.updates[0].new_value+8)||st.updates[0].new_value[16]!=1||trade_smt_initialize_root(d,&st))return 72;
 __uint128_t price=(__uint128_t)rd(m+85)*q+(__uint128_t)rd(m+93)*q*(q-1)/2;if(price>UINT64_MAX||st.extra_len!=8||price>rd(st.extra)||field(&cap,8,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||(__uint128_t)floor+price!=cap)return 73;
 if(field(&cap,8,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||cap!=300*U)return 74;
 for(int i=2;i<4;i++)if(field(&cap,8,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||cap!=350*U)return 74;
 uint64_t inputcap;if(field(&inputcap,8,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY))return 75;__uint128_t total=0;for(int i=0;i<5;i++){if(field(&cap,8,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY))return 75;total+=cap;}if(total>inputcap||inputcap-total>FEE_LIMIT)return 75;
 return 0;
}
int main(void){return 76;}
