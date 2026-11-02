"""One-pass public-source capture; failures are evidence, never bypassed."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from datetime import datetime,timezone
import json,hashlib,re
root=Path(__file__).resolve().parents[1];out=root/'research/web';out.mkdir(parents=True,exist_ok=True)
urls={
'uniswap-launcher':'https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/overview',
'baseline':'https://www.baseline.markets/faq',
'nirvana':'https://docs.nirvana.finance/',
'ohrex':'https://talk.nervos.org/t/ohrex-protocol-decentralized-token-launchpad-with-auto-dex-deployment-on-ckb/10162.json',
'crowdcell-search':'https://talk.nervos.org/search.json?q=CrowdCell',
'ckb-bonding-search':'https://talk.nervos.org/search.json?q=bonding%20curve',
'lucent-search':'https://talk.nervos.org/search.json?q=Lucent',
'ckbswap-search':'https://talk.nervos.org/search.json?q=CKBSwap',
'remit-search':'https://talk.nervos.org/search.json?q=Remit',
'sluice-search':'https://talk.nervos.org/search.json?q=Sluice',
'deribit-fees':'https://www.deribit.com/pages/information/fees',
'deribit-api':'https://docs.deribit.com/',
'ckb-price':'https://api.coingecko.com/api/v3/simple/price?ids=nervos-network&vs_currencies=usd&include_last_updated_at=true',
'ckb-book':'https://api.gateio.ws/api/v4/spot/order_book?currency_pair=CKB_USDT&limit=10'}
def fetch(item):
 name,url=item;r={'id':name,'url':url,'requested_at':datetime.now(timezone.utc).isoformat(),'source_role':'Public reference or market snapshot; no customer-demand inference'}
 try:
  with urlopen(Request(url,headers={'User-Agent':'TradeResearch/WO09 public-source audit'}),timeout=25) as response:
   data=response.read(3*1024*1024);r.update(status=response.status,final_url=response.url,content_type=response.headers.get('Content-Type'),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data));(out/(name+'.raw')).write_bytes(data)
   text=data.decode('utf8','replace');text=re.sub(r'<(script|style)\b.*?</\1>',' ',text,flags=re.S|re.I);text=re.sub('<[^>]+>',' ',text);text=re.sub(r'\s+',' ',text);(out/(name+'.txt')).write_text(text)
 except HTTPError as e:r.update(status=e.code,error=str(e))
 except Exception as e:r.update(status='FAILED',error=str(e))
 return r
with ThreadPoolExecutor(max_workers=6) as executor:results=list(executor.map(fetch,urls.items()))
(out/'manifest.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r['id'],r['status'],r.get('bytes',0))
