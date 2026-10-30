/* Authorization diagnostic ONLY. Never releases principal. */
#include "ckb_syscalls.h"
#include <stdint.h>
#include <string.h>
#include "hash.h"
#include "proof.h"
#include "authorize.h"
int main(void){uint8_t s[465],d[104];uint64_t n=465;if(ckb_load_script(s,&n,0)||n!=465||le32(s+49)!=412)return 10;return authorize(s+53,d);}
