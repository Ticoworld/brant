"""Prepare isolated pinned source; never edit upstream checkout. No proof policy changes."""
import pathlib, subprocess, sys, tarfile, io
root = pathlib.Path(__file__).resolve().parents[1]
source, output = map(pathlib.Path, sys.argv[1:])
pin = '47492b51673c94635ab23de2c55477625e94ccbf'
assert subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'], text=True).strip() == pin
assert not subprocess.check_output(['git','-C',str(source),'status','--porcelain'], text=True).strip()
output.mkdir(parents=True, exist_ok=False)
archive = subprocess.check_output(['git','-C',str(source),'archive',pin])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar: tar.extractall(output, filter='data')
p = output/'crates/ckb-contract/src/escape.rs'
s = p.read_text()
needle = 'if !has_exit_output(&blake160(pubkey), balance as u64) {'
assert s.count(needle) == 1
s = s.replace(needle, 'if !has_exit_output(&blake160(pubkey), balance as u64) && !has_recipient_merge(&blake160(pubkey), balance as u64) {')
p.write_text(s + '\n' + (root/'src/recipient_merge.rs').read_text())
print(output)
