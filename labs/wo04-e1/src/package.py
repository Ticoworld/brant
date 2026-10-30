from pathlib import Path
import json,hashlib,zipfile
p=Path(__file__).resolve().parents[1];outer=p.parents[1]
files=sorted(f for f in p.rglob('*')if f.is_file()and not f.is_symlink()and not any(x in f.parts for x in ['node_modules','tools','.git','__pycache__'])and f.name not in ['SHA256SUMS.txt','delivery-index.json'])
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
(p/'SHA256SUMS.txt').write_text(''.join(digest(f)+'  '+f.relative_to(p).as_posix()+'\n'for f in files));files.append(p/'SHA256SUMS.txt')
source=[];evidence=[]
for f in files:
 (evidence if 'evidence'in f.relative_to(p).parts or'retained_earlier_rpc'in f.relative_to(p).parts else source).append(f)
result=[]
for name,selection in [('WO04_E1_Implementation.zip',source),('WO04_E1_Execution_Evidence.zip',evidence)]:
 z=outer/name;manifest=[{'path':str(Path('CKB_TRADING_OPPORTUNITY/WO04_E1_AUTHENTICATED_OUTCOMES')/f.relative_to(p)),'sha256':digest(f),'bytes':f.stat().st_size}for f in selection]
 with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED)as archive:
  for f,m in zip(selection,manifest):archive.write(f,m['path'])
  archive.writestr('ARCHIVE_MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
 with zipfile.ZipFile(z)as archive:
  assert archive.testzip()is None
  for m in manifest:assert hashlib.sha256(archive.read(m['path'])).hexdigest()==m['sha256']
 result.append({'file':str(z),'files':len(manifest),'bytes':z.stat().st_size,'sha256':digest(z),'crc':'passed','entryHashes':'passed'})
(p/'delivery-index.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
