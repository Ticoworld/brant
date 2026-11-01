"""Pinned independent Rust variants; upstream release binary equality is not assumed."""
from pathlib import Path
import os,subprocess,urllib.request,hashlib,shutil,json
root=Path(__file__).resolve().parents[1];tools=root/'tools';tools.mkdir(exist_ok=True)
env=os.environ.copy();env['CARGO_HOME']=str(tools/'cargo');env['RUSTUP_HOME']=str(tools/'rustup')
rustup=tools/'rustup-init'
if not rustup.exists():
    data=urllib.request.urlopen('https://static.rust-lang.org/rustup/archive/1.28.2/x86_64-unknown-linux-gnu/rustup-init',timeout=120).read()
    assert hashlib.sha256(data).hexdigest()=="20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c"
    rustup.write_bytes(data);rustup.chmod(0o755)
subprocess.run([str(rustup),'-y','--no-modify-path','--profile','minimal','--default-toolchain','1.74.0','--target','riscv64imac-unknown-none-elf'],env=env,check=True)
zig=os.environ.get('ZIG_BIN',str(tools/'python/ziglang/zig'))
cc=tools/'ckb-cc';cc.write_text('#!/usr/bin/env python3\nimport os,sys\na=[x for x in sys.argv[1:] if x!="--target=riscv64" and not x.startswith("-march=")]\nos.execv('+repr(zig)+',["zig","cc","-target","riscv64-freestanding","-mcpu=generic_rv64+m+c"]+a)\n');cc.chmod(0o755)
ar=tools/'ckb-ar';ar.write_text('#!/bin/sh\nexec "'+zig+'" ar "$@"\n');ar.chmod(0o755)
env['CC_riscv64imac_unknown_none_elf']=str(cc);env['AR_riscv64imac_unknown_none_elf']=str(ar)
cargo=tools/'cargo/bin/cargo';manifest=root/'rust/Cargo.toml';main=root/'rust/contracts/limit_order/src/main.rs';optimized=main.read_text();records=[]
for name,package,source in [('a2-source','limit_order',optimized.replace('default_alloc!(4 * 1024, 2 * 1024 * 1024, 64);','default_alloc!();')),('a2-optimized','limit_order',optimized),('gated_order','gated_order',optimized)]:
    main.write_text(source)
    try:
        command=[str(cargo),'build','--manifest-path',str(manifest),'--target','riscv64imac-unknown-none-elf','--release','--locked','-p',package]
        subprocess.run(command,env=env,check=True)
        binary=root/'rust/target/riscv64imac-unknown-none-elf/release'/package
        shutil.copyfile(binary,root/'build'/name)
        records.append(dict(name=name,bytes=binary.stat().st_size,sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),command=command))
    finally:main.write_text(optimized)
(root/'build/rust-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
