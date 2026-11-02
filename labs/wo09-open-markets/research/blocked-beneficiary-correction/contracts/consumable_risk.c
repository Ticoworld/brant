// Consumable beneficiary variant: three inputs; refunds occupied record capital.
// Prepaid output budgets keep even zero economic payouts materializable.
#include "common.h"
int main(void){uint8_t script[85],self[32],terms[184],digest[32],event[80];if(script32(script,self))return 10;uint64_t n=184;if(ckb_load_witness(terms,&n,0,0,CKB_SOURCE_GROUP_INPUT)||n!=184)return 11;
 blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,terms,184);blake2b_final(&st,digest,32);if(memcmp(digest,script+53,32))return 12;
 int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT);if(ni!=3||no!=2||!plain(0,CKB_SOURCE_INPUT))return 13;
 uint64_t maturity=rd(terms+128),fallback=rd(terms+136),target=rd(terms+144),s=rd(terms+152),j=rd(terms+160),fee=rd(terms+168),reserve=rd(terms+176),capacity;
 if(!maturity||(maturity>>56)||fallback<=maturity||(fallback>>56)||!target||!s||!j||fee>FEE_LIMIT||reserve<61*U)return 14;
 if(field(&capacity,8,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY)||(__uint128_t)s+j+2*(__uint128_t)reserve+fee!=capacity)return 15;
 int found=0;for(int i=0;i<LIMIT;i++){uint8_t h[32];n=32;int r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)break;if(r==CKB_ITEM_MISSING)continue;if(r)return 16;if(!memcmp(h,terms+64,32)){if(++found>1||bytes(event,80,i,CKB_SOURCE_CELL_DEP))return 17;}}
 if(found!=1||memcmp(event,terms+96,32)||rd(event+32)!=maturity)return 18;
 uint64_t price=rd(event+40),payout_s,payout_j;
 if(price){if(!absolute_since(0,maturity))return 19;__uint128_t x=(__uint128_t)target*U;__uint128_t value=x/price+(x%price!=0);payout_s=value>(__uint128_t)s+j?s+j:(uint64_t)value;payout_j=s+j-payout_s;}
 else{if(!absolute_since(0,fallback))return 20;payout_s=s;payout_j=j;}
 uint8_t beneficiaries[40];uint64_t record_cap[2];for(int role=0;role<2;role++){uint8_t d[84];int i=role+1;if(!type_is(i,CKB_SOURCE_INPUT,terms+32*role)||!lock_is(i,CKB_SOURCE_INPUT,terms+32*role)||bytes(d,84,i,CKB_SOURCE_INPUT)||memcmp(d+20,self,32)||memcmp(d+52,terms+96,32)||field(&record_cap[role],8,i,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY))return 22;memcpy(beneficiaries+20*role,d,20);}
 for(int i=0;i<2;i++){uint64_t cap;if(!plain(i,CKB_SOURCE_OUTPUT)||!standard_owner(i,CKB_SOURCE_OUTPUT)||!owner_args_is(i,CKB_SOURCE_OUTPUT,beneficiaries+20*i)||field(&cap,8,i,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||(__uint128_t)cap!=(__uint128_t)(i?payout_j:payout_s)+reserve+record_cap[i])return 21;}
 return 0;
}
