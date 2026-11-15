from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(root.parent/'native/src/bootstrap.py')],check=True)
subprocess.run([sys.executable,'-m','pip','install','--target',str(root/'tools/python'),'ziglang==0.14.1'],check=True)
subprocess.run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],cwd=root.parent/'native',check=True)
