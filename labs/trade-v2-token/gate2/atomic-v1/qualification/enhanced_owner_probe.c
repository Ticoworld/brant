/* ISOLATED QUALIFICATION ONLY. Not an issuance implementation or deployable
 * Brant market family. Establishes deployed xUDT dynamic-validator compatibility. */
#include "ckb_syscalls.h"
#include <stdint.h>
#include <string.h>
__attribute__((visibility("default")))
int validate(int owner_mode, size_t extension_index,const uint8_t *args,size_t len){
  (void)owner_mode;(void)extension_index;
  uint8_t input[44];uint64_t n=44;
  if(len!=36||ckb_load_input(input,&n,0,0,CKB_SOURCE_INPUT)||n!=44)return 71;
  return memcmp(input+8,args,36)?72:0;
}
/* Never permit the ordinary input-lock owner-mode path. */
int main(void){return 73;}
