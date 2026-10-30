/* Same historical committee-trust boundary as E2A fallback, NOT a root publisher.
 * Missing members are authenticated at their exact SSZ vector indices.
 */
#include "common.h"
#include "context.h"
static uint64_t timing[12],previous;
#ifdef PROFILE
#define MARK(i) do{uint64_t t=ckb_current_cycles();timing[i]=t-previous;previous=t;}while(0)
#else
#define MARK(i) do{}while(0)
#endif
static int point1(blst_p1_affine*p,const uint8_t*c,const uint8_t*u){
#ifdef AFFINE
 uint8_t canonical[96],compressed[48];
 if(blst_p1_deserialize(p,u)!=BLST_SUCCESS)return 1;
 blst_p1_affine_serialize(canonical,p);blst_p1_affine_compress(compressed,p);
 if(memcmp(canonical,u,96)||memcmp(compressed,c,48))return 2;
#else
 if(blst_p1_uncompress(p,c)!=BLST_SUCCESS)return 1;
#endif
 return blst_p1_affine_is_inf(p)?3:0;
}
static int point2(blst_p2_affine*p,const uint8_t*c,const uint8_t*u){
#ifdef AFFINE
 uint8_t canonical[192],compressed[96];
 if(blst_p2_deserialize(p,u)!=BLST_SUCCESS)return 1;
 blst_p2_affine_serialize(canonical,p);blst_p2_affine_compress(compressed,p);
 if(memcmp(canonical,u,192)||memcmp(compressed,c,96))return 2;
#else
 if(blst_p2_uncompress(p,c)!=BLST_SUCCESS)return 1;
#endif
 return blst_p2_affine_is_inf(p)?3:0;
}
int main(void){
 previous=ckb_current_cycles();uint64_t size=sizeof(packet);
 if(ckb_load_witness(packet,&size,0,0,CKB_SOURCE_INPUT)||size<1561)return 1;
 uint8_t*a=packet+8,*f=a+112,*chunks=f+112,*eb=chunks+480,*fb=eb+128,*kr=fb+192,*agg=kr+32,*bits=agg+48,*sig=bits+64,*ua=sig+96,*us=ua+96,*count=us+192;
 if(*count>2||size!=1561+434*(uint64_t)*count)return 2;
 uint64_t ss=le(packet),as=le(a),fs=le(f);
 if(!(le(context+40)>=ss&&ss>as&&as>=fs&&fs>le(context+32)))return 3;
 if(ss/8192!=le(context+48)||ss-1<194048*32ULL||ss-1>=269568*32ULL||fs<194048*32ULL||fs>=269568*32ULL)return 4;
 unsigned part=0;for(unsigned i=0;i<64;i++)for(unsigned j=0;j<8;j++)part+=(bits[i]>>j)&1;
 if(part*3<1024||512-part!=*count)return 5;
 uint8_t buf[64]={0},h[32];memcpy(buf,kr,32);uint8_t tmp[64]={0};memcpy(tmp,agg,48);sha(tmp,64,buf+32);sha(buf,64,h);if(memcmp(h,context,32))return 6;
 MARK(0);
 merkle(h,chunks,15,16);branch(h,eb,25,4);if(memcmp(h,f+80,32))return 7;
 beacon_root(f,h);branch(h,fb,105,6);if(memcmp(h,a+48,32))return 8;
 beacon_root(a,buf);uint8_t fork[64]={3};memcpy(fork+32,genesis,32);sha(fork,64,h);buf[32]=7;memset(buf+33,0,3);memcpy(buf+36,h,28);sha(buf,64,h);MARK(1);
 blst_p1_affine pk;if(point1(&pk,agg,ua))return 9;MARK(2);
 if(!blst_p1_affine_in_g1(&pk))return 10;MARK(3);
 blst_p1 sum;blst_p1_from_affine(&sum,&pk);int last=-1;
 for(unsigned k=0;k<*count;k++){
  uint8_t*r=count+1+434*k;unsigned index=r[0]|((unsigned)r[1]<<8);
  if(index>=512||(int)index<=last||(bits[index/8]>>(index%8)&1))return 11;last=(int)index;
  uint8_t leaf[32],b[64]={0};memcpy(b,r+2,48);sha(b,64,leaf);branch(leaf,r+146,512+index,9);if(memcmp(leaf,kr,32))return 12;
  blst_p1_affine missing;if(point1(&missing,r+2,r+50)||!blst_p1_affine_in_g1(&missing))return 13;
  blst_p1 neg;blst_p1_from_affine(&neg,&missing);blst_p1_cneg(&neg,1);blst_p1_add_or_double(&sum,&sum,&neg);
 }
 blst_p1_to_affine(&pk,&sum);if(blst_p1_affine_is_inf(&pk))return 14;
 /* All operands subgroup-validated, so subtraction remains in G1. */
 MARK(4);
 blst_p2_affine signature;if(point2(&signature,sig,us))return 15;MARK(5);
 if(!blst_p2_affine_in_g2(&signature))return 16;MARK(6);
 const char dst[]="BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
 blst_p2 hash;blst_p2_affine hashed;blst_hash_to_g2(&hash,h,32,(const uint8_t*)dst,sizeof(dst)-1,0,0);blst_p2_to_affine(&hashed,&hash);MARK(7);
 blst_fp12 left,right;
#ifdef MULTI
 blst_p1 ng=*blst_p1_generator();blst_p1_cneg(&ng,1);blst_p1_affine negative_generator;blst_p1_to_affine(&negative_generator,&ng);
 const blst_p2_affine*qs[2]={&hashed,&signature};const blst_p1_affine*ps[2]={&pk,&negative_generator};
 blst_miller_loop_n(&left,qs,ps,2);MARK(8);
 blst_final_exp(&right,&left);if(!blst_fp12_is_one(&right))return 17;MARK(9);
#else
 blst_miller_loop(&left,&hashed,&pk);blst_miller_loop(&right,&signature,blst_p1_affine_generator());MARK(8);
 if(!blst_fp12_finalverify(&left,&right))return 17;MARK(9);
#endif
 uint8_t out[104],domain[32];uint64_t n=104;const char label[]="WO04-E2A Ethereum mainnet finalized execution v1";sha((const uint8_t*)label,sizeof(label)-1,domain);
 if(ckb_load_cell_data(out,&n,0,0,CKB_SOURCE_OUTPUT)||n!=104||memcmp(out,domain,32)||memcmp(out+32,chunks+64,32)||memcmp(out+64,chunks+192,8)||memcmp(out+72,chunks+384,32))return 18;MARK(10);
#ifdef PROFILE
 for(unsigned i=0;i<11;i++){char message[70]="profile ";unsigned pos=8;message[pos++]='0'+i/10;message[pos++]='0'+i%10;message[pos++]=' ';uint64_t v=timing[i];char digits[24];unsigned n=0;do{digits[n++]='0'+v%10;v/=10;}while(v);while(n)message[pos++]=digits[--n];message[pos]=0;ckb_debug(message);}
#endif
 return 0;
}
