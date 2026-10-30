#!/usr/bin/env python3
"""Prepare a NEW isolated devnet. Refuses existing config directory. Test assets only."""
import argparse,pathlib,subprocess,shutil
p=argparse.ArgumentParser();p.add_argument('--ckb',required=True);p.add_argument('--directory',required=True);a=p.parse_args();d=pathlib.Path(a.directory).resolve()
if d.exists():raise SystemExit('Refusing existing destination, choose a fresh directory')
subprocess.run([a.ckb,'init','-C',str(d),'--chain','dev','--rpc-port','18114','--p2p-port','18115'],check=True)
s=pathlib.Path(__file__).parent
shutil.copy2(s/'ckb.toml',d/'ckb.toml');shutil.copy2(s/'dev.toml',d/'specs/dev.toml');shutil.copy2(s/'always_success',d/'always_success')
print('Prepared isolated devnet at',d)
