// WO17B experimental fixed two-holder custody: online allocation + withdrawals.
// Script args: market hash || asset type hash || Alice lock hash || Ben lock hash.
// Data: LE128 backing || LE64 Alice || LE64 Ben || LE64 revision || root32.
#include "../wo09-open-markets/contracts/common.h"
#include "../wo15-merkle-intent/r6/secp256k1_helper.h"
static secp256k1_context context;
static unsigned char precomputed[CKB_SECP256K1_DATA_SIZE] __attribute__((aligned(16)));
static void text(blake2b_state *s,const char *v){blake2b_update(s,v,strlen(v));}
static void hex32(blake2b_state *s,const uint8_t *v){char h[66]={'0','x'};const char *d="0123456789abcdef";for(int i=0;i<32;i++){h[2+i*2]=d[v[i]>>4];h[3+i*2]=d[v[i]&15];}blake2b_update(s,h,66);}
static void num(blake2b_state *s,uint64_t v){char b[20];int n=0;do{b[n++]='0'+v%10;v/=10;}while(v);while(n)blake2b_update(s,&b[--n],1);}
static void digest_data(const uint8_t *p,size_t n,uint8_t *out){blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,p,n);blake2b_final(&s,out,32);}
static int cp(int i,size_t src,uint64_t *v){return field(v,8,i,src,CKB_CELL_FIELD_CAPACITY);}
static void leaf(const uint8_t *market,const uint8_t *asset,const uint8_t *owner,const uint8_t *bal,uint8_t *out){blake2b_state s;uint8_t tag=1;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,market,32);blake2b_update(&s,asset,32);blake2b_update(&s,owner,32);blake2b_update(&s,bal,8);blake2b_final(&s,out,32);}
static int valid(const uint8_t*script,const uint8_t*d){uint8_t l[32],r[32],h[32],tag=2;for(int i=8;i<16;i++)if(d[i])return 0;uint64_t a=rd(d+16),b=rd(d+24);if((__uint128_t)a+b!=rd(d))return 0;leaf(script+53,script+85,script+117,d+16,l);leaf(script+53,script+85,script+149,d+24,r);blake2b_state s;blake2b_init(&s,32);blake2b_update(&s,&tag,1);blake2b_update(&s,l,32);blake2b_update(&s,r,32);blake2b_final(&s,h,32);return !memcmp(h,d+40,32);}
static int wallet(int index,size_t src,const uint8_t *h){uint64_t n=0;return standard_owner(index,src)&&lock_is(index,src,h)&&plain(index,src)&&!ckb_load_cell_data(0,&n,0,index,src)&&n==0;}
int main(void){uint8_t script[181],self[32],a[72],b[72],w[154];uint64_t n=181,ic,oc;
if(ckb_load_script(script,&n,0)||n!=181||script[49]!=128||script[50]||script[51]||script[52]||!memcmp(script+117,script+149,32))return 1;
n=32;if(ckb_load_script_hash(self,&n,0)||n!=32)return 2;
int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT);if(ni<2||no!=3||!lock_is(0,CKB_SOURCE_INPUT,self)||!lock_is(0,CKB_SOURCE_OUTPUT,self)||!type_is(0,CKB_SOURCE_INPUT,script+85)||!type_is(0,CKB_SOURCE_OUTPUT,script+85))return 3;
if(bytes(a,72,0,CKB_SOURCE_INPUT)||bytes(b,72,0,CKB_SOURCE_OUTPUT)||!valid(script,a)||!valid(script,b))return 4;
if(rd(a+32)==UINT64_MAX||rd(b+32)!=rd(a+32)+1||cp(0,CKB_SOURCE_INPUT,&ic)||cp(0,CKB_SOURCE_OUTPUT,&oc)||ic!=oc)return 5;
__uint128_t ins=0,outs=0;for(int i=0;i<ni;i++){if(cp(i,CKB_SOURCE_INPUT,&ic))return 6;ins+=ic;}for(int i=0;i<no;i++){if(cp(i,CKB_SOURCE_OUTPUT,&oc))return 6;outs+=oc;}if(ins<outs||ins-outs>FEE_LIMIT)return 6;
n=sizeof(w);if(ckb_load_witness(w,&n,0,ni,CKB_SOURCE_INPUT)||(n!=24&&n!=154))return 7;uint64_t op=rd(w),x=rd(w+8),y=rd(w+16),aa=rd(a+16),ab=rd(a+24),ba=rd(b+16),bb=rd(b+24);
if(op!=3&&n!=24)return 7;
if(op==1){uint64_t slot=x,q=y;const uint8_t*who=slot==0?script+117:script+149;uint8_t tok[16];if(ni!=2||slot>1||!q||!wallet(1,CKB_SOURCE_INPUT,who)||!lock_is(1,CKB_SOURCE_OUTPUT,who)||!wallet(2,CKB_SOURCE_OUTPUT,who))return 8;
if(!type_is(1,CKB_SOURCE_OUTPUT,script+85)||bytes(tok,16,1,CKB_SOURCE_OUTPUT)||rd(tok)!=q)return 9;for(int j=8;j<16;j++)if(tok[j])return 9;
if(slot==0){if(aa<q||ba!=aa-q||bb!=ab)return 10;}else if(ab<q||bb!=ab-q||ba!=aa)return 10;
if(rd(a)<q||rd(b)!=rd(a)-q)return 11;return 0;}
if(op==2){uint64_t q=x;if(ni!=3||y||!q||!wallet(1,CKB_SOURCE_INPUT,script+117)||!wallet(2,CKB_SOURCE_INPUT,script+149)||!wallet(1,CKB_SOURCE_OUTPUT,script+117)||!wallet(2,CKB_SOURCE_OUTPUT,script+149))return 12;
if(aa<q||ba!=aa-q||(__uint128_t)ab+q>UINT64_MAX||bb!=ab+q||rd(a)!=rd(b))return 13;
if(cp(1,CKB_SOURCE_INPUT,&ic)||cp(1,CKB_SOURCE_OUTPUT,&oc)||oc<ic)return 14;return 0;}
if(op==3){
 if(n!=154||ni!=2||!x||!y||!wallet(1,CKB_SOURCE_INPUT,script+149)||!wallet(1,CKB_SOURCE_OUTPUT,script+117)||!wallet(2,CKB_SOURCE_OUTPUT,script+149))return 16;
 if(aa<x||ba!=aa-x||(__uint128_t)ab+x>UINT64_MAX||bb!=ab+x||rd(a)!=rd(b))return 17;
 if(cp(1,CKB_SOURCE_OUTPUT,&oc)||oc<y)return 18;
 uint8_t input[44],genesis[208],gh[32],pubhash[32],os[73]={73,0,0,0,16,0,0,0,48,0,0,0,49,0,0,0},msg[32],recovered[33];size_t pn=33;uint64_t sz=44;if(ckb_load_input(input,&sz,0,0,CKB_SOURCE_INPUT)||sz!=44)return 19;sz=208;if(ckb_load_header(genesis,&sz,0,0,CKB_SOURCE_HEADER_DEP)||sz!=208||rd(genesis+16))return 19;digest_data(genesis,208,gh);
 blake2b_state st;blake2b_init(&st,32);text(&st,"Nervos Message:TRADE WO17C TOKEN SALE v1\nGenesis: ");hex32(&st,gh);text(&st,"\nMarket: ");hex32(&st,script+53);text(&st,"\nAsset: ");hex32(&st,script+85);text(&st,"\nCustody: ");hex32(&st,self);text(&st,"\nInput transaction: ");hex32(&st,input+8);text(&st,"\nInput index: ");num(&st,(uint64_t)input[40]|((uint64_t)input[41]<<8)|((uint64_t)input[42]<<16)|((uint64_t)input[43]<<24));text(&st,"\nSeller: ");hex32(&st,script+117);text(&st,"\nBuyer: ");hex32(&st,script+149);text(&st,"\nQuantity: ");num(&st,x);text(&st,"\nMinimum shannons: ");num(&st,y);text(&st,"\nPayout: ");hex32(&st,script+117);text(&st,"\nOrder id: ");hex32(&st,w+24);text(&st,"\nExpiry: none; valid until input is spent");blake2b_final(&st,msg,32);
 if(ckb_secp256k1_custom_verify_only_initialize(&context,precomputed))return 20;secp256k1_ecdsa_recoverable_signature sig;secp256k1_pubkey key;if(w[153]>3||!secp256k1_ecdsa_recoverable_signature_parse_compact(&context,&sig,w+89,w[153])||!secp256k1_ecdsa_recover(&context,&key,&sig,msg)||!secp256k1_ec_pubkey_serialize(&context,recovered,&pn,&key,SECP256K1_EC_COMPRESSED)||pn!=33||memcmp(recovered,w+56,33))return 21;
 digest_data(recovered,33,pubhash);static const uint8_t code[32]={0x9b,0xd7,0xe0,0x6f,0x3e,0xcf,0x4b,0xe0,0xf2,0xfc,0xd2,0x18,0x8b,0x23,0xf1,0xb9,0xfc,0xc8,0x8e,0x5d,0x4b,0x65,0xa8,0x63,0x7b,0x17,0x72,0x3b,0xbd,0xa3,0xcc,0xe8};memcpy(os+16,code,32);os[48]=1;os[49]=20;memcpy(os+53,pubhash,20);digest_data(os,73,pubhash);if(memcmp(pubhash,script+117,32))return 22;return 0;
}
if(op==4){if(ni!=2||x||y||!wallet(1,CKB_SOURCE_INPUT,script+117)||!wallet(1,CKB_SOURCE_OUTPUT,script+117)||!wallet(2,CKB_SOURCE_OUTPUT,script+117)||aa!=ba||ab!=bb||rd(a)!=rd(b))return 23;return 0;}
return 15;}
