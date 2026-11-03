"""Public read-only HTTP; no credentials, signing, trading or account creation."""
import urllib.request, urllib.error, json, datetime, pathlib
base=pathlib.Path(__file__).resolve().parents[1]/'evidence'
def read(name,url,body=None):
 req=urllib.request.Request(url,headers={'Content-Type':'application/json','User-Agent':'Trade-read-only-research/1'},data=None if body is None else json.dumps(body).encode())
 record={'at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'method':req.get_method(),'request_body':body,'classification':'PUBLIC_READ_ONLY_RESPONSE_NOT_EXECUTION'}
 try:
  with urllib.request.urlopen(req,timeout=25) as r:record.update(status=r.status,server_date=r.headers.get('Date'),body=r.read().decode())
 except urllib.error.HTTPError as e:record.update(status=e.code,body=e.read().decode())
 except Exception as e:record.update(error=str(e))
 try:record['body']=json.loads(record.get('body',''))
 except ValueError:pass
 (base/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(name,record.get('status'),str(record.get('body',record.get('error')))[:450])
if __name__=='__main__':
 read('utxoswap-pools','https://mainnet-api.utxoswap.xyz/utxo-swap/api/v1/sequencer/pools',{'pageNo':1,'pageSize':20,'searchKey':'RUSD'})
 read('utxoswap-config','https://mainnet-api.utxoswap.xyz/utxo-swap/api/v1/sequencer/configurations')
 read('ckb-usdt-denomination-only','https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=CKBUSDT')
