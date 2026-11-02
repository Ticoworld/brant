"""Fresh PRIVATE GitHub checkout, independent dependency install/build and devnet replay.
No push, deployment, real credentials, or edits outside destination/output arguments.
"""
from pathlib import Path
import argparse,subprocess,os,json,hashlib,shutil,time
p=argparse.ArgumentParser();p.add_argument('--commit',required=True);p.add_argument('--destination',required=True);p.add_argument('--output',required=True);p.add_argument('--ckb-archive-cache');a=p.parse_args()
dest=Path(a.destination).resolve();out=Path(a.output).resolve();assert not dest.exists();out.mkdir(parents=True,exist_ok=True)
report={'source_commit':a.commit,'repository':'https://github.com/Ticoworld/trade.git','branch':'wo09-open-market-discovery','started_unix':int(time.time()),'steps':[],'scope':'Fresh GitHub checkout/install/build/private-node execution on same host; optional explicitly verified release archive cache; not pristine OS or production security proof'}
def save(): (out/'reproduction.json').write_text(json.dumps(report,indent=2)+'\n')
def run(label,args,cwd=None,env=None):
 log=out/(label+'.log');r=subprocess.run(args,cwd=cwd,env=env,stdout=log.open('w'),stderr=subprocess.STDOUT);report['steps'].append({'label':label,'command':args,'exit':r.returncode,'log_sha256':hashlib.sha256(log.read_bytes()).hexdigest()});save();assert r.returncode==0,(label,str(log))
try:
 run('clone',['git','clone','--single-branch','--branch',report['branch'],report['repository'],str(dest)])
 run('checkout',['git','checkout','--detach',a.commit],dest)
 assert subprocess.check_output(['git','status','--porcelain'],cwd=dest,text=True)==''
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=dest,text=True).strip()==a.commit
 native=dest/'labs/rebuild/native';lab=dest/'labs/wo09-open-markets'
 if a.ckb_archive_cache:
  data=Path(a.ckb_archive_cache).read_bytes();sha=hashlib.sha256(data).hexdigest();assert sha=='68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf';(native/'tools').mkdir(exist_ok=True);(native/'tools/ckb.tar.gz').write_bytes(data);report['ckb_cache_sha256']=sha
 run('ckb',['python3',str(native/'src/bootstrap.py')])
 run('npm',['npm','ci','--ignore-scripts','--no-audit','--no-fund'],native)
 zigdir=dest/'labs/rebuild/mechanisms/tools/python';run('compiler',['python3','-m','pip','install','--target',str(zigdir),'ziglang==0.14.1'])
 zig=zigdir/'ziglang/zig';env={**os.environ,'ZIG_BIN':str(zig)}
 report['compiler_binary_sha256']=hashlib.sha256(zig.read_bytes()).hexdigest()
 run('published-provenance',['node',str(native/'src/verify-provenance.cjs')])
 run('new-source-provenance',['node',str(lab/'src/verify-source.cjs')])
 expected=json.loads((lab/'build/manifest.json').read_text());run('build',['python3',str(lab/'src/build.py')],env=env)
 report['recompiled_binaries']=[]
 for item in expected:
  actual=hashlib.sha256((lab/'build'/item['name']).read_bytes()).hexdigest();assert actual==item['sha256'];report['recompiled_binaries'].append({'name':item['name'],'sha256':actual,'byte_identical':True})
 before_models={str(f):hashlib.sha256(f.read_bytes()).hexdigest()for f in [lab/'evidence/discovery-models.json',lab/'evidence/market-scale-economics.json',*list((lab/'fixtures').glob('*.json'))]}
 run('formal-models',['python3',str(lab/'models/discovery.py')]);run('market-scale',['python3',str(lab/'models/market-scale.py')]);assert all(hashlib.sha256(Path(f).read_bytes()).hexdigest()==sha for f,sha in before_models.items())
 old=set((lab/'evidence').iterdir());jobs=[('claims','run-claims.cjs',{}),('hybrid','run-claims.cjs',{'WO09_HYBRID':'1'}),('risk','run-risk.cjs',{}),('market-risk','run-risk.cjs',{'WO09_CALIBRATED':'1'})]
 for label,script,extra in jobs:run(label,['node',str(lab/'src'/script)],env={**env,**extra})
 report['runs']=[]
 for d in sorted(set((lab/'evidence').iterdir())-old):
  if not d.is_dir():continue
  run('verify-'+d.name,['node',str(lab/'src/verify.cjs'),str(d)])
  info=json.loads((d/'complete.json').read_text());target=out/'evidence'/d.name;shutil.copytree(d,target,ignore=shutil.ignore_patterns('node.log'));(target/'reproduction.json').write_text(json.dumps({'source_commit':a.commit,'fresh_GitHub_clone':True},indent=2)+'\n');report['runs'].append({'directory':str(target.relative_to(out)),**info})
 report['status']='PASS';report['finished_unix']=int(time.time());save();print(json.dumps({'status':'PASS','source_commit':a.commit,'runs':report['runs']}))
except Exception as error:
 report['status']='FAILED';report['error']=str(error);save();raise
