// Bounded research EIP-1186 inclusion verifier. Not audited.
#include "ckb_keccak256.h"
#define MAX_PROOF 24576
static uint32_t le32(const uint8_t*p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static uint64_t le64(const uint8_t*p){uint64_t v=0;for(int i=0;i<8;i++)v|=(uint64_t)p[i]<<(8*i);return v;}
static void kh(const uint8_t*p,size_t n,uint8_t*h){SHA3_CTX c;keccak_init(&c);keccak_update(&c,(unsigned char*)p,(uint16_t)n);keccak_final(&c,h);}
typedef struct{const uint8_t*raw;const uint8_t*p;size_t n,total;int list;} Item;
static int item(const uint8_t*p,size_t avail,Item*o){if(!avail)return 1;uint8_t b=p[0];size_t pre=0,n=0;int list=0;if(b<128){n=1;}else if(b<=183){pre=1;n=b-128;if(n==1&&avail>1&&p[1]<128)return 2;}else if(b<=191){pre=1+(b-183);if(pre>5||pre>avail||p[1]==0)return 3;for(size_t i=1;i<pre;i++)n=(n<<8)|p[i];if(n<56)return 4;}else if(b<=247){pre=1;n=b-192;list=1;}else{pre=1+(b-247);list=1;if(pre>5||pre>avail||p[1]==0)return 5;for(size_t i=1;i<pre;i++)n=(n<<8)|p[i];if(n<56)return 6;}if(pre>avail||n>avail-pre)return 7;*o=(Item){p,p+pre,n,pre+n,list};return 0;}
static int children(Item l,Item*a,size_t*cnt){if(!l.list)return 1;size_t off=0,k=0;while(off<l.n){if(k>=17||item(l.p+off,l.n-off,a+k))return 2;off+=a[k++].total;}if(off!=l.n)return 3;*cnt=k;return 0;}
typedef struct{const uint8_t*p;size_t n,off;} Wire;
static int node(Wire*w,Item*o){if(w->off+2>w->n)return 1;size_t z=(size_t)w->p[w->off]|((size_t)w->p[w->off+1]<<8);w->off+=2;if(!z||z>2048||z>w->n-w->off)return 2;if(item(w->p+w->off,z,o)||o->total!=z||!o->list)return 3;w->off+=z;return 0;}
static int nib(const uint8_t*p,size_t k){return (p[k/2]>>(k%2?0:4))&15;}
static int trie(Wire*w,const uint8_t*root,const uint8_t*key,Item*value){if(w->off+2>w->n)return 10;size_t count=w->p[w->off]|((size_t)w->p[w->off+1]<<8);w->off+=2;if(!count||count>65)return 11;uint8_t expected[32],h[32];memcpy(expected,root,32);size_t path=0,used=0;Item embedded={0};
 for(int step=0;step<130;step++){Item nd;if(embedded.raw){nd=embedded;embedded.raw=0;}else{if(used>=count||node(w,&nd))return 12;used++;kh(nd.raw,nd.total,h);if(memcmp(h,expected,32))return 13;}Item a[17];size_t c;if(children(nd,a,&c))return 14;Item next;
  if(c==17){if(path==64){if(a[16].list||!a[16].n||used!=count)return 15;*value=a[16];return 0;}next=a[nib(key,path++)];}
  else if(c==2){if(a[0].list||!a[0].n)return 16;int flag=a[0].p[0]>>4;if(flag>3||(!(flag&1)&&(a[0].p[0]&15)))return 17;size_t start=(flag&1)?1:2,len=a[0].n*2-start;if(len>64-path)return 18;for(size_t j=0;j<len;j++)if(nib(a[0].p,j+start)!=nib(key,path+j))return 19;path+=len;if(flag&2){if(path!=64||a[1].list||used!=count)return 20;*value=a[1];return 0;}if(!len)return 21;next=a[1];}
  else return 22;
  if(next.list){if(next.total>=32)return 23;embedded=next;}else{if(next.n!=32)return 24;memcpy(expected,next.p,32);}
 }return 25;}
static int prove(Wire*w,const uint8_t*stateRoot,const uint8_t*address,const uint8_t*codeHash,const uint8_t*slot,uint8_t*out){uint8_t key[32];kh(address,20,key);Item acc;if(trie(w,stateRoot,key,&acc))return 30;Item l,a[17];size_t n;if(item(acc.p,acc.n,&l)||l.total!=acc.n||children(l,a,&n)||n!=4||a[2].list||a[3].list||a[2].n!=32||a[3].n!=32||memcmp(a[3].p,codeHash,32))return 31;uint8_t storageRoot[32];memcpy(storageRoot,a[2].p,32);kh(slot,32,key);Item val;if(trie(w,storageRoot,key,&val))return 32;Item scalar;if(item(val.p,val.n,&scalar)||scalar.total!=val.n||scalar.list||scalar.n>32||(scalar.n>0&&scalar.p[0]==0))return 33;memset(out,0,32);memcpy(out+32-scalar.n,scalar.p,scalar.n);return 0;}
static int dep(const uint8_t*typehash,uint8_t*data,uint64_t*size){uint8_t h[32];for(size_t i=0;i<100;i++){uint64_t n=32;int r=ckb_load_cell_by_field(h,&n,0,i,CKB_SOURCE_CELL_DEP,CKB_CELL_FIELD_TYPE_HASH);if(r==CKB_INDEX_OUT_OF_BOUND)return 1;if(r==CKB_SUCCESS&&n==32&&!memcmp(h,typehash,32))return ckb_load_cell_data(data,size,0,i,CKB_SOURCE_CELL_DEP);}return 2;}
