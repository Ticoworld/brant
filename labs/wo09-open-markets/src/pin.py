from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parents[1];files={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest()for folder in ['contracts','src','build','models','fixtures']for p in (r/folder).glob('*')if p.is_file()}
(r/'PROVENANCE.json').write_text(json.dumps({'origin':'New WO09 research code; engine/trace verifier adapted from preserved rebuild harness. No competing third-party contract code copied.','inherited_dependencies':'Read-only labs/rebuild/native and labs/rebuild/mechanisms provenance/licenses; exact stdlib content pinned but upstream revision UNKNOWN. Published iCKB source-to-binary equivalence NOT independently established.','files':files},indent=2)+'\n')
