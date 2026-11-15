// Disposable test-only owner. No cryptographic authorization or production use.
#include <stdint.h>
#include <stddef.h>
__attribute__((visibility("default")))
int validate(int owner_mode, size_t extension_index, const uint8_t *args, size_t args_len) {
  if (owner_mode != 0 || extension_index != 0 || args_len != 1 || args[0] != 0x42) return 31;
  uint8_t witness[4]; uint64_t len = 4;
  register uintptr_t a0 asm("a0")=(uintptr_t)witness;
  register uintptr_t a1 asm("a1")=(uintptr_t)&len;
  register uintptr_t a2 asm("a2")=0;
  register uintptr_t a3 asm("a3")=1;
  register uintptr_t a4 asm("a4")=1;
  register uintptr_t a7 asm("a7")=2074;
  asm volatile("ecall" : "+r"(a0) : "r"(a1),"r"(a2),"r"(a3),"r"(a4),"r"(a7) : "memory");
  return a0 == 0 && len == 4 && witness[0] == 'P' && witness[1] == 'A' && witness[2] == 'S' && witness[3] == 'S' ? 0 : 32;
}
