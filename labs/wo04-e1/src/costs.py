from pathlib import Path
import json,statistics,hashlib,subprocess
p=Path(__file__).resolve().parents[1];events=json.loads((p/'evidence/events.json').read_text());trades=json.loads((p/'evidence/trades.json').read_text());out={}
by={e['label']:e for e in events};ck=[];ev=[]
for e in events:
 if e['chain']=='ckb':ck.append({'label':e['label'],'hash':e['hash'],'bytes':e['bytes'],'cycles':int(e['cycles']['cycles'],0),'feeShannons':100000,'role':'prototype fixed fee, not cycle-priced'})
 else:ev.append({'label':e['label'],'hash':e['hash'],'gas':int(e['receipt']['gasUsed']),'effectiveGasPriceWei':int(e['receipt']['gasPrice']),'feeWei':int(e['receipt']['gasUsed'])*int(e['receipt']['gasPrice']),'reverted':e.get('reverted',False)})
cp=next(e for e in ck if e['label']=='verified_shared_checkpoint');shared=[e for e in ck if e['label'].endswith('_shared_recovery')];direct=[e for e in ck if 'individual_recovery'in e['label']or'delayed_individual_refund'in e['label']];sc=statistics.mean(e['cycles']for e in shared);dc=statistics.mean(e['cycles']for e in direct);sb=statistics.mean(e['bytes']for e in shared);db=statistics.mean(e['bytes']for e in direct)
out={'ckb':ck,'evm':ev,'measuredSharing':{'checkpoint':cp,'sharedAverageCycles':sc,'directAverageCycles':dc,'sharedAverageBytes':sb,'directAverageBytes':db,'twoTradeSharedTotalCycles':cp['cycles']+2*sc,'twoTradeDirectProxyCycles':2*dc,'twoTradeSharedBytes':cp['bytes']+2*sb,'twoTradeDirectProxyBytes':2*db},'largerBatchSensitivity':[{'N':n,'sharedCyclesAssumingConstantSmallTreeCosts':cp['cycles']+n*sc,'directCyclesProxy':n*dc,'sharedBytesAssumingConstantSmallTreeCosts':cp['bytes']+n*sb,'directBytesProxy':n*db}for n in [1,2,10,100,1000]],'modelLimits':'Only batches of1 or2 implemented. Larger-batch rows assume constant small-tree proof cost and omit added source-tree construction/proof-depth costs, consensus verification, root retention and finality wait. Not benchmarks or savings claims.','capacity':{'bootstrapAllocatedCKB':300,'checkpointAllocatedCKB':400,'bootstrapMinimumCKB':210,'checkpointMinimumCKB':294,'perTradePrincipalCKB':10000,'perTradeMinimumOccupiedCKB':430,'perTradeFeeReserveShannons':100000,'pendingPrincipalCKB':10000,'peakTradePrincipalCKB':50000},'hostLockMs':[{'label':t['label'],'ms':t.get('lockHostMs'),'terminalStatus':t['status']}for t in trades],'timingLimits':'Manual mining and EVM time jumps. Host elapsed values are not network delivery/finality predictions.'}
# Recover balances from captured canonical genesis and committed UTXO records without restarting a node.
rpc=[]
for f in(p/'evidence/rpc').glob('*.jsonl'):
 for line in f.read_text().splitlines():
  if line:rpc.append(json.loads(line))
env=json.loads((p/'config/environment.json').read_text());gen=next(x['response']['result']for x in rpc if x['chain']=='ckb'and x['method']=='get_block_by_number'and x['params']==['0x0']and x['response'].get('result',{}).get('header',{}).get('hash')==env['genesis'])
ledger={}
for tx in gen['transactions']:
 for i,o in enumerate(tx['outputs']):ledger[(tx['hash'],hex(i))]=o
initial=dict(ledger)
for e in events:
 if e['chain']!='ckb':continue
 tx=e['committed']['transaction'];inputTotal=0
 for inp in tx['inputs']:
  op=inp['previous_output'];inputTotal+=int(ledger.pop((op['tx_hash'],op['index']))['capacity'],0)
 outputTotal=sum(int(o['capacity'],0)for o in tx['outputs']);assert inputTotal-outputTotal==100000
 for i,o in enumerate(tx['outputs']):ledger[(tx['hash'],hex(i))]=o
env=json.loads((p/'config/environment.json').read_text());native={}
for role,party in env['parties'].items():
 def owns(o):return o['lock']['code_hash']==party['lock']['codeHash']and o['lock']['args']==party['lock']['args']
 native[role]={'initialNormalWalletShannons':sum(int(o['capacity'],0)for o in initial.values()if owns(o)),'finalNormalWalletShannons':sum(int(o['capacity'],0)for o in ledger.values()if owns(o))}
out['nativeBalancesFromCapturedLedger']=native;out['allCkbFeesShannons']=sum(x['feeShannons']for x in ck);out['allEvmFeesWei']=sum(x['feeWei']for x in ev)
(p/'evidence/costs.json').write_text(json.dumps(out,indent=2)+'\n')
ident={'node':subprocess.check_output(['node','--version'],text=True).strip(),'ckb':subprocess.check_output([str(p/'tools/ckb/ckb'),'--version'],text=True).strip(),'ckbBinarySHA256':hashlib.sha256((p/'tools/ckb/ckb').read_bytes()).hexdigest(),'zig':subprocess.check_output([str(p/'tools/python/ziglang/zig'),'version'],text=True).strip(),'platform':'Linux x86_64, isolated CKB Dummy PoW / Ganache Shanghai','dependencies':'package-lock.json','stdlibBaseline':'WO04 recovered vendored ckb-c-stdlib, preserved byte-for-byte in deps; per-file SHA256 in delivery manifest'}
(p/'evidence/runtime-identity.json').write_text(json.dumps(ident,indent=2)+'\n')
print(json.dumps({'sharedCycles':sc,'directCycles':dc,'checkpointCycles':cp['cycles'],'nativeBalances':native},indent=2))
