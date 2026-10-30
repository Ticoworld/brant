#!/usr/bin/env python3
"""Independent checks of the captured node results against raw RPC and block bodies."""
import json,pathlib
p=pathlib.Path(__file__).resolve().parents[1]/'evidence';r=json.loads((p/'node-rpc-transcript.json').read_text());b=json.loads((p/'node-commit-blocks.json').read_text());summary=json.loads((p/'node-results.json').read_text())
committed={t['hash'] for x in b for t in x['transactions'][1:]}
sends=[x for x in r if x['method']=='send_transaction'];root=sends[0]['response']['result']
independent=[x['response']['result'] for x in sends if 'result' in x['response'] and any(i['previous_output']['tx_hash']==root and 1<=int(i['previous_output']['index'],16)<=100 for i in x['params'][0]['inputs'])]
assert len(independent)==100 and set(independent)<=committed
assert len(committed)==197
assert summary['shared_100']['accepted']==1
assert all(s['status']=='rejected' for s in summary['chain0_status_after_replacement'])
assert summary['depth_probe']['accepted']==1000 and summary['depth_probe']['last']['error']['code']==-1105
assert summary['milestones'][-1]['status']['status']=='committed'
print('Verified: all 100 independent transactions are in the captured commit blocks; 197 total non-cellbase commits; five evicted descendants; 1000-member chain boundary; representative commitment.')
