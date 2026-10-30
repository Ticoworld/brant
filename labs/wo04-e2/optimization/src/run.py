import subprocess,json,re,time,hashlib
from pathlib import Path
O=Path(__file__).resolve().parents[1];D=O.parent/'tools/debugger/ckb-debugger'
rows=[]
for n in ['512','511','510']:
 for p in sorted((O/'build'/n).glob('*.json')):
    start=time.monotonic();q=subprocess.run([str(D),'--tx-file',str(p),'--script','input.0.lock','--max-cycles','3500000000'],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
    (O/'evidence'/f'{n}-{p.stem}.log').write_text(q.stdout)
    m=re.search(r'Run result: (-?\d+)',q.stdout);c=re.search(r'All cycles: (\d+)',q.stdout)
    code=int(m[1]) if m else None;ok=(code!=0 and code is not None) if p.stem.startswith('bad-') else code==0
    rows.append({'participants':int(n),'case':p.stem,'scriptExit':code,'runnerExit':q.returncode,'cycles':int(c[1]) if c else None,'expectedOutcomeObserved':ok,'profile':dict((int(k),int(v)) for k,v in re.findall(r'profile (\d+) (\d+)',q.stdout))})
    (O/'evidence/results.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(rows[-1],flush=True)
    if not ok:raise RuntimeError(q.stdout)
