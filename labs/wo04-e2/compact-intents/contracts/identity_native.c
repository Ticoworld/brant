#include <stdint.h>
#include <string.h>
#include "hash.h"
void identify(const uint8_t*terms,const uint8_t*outpoint,uint8_t*out){uint8_t m[544]={0};memcpy(m,terms,480);memcpy(m+480,outpoint,32);for(unsigned i=0;i<4;i++)m[540+i]=outpoint[35-i];sha(m,544,out);}
