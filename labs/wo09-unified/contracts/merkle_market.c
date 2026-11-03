// Direct financial Merkle market research. Native CKB validation, no checkpoint prover.
#include "../../wo09-open-markets/contracts/common.h"
#define STATE 160
#define MAX_UPDATES 100
#define MAX_WITNESS (16+MAX_UPDATES*(104+320))
static uint8_t witness[MAX_WITNESS];
static int pure(int i,size_t s){uint64_t n=0;return plain(i,s)&&standard_owner(i,s)&&ckb_load_cell_data(0,&n,0,i,s)==0&&n==0;}
static uint64_t cap(int i,size_t s){uint64_t v=0;return field(&v,8,i,s,CKB_CELL_FIELD_CAPACITY)?0:v;}
static int wallet(int i,size_t s,const uint8_t*h){return pure(i,s)&&lock_is(i,s,h);}
static int fees(int ni,int no){__uint128_t a=0,b=0;for(int i=0;i<ni;i++)a+=cap(i,CKB_SOURCE_INPUT);for(int i=0;i<no;i++)b+=cap(i,CKB_SOURCE_OUTPUT);return a>=b&&a-b<=FEE_LIMIT;}
static void hash(const uint8_t*p,size_t n,uint8_t*out){blake2b_state st;blake2b_init(&st,32);blake2b_update(&st,p,n);blake2b_final(&st,out,32);}
static void branch(const uint8_t*l,const uint8_t*r,uint8_t*out){uint8_t p[65];p[0]=2;memcpy(p+1,l,32);memcpy(p+33,r,32);hash(p,65,out);}
static int leaf_valid(const uint8_t*r){uint64_t p=rd(r+32);if(!p){for(int i=0;i<48;i++)if(r[i])return 0;}return 1;}
static void leaf(const uint8_t*id,uint64_t index,const uint8_t*r,uint8_t*out){if(!rd(r+32)){memset(out,0,32);return;}uint8_t p[89];p[0]=1;memcpy(p+1,id,32);for(int j=0;j<8;j++)p[33+j]=(uint8_t)(index>>(8*j));memcpy(p+41,r,48);hash(p,89,out);}
static void root(const uint8_t*id,uint64_t index,const uint8_t*r,const uint8_t*proof,int depth,uint8_t*out){leaf(id,index,r,out);for(int d=0;d<depth;d++){uint8_t t[32];if((index>>d)&1)branch(proof+32*d,out,t);else branch(out,proof+32*d,t);memcpy(out,t,32);}}
static int depth_for(uint64_t n){int d=0;while((1ULL<<d)<n)d++;return d;}
static int valid(const uint8_t*d,uint64_t c){uint64_t n=rd(d+120);return !memcmp(d,"TCM0001",8)&&rd(d+80)<=1&&!(rd(d+88)>>56)&&n>0&&n<=1024&&rd(d+112)<=n&&(__uint128_t)rd(d+72)+rd(d+(rd(d+80)?104:96))==c;}
int main(void){uint8_t script[85],self[32],a[STATE],b[STATE];if(script32(script,self))return 10;int ni=count_cells(CKB_SOURCE_INPUT),no=count_cells(CKB_SOURCE_OUTPUT);if(ni<1||no<1)return 11;int vi=-1,vo=-1;
 for(int side=0;side<2;side++){int n=side?no:ni;size_t s=side?CKB_SOURCE_OUTPUT:CKB_SOURCE_INPUT;for(int i=0;i<n;i++){int t=type_is(i,s,self),l=lock_is(i,s,self);if(t!=l)return 12;if(t){if((side?vo:vi)!=-1)return 13;if(side)vo=i;else vi=i;}}}
 uint64_t wn=0;int ended=0;
 // Standard secp hashes all extra witnesses, each bounded to 32 KiB. Preserve full payload by framing it in up to four signed chunks.
 for(int chunk=0;chunk<4;chunk++){uint64_t size=MAX_WITNESS-wn;int r=ckb_load_witness(witness+wn,&size,0,ni+chunk,CKB_SOURCE_INPUT);if(r==CKB_INDEX_OUT_OF_BOUND){ended=1;break;}if(r||size>32768||size>MAX_WITNESS-wn)return 14;wn+=size;}
 if(!ended){uint64_t size=0;if(ckb_load_witness(0,&size,0,ni+4,CKB_SOURCE_INPUT)!=CKB_INDEX_OUT_OF_BOUND)return 14;}
 if(wn<16)return 14;uint64_t op=rd(witness),m=rd(witness+8);if(m>MAX_UPDATES)return 15;
 if(vi<0){if(vo!=0||op||m||wn!=16||minted_id(script+53,0)||bytes(b,STATE,0,CKB_SOURCE_OUTPUT)||!valid(b,cap(0,CKB_SOURCE_OUTPUT)))return 20;if(rd(b+80)||rd(b+96)||rd(b+104)||rd(b+112)||!lock_is(0,CKB_SOURCE_INPUT,b+8))return 21;uint8_t h[32]={0};for(int d=0;d<depth_for(rd(b+120));d++){uint8_t t[32];branch(h,h,t);memcpy(h,t,32);}return memcmp(h,b+128,32)?22:0;}
 if(vi!=0||bytes(a,STATE,0,CKB_SOURCE_INPUT)||!valid(a,cap(0,CKB_SOURCE_INPUT)))return 30;if(!fees(ni,no))return 31;
 if(vo<0){if(op!=7||m||wn!=16||rd(a+(rd(a+80)?104:96))||rd(a+112)||ni!=2||no!=1||!wallet(1,CKB_SOURCE_INPUT,a+8)||!wallet(0,CKB_SOURCE_OUTPUT,a+8)||cap(0,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 32;return 0;}
 if(vo!=0||bytes(b,STATE,0,CKB_SOURCE_OUTPUT)||!valid(b,cap(0,CKB_SOURCE_OUTPUT))||memcmp(a,b,80)||memcmp(a+88,b+88,8)||memcmp(a+120,b+120,8))return 33;
 if(op==2){if(m||wn!=16||rd(a+80)||rd(b+80)!=1||memcmp(a+96,b+96,64)||rd(a+112)!=rd(a+120)||ni!=2||no!=2||!wallet(1,CKB_SOURCE_INPUT,a+40)||!wallet(1,CKB_SOURCE_OUTPUT,a+40)||rd(a+96)<rd(a+104))return 40;return (__uint128_t)cap(0,CKB_SOURCE_OUTPUT)+rd(a+96)-rd(a+104)==cap(0,CKB_SOURCE_INPUT)?0:41;}
 if(rd(a+80)!=rd(b+80)||!m)return 42;int depth=depth_for(rd(a+120));uint64_t stride=104+32*depth;if(wn!=16+m*stride)return 43;
 uint8_t current[32];memcpy(current,a+128,32);__int128 P=rd(a+96),B=rd(a+104),count=rd(a+112);uint64_t indices[MAX_UPDATES];
 const uint8_t *first=0,*first_new=0;
 for(uint64_t j=0;j<m;j++){const uint8_t*item=witness+16+j*stride;uint64_t i=rd(item);const uint8_t*x=item+8,*y=x+48,*proof=y+48;indices[j]=i;if(i>=rd(a+120))return 44;for(uint64_t k=0;k<j;k++)if(indices[k]==i)return 45;if(!leaf_valid(x)||!leaf_valid(y))return 46;
  uint8_t h[32];root(script+53,i,x,proof,depth,h);if(memcmp(h,current,32))return 47;root(script+53,i,y,proof,depth,current);
  if(j==0){first=x;first_new=y;}
  if(op==1){if(rd(a+80)||rd(x+32)||!rd(y+32)||!rd(y+40)||rd(y+40)!=(__uint128_t)rd(y+32)*4/5||ni!=(int)m+1||no!=(int)m+1||!wallet(j+1,CKB_SOURCE_INPUT,y)||!wallet(j+1,CKB_SOURCE_OUTPUT,y))return 50;for(uint64_t k=0;k<j;k++)if(!memcmp(y,witness+16+k*stride+56,32))return 51; // distinct signers per batch
   if(j+1<m&&(__uint128_t)cap(j+1,CKB_SOURCE_OUTPUT)+rd(y+32)!=cap(j+1,CKB_SOURCE_INPUT))return 52;count++;
  }else if(op==3){if(!rd(a+80)||m!=1||memcmp(x,y,40)||!rd(x+40)||rd(y+40)>=rd(x+40)||!absolute_since(0,rd(a+88))||ni!=2||no!=2||!wallet(1,CKB_SOURCE_INPUT,x)||!wallet(1,CKB_SOURCE_OUTPUT,x)||cap(1,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 60;if(!rd(y+40))count--;
  }else if(op==6){if(rd(a+80)||m!=1||!rd(x+32)||rd(y+32)||ni!=2||no!=2||!wallet(1,CKB_SOURCE_INPUT,x)||!wallet(1,CKB_SOURCE_OUTPUT,x)||cap(1,CKB_SOURCE_OUTPUT)<cap(1,CKB_SOURCE_INPUT))return 61;count--;
  }else if(op==4){if(!rd(a+80)||ni!=3||no!=3||!rd(x+40))return 70;
   if(!j){if(!memcmp(x,y,32)||memcmp(x+32,y+32,16)||!wallet(1,CKB_SOURCE_INPUT,x)||!wallet(1,CKB_SOURCE_OUTPUT,x)||!wallet(2,CKB_SOURCE_INPUT,y)||!wallet(2,CKB_SOURCE_OUTPUT,y)||cap(1,CKB_SOURCE_OUTPUT)<=cap(1,CKB_SOURCE_INPUT))return 71;}
   else if(memcmp(x,y,40)||rd(y+40)<=rd(x+40))return 72;
  }else if(op==5){if(!rd(a+80)||memcmp(x,y,40)||!rd(x+40)||rd(y+40)<=rd(x+40)||ni!=2||no!=2||!pure(1,CKB_SOURCE_INPUT)||!pure(1,CKB_SOURCE_OUTPUT))return 73;uint8_t owner[32];if(field(owner,32,1,CKB_SOURCE_INPUT,CKB_CELL_FIELD_LOCK_HASH)||!lock_is(1,CKB_SOURCE_OUTPUT,owner))return 74;
  }else return 75;
  P+=(__int128)rd(y+32)-rd(x+32);B+=(__int128)rd(y+40)-rd(x+40);
 }
 (void)first;(void)first_new;
 if(P<0||B<0||count<0||P>UINT64_MAX||B>UINT64_MAX||count>UINT64_MAX||P!=rd(b+96)||B!=rd(b+104)||count!=rd(b+112)||memcmp(current,b+128,32))return 80;
 return 0;
}
