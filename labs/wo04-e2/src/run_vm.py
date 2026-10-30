"""Bounded real ckb-vm runs; preserve program and runner outcomes separately."""
import hashlib,json,re,subprocess,time,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
debug=str(R/'tools/debugger/ckb-debugger')
results=[]
prefix='fast-' if '--fast' in sys.argv else ''
for name in ['valid','wrong-root','signature','state-root','committee','bits']:
    cmd=[debug,'--tx-file',str(R/f'build/mock-{prefix}{name}.json'),'--script','input.0.lock','--max-cycles','3500000000']
    start=time.monotonic()
    p=subprocess.run(cmd,cwd=R,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
    text=p.stdout;(R/f'evidence/tx-{prefix}{name}.log').write_text(text)
    m=re.search(r'Run result: (-?\d+)',text);c=re.search(r'All cycles: (\d+)',text)
    result=int(m[1]) if m else None
    require=(result==0) if name=='valid' else (result is not None and result!=0)
    results.append({'name':name,'runnerExit':p.returncode,'scriptExit':result,
      'cycles':int(c[1]) if c else None,'seconds':time.monotonic()-start,'expectedOutcomeObserved':require})
    (R/f'evidence/{prefix}vm-transaction-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(results[-1],flush=True)
    if not require:raise RuntimeError(text)
