# Public, credential-free market data only. No orders, funds, accounts or fallback around restrictions.
from pathlib import Path
from datetime import datetime,timezone
import urllib.request,urllib.error,json
p=Path(__file__).resolve().parents[1]/'research';p.mkdir(exist_ok=True)
urls={'binance_exchange_info':'https://data-api.binance.vision/api/v3/exchangeInfo?symbol=CKBUSDT','binance_depth':'https://data-api.binance.vision/api/v3/depth?symbol=CKBUSDT&limit=100','ckbswap_public_page':'https://ckbswap.site/'}
for name,url in urls.items():
 result={'url':url,'method':'GET','retrieved_utc':datetime.now(timezone.utc).isoformat(),'classification':'PUBLIC_OBSERVATION_NOT_TRADE_OR_FIRM_NATIVE_QUOTE'}
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Trade-Research-public-read-only/1.0'})
  with urllib.request.urlopen(req,timeout=15) as r:
   body=r.read(1000000);result.update(status=r.status,server_date=r.headers.get('Date'),bytes=len(body))
  try:result['body']=json.loads(body)
  except ValueError:result['page_excerpt']=body.decode(errors='replace')[:4000]
 except Exception as e:result.update(error=repr(e),status=getattr(e,'code',None));print(name,'unavailable',repr(e))
 (p/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 if 'error' not in result:print(name,'status',result['status'],'bytes',result['bytes'])
