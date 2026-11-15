"""Index existing completed AND failed runs without upgrading failures to passes."""
from pathlib import Path
import json,gzip,hashlib
r=Path(__file__).resolve().parents[1];out=[]
for d in sorted((r/'evidence').iterdir()):
 if not d.is_dir() or not (d/'events.json').exists():continue
 events=json.loads((d/'events.json').read_text());cases=json.loads((d/'cases.json').read_text());failed=(d/'failure.json').exists()
 if (d/'node.log').exists():(d/'node.log.gz').write_bytes(gzip.compress((d/'node.log').read_bytes(),mtime=0))
 out.append({'directory':str(d.relative_to(r)),'status':'FAILED' if failed else 'COMPLETED' if (d/'complete.json').exists() else 'INCOMPLETE','transactions':len(events),'cases':len(cases),'failure':json.loads((d/'failure.json').read_text()) if failed else None,'measurements':[{'label':e['label'],'hash':e['hash'],'bytes':e['bytes'],'cycles':e['cycles']}for e in events],'raw_sha256':hashlib.sha256((d/'raw.jsonl.gz').read_bytes()).hexdigest()})
(r/'evidence/native-index.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'runs':len(out),'completed':sum(x['status']=='COMPLETED'for x in out),'failed':sum(x['status']=='FAILED'for x in out),'scope':'Iterations and reproduction repeats are not independent mechanism counts'}))
