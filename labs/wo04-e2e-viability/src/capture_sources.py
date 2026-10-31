"""Bounded, read-only primary-source capture. HTTP denial is evidence, not a quote."""
import urllib.request,urllib.error,json,datetime,hashlib,concurrent.futures
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'evidence/sources';D.mkdir(exist_ok=True)
if (R/'evidence/source-index.json').exists():raise SystemExit('Refuse to overwrite dated source snapshots; use a separate directory for new captures')
urls={
'coingecko':'https://api.coingecko.com/api/v3/simple/price?ids=nervos-network,ethereum&vs_currencies=usd&include_last_updated_at=true',
'binance-depth':'https://api.binance.com/api/v3/depth?symbol=CKBUSDT&limit=100',
'binance-price':'https://api.binance.com/api/v3/ticker/bookTicker?symbol=CKBUSDT',
'coinbase-eth':'https://api.coinbase.com/v2/prices/ETH-USD/spot',
'ethgas':'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
'base-gas':'https://api.coinbase.com/v2/prices/ETH-USD/buy',
'across-quote':'https://app.across.to/api/suggested-fees?token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&originChainId=1&destinationChainId=8453&amount=100000000',
'lifi-quote':'https://li.quest/v1/quote?fromChain=1&toChain=8453&fromToken=USDC&toToken=USDC&fromAmount=100000000&fromAddress=0x0000000000000000000000000000000000000001',
'circle':'https://developers.circle.com/stablecoins/usdc-contract-addresses',
'base-finality':'https://docs.base.org/base-chain/network-information/transaction-finality',
'arbitrum-finality':'https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality',
'linea-finality':'https://docs.linea.build/get-started/how-linea-works/finalization',
'linea-contract':'https://raw.githubusercontent.com/Consensys/linea-monorepo/main/contracts/src/rollup/LineaRollup.sol',
'linea-interface':'https://raw.githubusercontent.com/Consensys/linea-monorepo/main/contracts/src/interfaces/l1/ILineaRollup.sol',
'eip8390':'https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-8390.md',
'across-contract':'https://raw.githubusercontent.com/across-protocol/contracts/master/contracts/SpokePool.sol',
'circle-tokenlist':'https://raw.githubusercontent.com/circlefin/stablecoin-evm/master/doc/tokendesign.md',
'eth-finality':'https://raw.githubusercontent.com/ethereum/consensus-specs/v1.5.0/specs/phase0/beacon-chain.md',
'binance-markets':'https://www.binance.com/en/trade/CKB_USDT',
}
def fetch(kv):
 k,u=kv;t=datetime.datetime.now(datetime.timezone.utc).isoformat();status=None;headers={}
 try:
  q=urllib.request.Request(u,headers={'User-Agent':'CKB-E2E-read-only-audit/1.0'})
  with urllib.request.urlopen(q,timeout=25) as x:status=x.status;headers=dict(x.headers);b=x.read(2000000)
 except urllib.error.HTTPError as e:status=e.code;headers=dict(e.headers);b=e.read(20000)
 except Exception as e:b=str(e).encode()
 (D/(k+'.body')).write_bytes(b)
 return dict(id=k,url=u,retrievedAt=t,status=status,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),headers=headers)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:rows=list(ex.map(fetch,urls.items()))
(R/'evidence/source-index.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k in ['id','status','bytes']} for r in rows],indent=2))
