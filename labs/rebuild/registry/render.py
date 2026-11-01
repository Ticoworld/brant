"""Validate and render the permanent capability registry; no inferred PASS."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
p=root/'docs/TRADE_CAPABILITY_REGISTRY.json';registry=json.loads(p.read_text());seen=set()
text=['# Trade capability and research registry','','Scope: eight work orders WO05-E1 through WO08-E2. A–D foundation readiness is not comprehensive recovery. Baseline classifications record pushed commit 079b263; current classifications evolve with evidence. Historical targets are references, never forced outputs.','','| ID / work order | Mechanism | Current classification | Evidence / implementation | Limitations and future reuse |','|---|---|---|---|---|']
for row in registry['capabilities']:
 assert row['id'] not in seen;seen.add(row['id'])
 for status in row['status']:assert status in registry['classification_definitions']
 for file in row['implementation']+row['evidence']:assert (root/file).exists(),file
 assert row['limitations'] and row['future_reuse']
 paths='<br>'.join('`'+f+'`' for f in row['implementation']+row['evidence']) or 'No new executable evidence'
 text.append(f"| {row['id']} / {row['work_order']} | {row['mechanism']} | {'; '.join(row['status'])} | {paths} | {' '.join(row['limitations'])} Reuse: {row['future_reuse']} |")
(root/'docs/TRADE_CAPABILITY_REGISTRY.md').write_text('\n'.join(text)+'\n')
print(len(seen),'registry capabilities validated')
