import hashlib,json,struct
from pathlib import Path
R=Path(__file__).resolve().parents[1]
metrics=[]
for name in ['direct','subtract','direct64','subtract64','witness64','fast64','memory64']:
    b=(R/'build'/name).read_bytes()
    off=struct.unpack_from('<Q',b,32)[0]
    size,num=struct.unpack_from('<HH',b,54)
    segments=[]
    for i in range(num):
        typ,flags,fo,va,pa,fs,ms,align=struct.unpack_from('<IIQQQQQQ',b,off+size*i)
        if typ==1:segments.append({'virtualAddress':va,'fileBytes':fs,'mappedBytes':ms})
    metrics.append({'binary':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),
      'loadSegments':segments,'elfMappedBytes':sum(s['mappedBytes'] for s in segments)})
(R/'evidence/binary-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
