"""Independent READ-ONLY proof acquisition. No signer, private key or Ethereum tx."""
import json,sys
from pathlib import Path
from urllib.request import Request
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'devnet'))
from endpoints import endpoint,opener
address,slot,block=sys.argv[1:]
r=Request(endpoint('e2c-el',8545),data=json.dumps(dict(jsonrpc='2.0',id=1,method='eth_getProof',params=[address,[slot],block])).encode(),headers={'Content-Type':'application/json'})
with opener.open(r,timeout=20) as response:j=json.load(response)
assert 'error' not in j,j
print(json.dumps(j['result']))
