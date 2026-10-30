import json,hashlib
from pathlib import Path
O=Path(__file__).resolve().parents[1]
names=['witness/context/committee commitment','SSZ finality/execution/domain','G1 parse/curve/canonical binding','G1 aggregate subgroup','missing proofs/subgroups/subtraction','G2 parse/curve/canonical binding','G2 signature subgroup','hash-to-G2','Miller loop(s)','final exponent/equality','transaction output binding']
rows=json.loads((O/'evidence/results.json').read_text())
profiles=[{'participants':r['participants'],'mode':r['case'],'stages':[{'name':names[int(k)],'cycles':v} for k,v in r['profile'].items()]} for r in rows if r['profile']]
(O/'evidence/profiles.json').write_text(json.dumps(profiles,indent=2)+'\n')
bins=[]
for p in sorted((O/'build').rglob('*')):
 if not p.is_file() or p.suffix or p.name=='context.h':continue
 b=p.read_bytes()
 if b[:4]!=b'\x7fELF':continue
 bins.append({'binary':str(p.relative_to(O)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(O/'evidence/binaries.json').write_text(json.dumps(bins,indent=2)+'\n')
summary={'debuggerRuns':len(rows),'expectedOutcomes':sum(r['expectedOutcomeObserved'] for r in rows),'validRuns':sum(r['scriptExit']==0 for r in rows),'negativeRuns':sum(r['scriptExit'] not in (None,0) for r in rows),'optimized':[r for r in rows if r['case']=='affine-multi'],'nodeAdmissions':[json.loads((O/f'evidence/devnet-{n}.json').read_text()) for n in ['512','511','510']],'certificate':json.loads((O/'evidence/certificate-node.json').read_text())}
(O/'evidence/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
