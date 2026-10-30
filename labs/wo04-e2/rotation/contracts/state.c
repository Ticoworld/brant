#include "layout.h"
#include "ckb_type_id.h"
static uint8_t old[STATE_SIZE],out[STATE_SIZE],want[STATE_SIZE],cert[CERT_SIZE];
int main(void){
 uint8_t script[100],identity[32],h[32];uint64_t n=sizeof(script);
 if(ckb_load_script(script,&n,0)||n!=85||script[49]!=32||script[50]||script[51]||script[52])return 70;
 if(ckb_validate_type_id(script+53))return 71;
 n=32;if(ckb_load_script_hash(identity,&n,0)||!type_matches(0,CKB_SOURCE_OUTPUT,identity)||cell_data(out,STATE_SIZE,0,CKB_SOURCE_OUTPUT))return 72;
 if(state_policy(out))return 73;
 uint8_t state_lock[64];n=sizeof(state_lock);
 if(ckb_load_cell_by_field(state_lock,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_LOCK)||n!=53||state_lock[48]!=4||memcmp(state_lock+16,script+16,32)||memcmp(state_lock+49,"\0\0\0\0",4))return 103;
 n=0;int creation=ckb_load_cell(h,&n,0,0,CKB_SOURCE_GROUP_INPUT)==CKB_INDEX_OUT_OF_BOUND;
 if(creation){
  n=sizeof(packet);if(ckb_load_witness(packet,&n,0,0,CKB_SOURCE_INPUT)||n!=912)return 74;
  beacon_root(packet,h);if(memcmp(h,checkpoint,32))return 75;
  merkle(h,packet+112,15,16);branch(h,packet+592,25,4);if(memcmp(h,packet+80,32))return 76;
  memcpy(h,packet+720,32);branch(h,packet+752,54,5);if(memcmp(h,packet+48,32))return 77;
  memset(want,0,STATE_SIZE);memcpy(want,"E2STATE1",8);memcpy(want+8,genesis,32);memcpy(want+40,checkpoint,32);memcpy(want+80,packet,8);memcpy(want+88,checkpoint,32);memcpy(want+120,packet+176,32);memcpy(want+152,packet+304,8);memcpy(want+160,packet+496,32);put64(want+192,le(packet)/8192);memcpy(want+200,packet+720,32);want[272]=3;
  return memcmp(want,out,STATE_SIZE)?78:0;
 }
 if(!type_matches(0,CKB_SOURCE_INPUT,identity)||cell_data(old,STATE_SIZE,0,CKB_SOURCE_INPUT)||state_policy(old)||le(old+72)==UINT64_MAX)return 79;
 uint64_t ci=0,co=0;n=8;if(ckb_load_cell_by_field(&ci,&n,0,0,CKB_SOURCE_INPUT,CKB_CELL_FIELD_CAPACITY))return 100;n=8;if(ckb_load_cell_by_field(&co,&n,0,0,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_CAPACITY)||ci!=co)return 100;
 n=sizeof(packet);if(ckb_load_witness(packet,&n,0,0,CKB_SOURCE_INPUT)||n<2362)return 80;
 uint8_t*a=packet+8,*f=a+112,*chunks=f+112,*eb=chunks+480,*fb=eb+128,*kr=fb+192,*agg=kr+32,*bits=agg+48,*sig=bits+64,*ua=sig+96,*us=ua+96,*count=us+192;
 if(*count>2||n!=2362+434*(uint64_t)*count)return 81;
 uint8_t*tail=count+1+434*(uint64_t)*count,*nc=tail+1,*nb=nc+32,*achunks=nb+160,*aeb=achunks+480;
 uint64_t ss=le(packet),as=le(a),fs=le(f),p=le(old+192),sp=ss/8192,ap=as/8192,fp=fs/8192;
 if(!(ss>as&&as>=fs)||ss<=le(old+264)||ss-1<194048*32ULL||ss-1>=269568*32ULL||fs<194048*32ULL||fs>=269568*32ULL)return 82;
 uint8_t rawinput[44];n=44;if(ckb_load_input(rawinput,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 83;
 uint64_t since=le(rawinput);if((since&0xff00000000000000ULL)!=0x4000000000000000ULL||(since&0x00ffffffffffffffULL)<1606824023ULL+12*ss)return 84;
 if(!(sp==p||(sp==p+1&&!zero32(old+232)))||fp>p+1)return 85;
 if(*tail>1)return 86;
 int learn=zero32(old+232)&&ap==p&&*tail;
 /* signature_slot is not itself BLS-signed: no retimed non-finalizing replay. */
 if(fs<=le(old+80)&&!learn)return 87;
 unsigned part=0;for(unsigned i=0;i<64;i++)for(unsigned j=0;j<8;j++)part+=(bits[i]>>j)&1;
 if(part*3<1024||512-part!=*count)return 88;
 const uint8_t*signing=sp==p?old+200:old+232;
 uint8_t ct[200];n=sizeof(ct);if(ckb_load_cell_by_field(ct,&n,0,0,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE)||n!=165||ct[48]!=4||memcmp(ct+16,script+16,32)||memcmp(ct+53,identity,32)||memcmp(ct+85,script+16,32))return 89;
 if(cell_data(cert,CERT_SIZE,0,CKB_SOURCE_CELL_DEP)||memcmp(cert,"E2BCERT1",8)||memcmp(cert+8,identity,32)||memcmp(cert+40,script+16,32)||le(cert+72)>le(old+72)||le(cert+80)!=sp||memcmp(cert+88,signing,32)||memcmp(cert+120,kr,32)||memcmp(cert+152,agg,48)||memcmp(cert+200,ua,96))return 90;
 /* The exact aggregate point was subgroup-checked by the immutable certificate. */
 uint8_t buf[64]={0};merkle(h,chunks,15,16);branch(h,eb,25,4);if(memcmp(h,f+80,32))return 91;
 beacon_root(f,h);branch(h,fb,105,6);if(memcmp(h,a+48,32))return 92;
 merkle(h,achunks,15,16);branch(h,aeb,25,4);if(memcmp(h,a+80,32))return 93;
 if(*tail){memcpy(h,nc,32);branch(h,nb,55,5);if(memcmp(h,a+48,32)||zero32(nc))return 94;if(ap==p&&!zero32(old+232)&&memcmp(nc,old+232,32))return 95;}
 else{uint8_t empty[192]={0};if(memcmp(nc,empty,192))return 96;}
 beacon_root(a,buf);uint8_t fork[64]={3};memcpy(fork+32,genesis,32);sha(fork,64,h);buf[32]=7;memset(buf+33,0,3);memcpy(buf+36,h,28);sha(buf,64,h);
 blst_p1_affine pk;if(point1(&pk,agg,ua))return 97;
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
 
 blst_p2_affine signature;if(point2(&signature,sig,us))return 15;
 if(!blst_p2_affine_in_g2(&signature))return 16;
 const char dst[]="BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
 blst_p2 hash;blst_p2_affine hashed;blst_hash_to_g2(&hash,h,32,(const uint8_t*)dst,sizeof(dst)-1,0,0);blst_p2_to_affine(&hashed,&hash);
 blst_fp12 left,right;
#ifdef MULTI
 blst_p1 ng=*blst_p1_generator();blst_p1_cneg(&ng,1);blst_p1_affine negative_generator;blst_p1_to_affine(&negative_generator,&ng);
 const blst_p2_affine*qs[2]={&hashed,&signature};const blst_p1_affine*ps[2]={&pk,&negative_generator};
 blst_miller_loop_n(&left,qs,ps,2);
 blst_final_exp(&right,&left);if(!blst_fp12_is_one(&right))return 17;
#else
 blst_miller_loop(&left,&hashed,&pk);blst_miller_loop(&right,&signature,blst_p1_affine_generator());
 if(!blst_fp12_finalverify(&left,&right))return 17;
#endif

 memcpy(want,old,STATE_SIZE);put64(want+72,le(old+72)+1);put64(want+264,ss);
 if(zero32(old+232)){if(fp!=p||ap!=p||!*tail)return 98;memcpy(want+232,nc,32);}
 else if(fp==p+1){memcpy(want+200,old+232,32);if(ap==fp&&*tail)memcpy(want+232,nc,32);else memset(want+232,0,32);}
 if(fs>le(old+80)){memcpy(want+80,f,8);beacon_root(f,want+88);memcpy(want+120,chunks+64,32);memcpy(want+152,chunks+192,8);memcpy(want+160,chunks+384,32);put64(want+192,fp);}
 if(fs>le(old+80)){
  /* A valid updater must not advance state while withholding its root record. */
  uint8_t rt[180],rootdata[104],expected[104];n=sizeof(rt);
  if(ckb_load_cell_by_field(rt,&n,0,1,CKB_SOURCE_OUTPUT,CKB_CELL_FIELD_TYPE)||n!=157||rt[48]!=4||memcmp(rt+16,script+16,32)||memcmp(rt+53,identity,32)||memcmp(rt+85,script+16,32)||memcmp(rt+117,want+72,8)||memcmp(rt+125,want+88,32))return 101;
  domain(identity,expected);memcpy(expected+32,want+120,72);if(cell_data(rootdata,104,1,CKB_SOURCE_OUTPUT)||memcmp(rootdata,expected,104))return 102;
 }
 return memcmp(want,out,STATE_SIZE)?99:0;
}
