from pathlib import Path
import tempfile,subprocess,os
p=Path(__file__).resolve().parents[1];d=Path(tempfile.mkdtemp(prefix='wo04-isolated-'))/'chain'
subprocess.run(['node','src/setup.cjs',str(d)],cwd=p,check=True)
e=os.environ.copy();e['WO04_DEV']=str(d)
subprocess.run(['node','src/run.cjs'],cwd=p,env=e,check=True)
print('Dev chain:',d)
