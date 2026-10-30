"""Only the pinned blst point serializer; no signing or private-key operations."""
from pathlib import Path
import subprocess,os
R=Path(__file__).resolve().parents[1];E=R.parent
(R/'build').mkdir(exist_ok=True)
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-native')
subprocess.run([str(E/'tools/python/ziglang/zig'),'cc','-shared','-fPIC','-O2','-mno-sha','-mno-adx','-D__BLST_PORTABLE__','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__',str(E/'vendor/blst/src/server.c'),'-o',str(R/'build/libblst.so.tmp')],env=env,check=True)

os.replace(R/'build/libblst.so.tmp',R/'build/libblst.so')
