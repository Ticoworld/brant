PHDRS { data PT_LOAD FLAGS(6); code PT_LOAD FLAGS(5); dynamic PT_DYNAMIC FLAGS(6); }
SECTIONS {
 . = 0x1000;
 .dynsym : { *(.dynsym) } :data
 .dynstr : { *(.dynstr) } :data
 .hash : { *(.hash) } :data
 .gnu.hash : { *(.gnu.hash) } :data
 .rela.dyn : { *(.rela.dyn) } :data
 .dynamic : { *(.dynamic) } :data :dynamic
 . = ALIGN(0x1000);
 .text : { *(.text*) } :code
 .rodata : { *(.rodata*) } :code
}
