#include <stdint.h>
#include <string.h>
#include "proof.h"
int check(const uint8_t*p,size_t n,const uint8_t*root,const uint8_t*address,const uint8_t*code,const uint8_t*slot,uint8_t*out,int*present){Wire w={p,n,0};int r=prove(&w,root,address,code,slot,out,present);return r?r:(w.off==w.n?0:34);}
int rawcheck(const uint8_t*p,size_t n,const uint8_t*root,const uint8_t*key,int*present){Wire w={p,n,0};Item v;int r=trie(&w,root,key,&v,present);return r?r:(w.off==w.n?0:34);}
