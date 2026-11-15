from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
manifest={'schema':2,'stdlib_origin':'MIT preserved WO04 ckb-c-stdlib content; upstream Git revision UNKNOWN, exact per-file content pinned','rust_origin':'MIT iCKB c951927e35fb5d4a13e28c5e55687d49cea7ca05, contract-source revision454cfa966052a621c4e8b67001718c29ee8191a2. Bounded heap and exact-gate adaptation disclosed in reports.','compiler':'Zig0.14.1 and Rust1.74.0, locked ckb-std0.15.3; rv64imc C glue target normalization','artifact_domains':{'build':'Original deployed binaries from scratch build path, preserved for exact existing receipt comparisons','build/rebuilt':'Permanent source build with remapped paths, separately executed native gate and1536-order comparison','build/rebuilt-unmapped':'Hash/size manifest of an intermediate path-sensitive build; no native-security claim; binary snapshot retained in Git commit b824dda'},'limits':['Source-built artifacts differ from published34200-byte A2; no false source-to-published equivalence','Exact across-directory deterministic compilation requires its own comparison; source path remapping is explicit','No general authenticated recovery/LO-01 security fix'], 'files':{}}
for folder in ['deps','contracts','src','rust','build']:
    for file in sorted((root/folder).rglob('*')):
        relative=file.relative_to(root)
        if 'target' in relative.parts or '__pycache__' in relative.parts:continue
        if file.is_file():manifest['files'][str(relative)]=hashlib.sha256(file.read_bytes()).hexdigest()
(root/'PROVENANCE.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(len(manifest['files']),'content pins written')
