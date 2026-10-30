#!/usr/bin/env python3
"""Isolated CKB v0.210.0 pool probes. Test assets, always-success lock, no economic security.
Run: python node_probe.py --ckb /path/to/ckb --config /path/to/prepared/devnet
The prepared genesis MUST contain the bundled always_success code and an issued cell locked by it.
See reproduce.md for preparation. Starts and stops its own node in the same network namespace.
"""
import argparse,urllib.request,json,time,pathlib,subprocess,concurrent.futures,statistics,hashlib,platform
P=pathlib.Path(__file__).resolve().parents[1]; E=P/'evidence';E.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--ckb',default='/tmp/wo01-node-bin/ckb');a.add_argument('--config',default='/tmp/wo01-dev');args=a.parse_args()
log=open(E/'node-run.log','w');proc=subprocess.Popen([args.ckb,'run','-C',args.config,'--ba-advanced'],stdout=log,stderr=log)
transcript=[]
def rpc(method,params=[]):
 t=time.perf_counter();request={'jsonrpc':'2.0','id':1,'method':method,'params':params}
 with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:18114',json.dumps(request).encode(),{'Content-Type':'application/json'}),timeout=30) as r:j=json.load(r)
 transcript.append({'method':method,'params':params,'response':j,'ms':(time.perf_counter()-t)*1000})
 return j

def ok(m,p=[]):
 j=rpc(m,p)
 if 'error' in j:raise RuntimeError(j)
 return j['result']
def tx(outpoint,cap,outs=None,marker=''):
 return {'version':'0x0','cell_deps':[{'out_point':dep,'dep_type':'code'}],'header_deps':[], 'inputs':[{'since':'0x0','previous_output':outpoint}], 'outputs':outs or [{'capacity':hex(cap),'lock':lock,'type':None}],'outputs_data':['0x']*(len(outs) if outs else 1),'witnesses':['0x'+marker]}
def send(t):return rpc('send_transaction',[t,'passthrough'])
def mine(n):
 for _ in range(n):ok('generate_block');time.sleep(.05)
def status(h):return ok('get_transaction',[h])['tx_status']
try:
 for i in range(100):
  try:ok('get_tip_header');break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('node unavailable')
 version=ok('local_node_info')['version'];consensus=ok('get_consensus');gen=ok('get_block_by_number',['0x0']);h='0x'+hashlib.blake2b((pathlib.Path(args.config)/'always_success').read_bytes(),digest_size=32,person=b'ckb-default-hash').hexdigest()
 dep=next({'tx_hash':t['hash'],'index':hex(i)} for t in gen['transactions'] for i,d in enumerate(t['outputs_data']) if d!='0x' and '0x'+hashlib.blake2b(bytes.fromhex(d[2:]),digest_size=32,person=b'ckb-default-hash').hexdigest()==h)
 seed=next(({'tx_hash':t['hash'],'index':hex(i)},o) for t in gen['transactions'] for i,o in enumerate(t['outputs']) if o['lock']['code_hash']==h)
 lock=seed[1]['lock'];cap=int(seed[1]['capacity'],16);mine(12)
 outputs=[{'capacity':hex(100000*100000000),'lock':lock,'type':None} for _ in range(130)]
 outputs.append({'capacity':hex(cap-130*100000*100000000-1000000),'lock':lock,'type':None})
 split=send(tx(seed[0],cap,outputs));assert 'result' in split,split;root=split['result'];mine(4);assert status(root)['status']=='committed'
 shared={'tx_hash':root,'index':'0x0'};c=100000*100000000
 # Distinct raw transactions: decrease capacity differently, all same source.
 start=time.perf_counter()
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:shared_results=list(ex.map(lambda i:send(tx(shared,c-10000-i)),range(100)))
 shared_ms=(time.perf_counter()-start)*1000
 # 100 unique inventory inputs, submitted concurrently.
 start=time.perf_counter()
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:independent=list(ex.map(lambda i:send(tx({'tx_hash':root,'index':hex(i+1)},c-10000)),range(100)))
 independent_ms=(time.perf_counter()-start)*1000
 # 20 logical lanes, five chained transactions per lane, all accepted before mining.
 chains=[]
 for i in range(20):
  op={'tx_hash':root,'index':hex(101+i)};lc=c;lane=[]
  for j in range(5):
   lc-=10000;r=send(tx(op,lc));lane.append(r)
   if 'result' not in r:break
   op={'tx_hash':r['result'],'index':'0x0'}
  chains.append(lane)
 # A cancellation candidate pays much greater fee against one accepted chain root.
 chain0=chains[0][0].get('result');cancel=send(tx({'tx_hash':root,'index':hex(101)},c-1000000))
 chain_after=[status(r['result']) for r in chains[0] if 'result'in r]
 # record block milestones for representative independent transaction
 target=independent[0]['result'];milestones=[{'height':ok('get_tip_block_number'),'status':status(target)}]
 for i in range(4):mine(1);milestones.append({'height':ok('get_tip_block_number'),'status':status(target)})
 # Separate chain depth probe, 1001 submissions, stop first rejection, no mining.
 op={'tx_hash':root,'index':hex(125)};lc=c;depth=[]
 for i in range(1002):
  lc-=10000;r=send(tx(op,lc));depth.append(r)
  if 'result' not in r:break
  op={'tx_hash':r['result'],'index':'0x0'}
 results={'version':version,'network':'custom isolated devnet, Dummy PoW, no peers, manually generated blocks','platform':platform.platform(),'consensus':consensus,'shared_100':{'accepted':sum('result'in r for r in shared_results),'elapsed_ms':shared_ms,'errors':[r['error'] for r in shared_results if 'error'in r][:3]},'independent_100':{'accepted':sum('result'in r for r in independent),'elapsed_ms':independent_ms},'twenty_lanes_five_chained':{'accepted':[sum('result'in r for r in lane) for lane in chains]},'cancellation_replacement':cancel,'chain0_status_after_replacement':chain_after,'milestones':milestones,'depth_probe':{'accepted':sum('result'in r for r in depth),'last':depth[-1]},'limits':'always-success script, passthrough output validator; no signatures, OTX, xUDT, market matching, peer propagation or mainnet latency measured'}
 (E/'node-results.json').write_text(json.dumps(results,indent=2));print(json.dumps({k:v for k,v in results.items() if k!='consensus'},indent=2))
finally:
 (E/'node-rpc-transcript.json').write_text(json.dumps(transcript,indent=2));proc.terminate()
 try:proc.wait(timeout=15)
 except subprocess.TimeoutExpired:proc.kill()
 log.close()
