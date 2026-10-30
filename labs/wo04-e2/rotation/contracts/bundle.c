/* One code-hash-authenticated program, disjoint canonical argument lengths.
 * This avoids accepting a caller-selected registry implementation and avoids
 * cyclic code-hash constants across the three mutually authenticating roles.
 */
#define main state_main
#include "state.c"
#undef main
#define main certificate_main
#include "certificate.c"
#undef main
#define main root_main
#include "root.c"
#undef main
int main(void){
 uint8_t s[200];uint64_t n=sizeof(s);if(ckb_load_script(s,&n,0))return 110;
 if(n==53)return 0; /* Fixed permissionless state lock; types still enforce data. */
 if(n==85)return state_main();
 if(n==165)return certificate_main();
 if(n==157)return root_main();
 return 111;
}
