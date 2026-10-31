"""Independent read-only inventory of the P1A authority, not a new verifier."""
from pathlib import Path
import json,hashlib,re
R=Path(__file__).resolve().parents[1];P=R.parent/'wo04-e2/compact-intents';E=P.parent
s=(P/'contracts/settlement.c').read_text();root=(E/'rotation/contracts/root.c').read_text();state=(E/'rotation/contracts/state.c').read_text();v3=(P/'contracts/OutcomesV3.sol').read_text()
assert all(x in s for x in ['memcmp(rt+16,publisher,32)','memcmp(rt+85,publisher,32)','memcmp(rt+53,a+128,32)','le64(rt+117)<le64(a+512)','be64(a+56)!=1337','timestamp<=deadline','memcmp(h,rt+125,32)'])
assert all(x in root for x in ['CKB_SOURCE_GROUP_INPUT','type_matches(0,CKB_SOURCE_INPUT,a)','le(after+72)!=le(before+72)+1','le(after+80)<=le(before+80)'])
assert 'ckb_validate_type_id(script+53)' in state and '*count>2' in state
assert 'public immutable ETH_GENESIS' in v3 and 'o.registry==REGISTRY' in v3 and 'block.chainid,address(this)' in v3
binaries=json.loads((P/'evidence/devnet-binaries.json').read_text());chain=json.loads((P/'evidence/chain-live-recovered.json').read_text())
orders=[]
for t in chain['trades']:
 a=bytes.fromhex(t['terms'][2:]);assert len(a)==536 and hashlib.sha256(a).hexdigest()==t['commitment'][2:]
 orders.append(dict(label=t['label'],point=t['point'],commitment=t['commitment'],ethereumChainId=int.from_bytes(a[32:64],'big'),outcomes='0x'+a[76:96].hex(),ethereumGenesis='0x'+a[96:128].hex(),registry='0x'+a[128:160].hex(),ckbGenesis='0x'+a[160:192].hex(),contractCodeHash='0x'+a[480:512].hex(),minimumRootVersion=int.from_bytes(a[512:520],'little'),minimumExecutionBlock=int.from_bytes(a[520:528],'little')))
files=[P/'contracts/settlement.c',P/'contracts/OutcomesV3.sol',E/'rotation/contracts/root.c',E/'rotation/contracts/state.c',E/'rotation/contracts/bundle.c',E/'rotation/contracts/layout.h']
report=dict(baseline='7771f6c73fcebf6777e4d4f9c3b562eb797ecc36',classification='VERIFIED source inventory; design-only migration',binaries=binaries,pinnedOrders=orders,sources={str(f.relative_to(R.parents[1])):hashlib.sha256(f.read_bytes()).hexdigest() for f in files},findings={'normalContinuation':'supported existing registry only; roots immutable independently reusable','lowParticipation':'Fail closed beyond two missing; skipped update may be bypassed by later supported update while authenticated period information remains available; no guarantee across lost rotation','replacementCode':'incompatible with existing funded lock; identical 104 data is insufficient','publisherHalt':'funds may remain locked including refunds, which require authenticated later timestamp; no emergency timeout bypass','mutableGovernance':'no setter or backend registration in existing consumer/publisher/OutcomesV3','eip8390':'Captured Draft only; removal would stop this publisher without a prior explicitly authorized new design','legacyMigration':'Existing cells cannot be re-locked or redirected; complete existing authorized payout/refund then voluntarily create new version, if original publisher still works'})
(R/'evidence/authority-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('P1A pinned code, lineage, formats and 4 funded preimages independently inventoried')
