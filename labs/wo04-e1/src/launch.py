from pathlib import Path
import tempfile,subprocess,os
p=Path(__file__).resolve().parents[1];dev=Path(tempfile.mkdtemp(prefix='e1-isolated-'))/'chain'
subprocess.run(['node','src/setup.cjs',str(dev)],cwd=p,check=True)
env=os.environ.copy();env['E1_DEV']=str(dev)
subprocess.run(['node','src/run.cjs'],cwd=p,env=env,check=True)
print('Isolated dev chain:',dev)
