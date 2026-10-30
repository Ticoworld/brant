/* Single-committee, Capella mainnet cryptographic harness.
 * NOT a deployable light-client state cell: bootstrap/rotation are host verified.
 * General paths check member subgroups; the full-participation path authenticates
 * the canonical aggregate and keeps blst's aggregate/signature subgroup checks.
 */
#include "ckb_syscalls.h"
#include "blst.h"
#include "hash.h"
#include "fixture.h"

static uint8_t packet[30000];
static uint64_t le(const uint8_t*p){uint64_t v=0;for(int i=0;i<8;i++)v|=(uint64_t)p[i]<<(8*i);return v;}
static void merkle(uint8_t out[32],const uint8_t*p,unsigned count,unsigned width){
 uint8_t chunks[512][32]={0};memcpy(chunks,p,count*32);
 while(width>1){for(unsigned i=0;i<width;i+=2)sha(chunks[i],64,chunks[i/2]);width/=2;}
 memcpy(out,chunks[0],32);
}
static void beacon_root(const uint8_t*b,uint8_t out[32]){
 uint8_t c[8][32]={0};memcpy(c[0],b,8);memcpy(c[1],b+8,8);memcpy(c[2],b+16,96);merkle(out,(uint8_t*)c,8,8);
}
static int branch(uint8_t root[32],const uint8_t*nodes,unsigned index,unsigned depth){
 uint8_t b[64];for(unsigned i=0;i<depth;i++){if(index&1){memcpy(b,nodes+32*i,32);memcpy(b+32,root,32);}else{memcpy(b,root,32);memcpy(b+32,nodes+32*i,32);}sha(b,64,root);index>>=1;}return index!=1;
}
static const uint8_t genesis[32]={75,54,61,185,78,40,97,32,215,110,185,5,52,15,221,78,84,191,233,240,107,243,63,246,207,90,210,127,81,27,254,149};
int main(void){
#ifdef STACK_WATERMARK
 uintptr_t entry_sp;asm volatile("mv %0, sp":"=r"(entry_sp));
 volatile uint8_t *water=(volatile uint8_t*)(entry_sp-524288);
 for(unsigned i=0;i<524288;i++)water[i]=0xa5;
#endif
 uint64_t size=sizeof(packet);
#ifdef EMBEDDED
#ifdef FULL_PARTICIPATION
 size=sizeof(fixture_fast);memcpy(packet,fixture_fast,size);
#else
 size=sizeof(fixture);memcpy(packet,fixture,size);
#endif
#else
 if(ckb_load_witness(packet,&size,0,0,CKB_SOURCE_INPUT))return 1;
#endif
#ifdef FULL_PARTICIPATION
 if(size!=1272)return 2;
 unsigned key_bytes=32;
#else
 if(size!=25816)return 2;
 unsigned key_bytes=24576;
#endif
 uint8_t*a=packet+8,*f=a+112,*chunks=f+112,*eb=chunks+480,*fb=eb+128,*keys=fb+192,*agg=keys+key_bytes,*bits=agg+48,*sig=bits+64;
 uint64_t ss=le(packet),as=le(a),fs=le(f),old=le(context+32),now=le(context+40);
 if(!(now>=ss&&ss>as&&as>=fs&&fs>old))return 3;
 if(ss/8192!=old/8192)return 4;
 if(ss-1<194048*32ULL||ss-1>=269568*32ULL||fs<194048*32ULL||fs>=269568*32ULL)return 5;
 unsigned participation=0;for(int i=0;i<64;i++)for(int j=0;j<8;j++)participation+=(bits[i]>>j)&1;
 if(participation*3<1024)return 6;
#ifdef FULL_PARTICIPATION
 if(participation!=512)return 6;
#endif
 uint8_t h[32],buf[64]={0},pkroots[512][32];
#ifdef FULL_PARTICIPATION
 memcpy(buf,keys,32);
#else
 for(int i=0;i<512;i++){memcpy(buf,keys+48*i,48);memset(buf+48,0,16);sha(buf,64,pkroots[i]);}
 merkle(buf,(uint8_t*)pkroots,512,512);
#endif
 uint8_t tmp[64]={0};memcpy(tmp,agg,48);sha(tmp,64,buf+32);sha(buf,64,h);if(memcmp(h,context,32))return 7;
 merkle(h,chunks,15,16);branch(h,eb,25,4);if(memcmp(h,f+80,32))return 8;
 beacon_root(f,h);branch(h,fb,105,6);if(memcmp(h,a+48,32))return 9;
 beacon_root(a,buf);
 uint8_t fork[64]={3,0,0,0};memcpy(fork+32,genesis,32);sha(fork,64,h);buf[32]=7;memset(buf+33,0,3);memcpy(buf+36,h,28);sha(buf,64,h);
 blst_p1 sum;blst_p1_affine p;int init=0;
#ifdef FULL_PARTICIPATION
 /* core_verify below checks the aggregate subgroup itself (pk_grpchk=1).
  * Avoid repeating it here. All-participation is mandatory for this path. */
 if(blst_p1_uncompress(&p,agg)!=BLST_SUCCESS||blst_p1_affine_is_inf(&p))return 10;
#else
 for(unsigned i=0;i<512;i++){
  if(blst_p1_uncompress(&p,keys+48*i)!=BLST_SUCCESS||!blst_p1_affine_in_g1(&p)||blst_p1_affine_is_inf(&p))return 10;
#ifdef SUBTRACT_ABSENT
  if(!init){if(blst_p1_uncompress(&p,agg)!=BLST_SUCCESS||!blst_p1_affine_in_g1(&p))return 11;blst_p1_from_affine(&sum,&p);init=1; if(blst_p1_uncompress(&p,keys+48*i)!=BLST_SUCCESS)return 10;}
  if(!(bits[i/8]>>(i%8)&1)){blst_p1 negative;blst_p1_from_affine(&negative,&p);blst_p1_cneg(&negative,1);blst_p1_add_or_double(&sum,&sum,&negative);}
#else
  if(bits[i/8]>>(i%8)&1){if(!init){blst_p1_from_affine(&sum,&p);init=1;}else blst_p1_add_or_double_affine(&sum,&sum,&p);}
#endif
 }
 blst_p1_to_affine(&p,&sum);if(blst_p1_affine_is_inf(&p))return 12;
#endif
 blst_p2_affine s;if(blst_p2_uncompress(&s,sig)!=BLST_SUCCESS)return 13;
#ifndef FULL_PARTICIPATION
 if(!blst_p2_affine_in_g2(&s))return 13;
#endif
 /* blst_core_verify_pk_in_g1 passes BOTH subgroup flags=1. */
 const char dst[]="BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
 if(blst_core_verify_pk_in_g1(&p,&s,1,h,32,(const uint8_t*)dst,sizeof(dst)-1,0,0)!=BLST_SUCCESS)return 14;
#ifndef EMBEDDED
 /* Output binding harness only. No production publisher/state-cell identity. */
 uint8_t output[104],domain[32];uint64_t olen=104;
 const char label[]="WO04-E2A Ethereum mainnet finalized execution v1";
 sha((const uint8_t*)label,sizeof(label)-1,domain);
 if(ckb_load_cell_data(output,&olen,0,0,CKB_SOURCE_OUTPUT)||olen!=104)return 15;
 if(memcmp(output,domain,32)||memcmp(output+32,chunks+64,32)||memcmp(output+64,chunks+192,8)||memcmp(output+72,chunks+384,32))return 16;
#endif
#ifdef STACK_WATERMARK
 unsigned first=0;while(first<524288&&water[first]==0xa5)first++;
 uintptr_t total=4194304-(entry_sp-524288+first);
 char message[80]="E2 empirical stack write watermark bytes: ";unsigned pos=41;
 char digits[24];unsigned nd=0;do{digits[nd++]='0'+total%10;total/=10;}while(total);
 while(nd)message[pos++]=digits[--nd];message[pos]=0;ckb_debug(message);
#endif
 return 0;
}
