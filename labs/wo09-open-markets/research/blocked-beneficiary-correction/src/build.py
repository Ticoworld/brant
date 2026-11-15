from pathlib import Path
import os,subprocess,hashlib,json
root=Path(__file__).resolve().parents[1];deps=root.parent/'rebuild/mechanisms/deps/ckb-c-stdlib';zig=os.environ.get('ZIG_BIN',str(root.parent/'rebuild/mechanisms/tools/python/ziglang/zig'));(root/'build').mkdir(exist_ok=True);records=[]
for name in ['funded_claim','maturity_event','risk_pool','beneficiary_record','transferable_risk','consumable_beneficiary','consumable_risk','consumable_beneficiary_hash','consumable_risk_hash']:
 command=[zig,'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-fdata-sections','-ffunction-sections','-I'+str(deps),'-I'+str(deps/'libc'),'-Icontracts','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/'+name,'contracts/'+name+'.c'];subprocess.run(command,cwd=root,check=True);binary=root/'build'/name;records.append({'name':name,'bytes':binary.stat().st_size,'sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'command':command,'compiler':subprocess.check_output([zig,'version'],text=True).strip()})
(root/'build/manifest.json').write_text(json.dumps(records,indent=2)+'\n')
