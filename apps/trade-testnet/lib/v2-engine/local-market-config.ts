import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyCodeDeployment} from './deployment-verification.ts';
import {deriveMarketIdentity} from './initialization.ts';
import {assertLocalMarketScripts} from './local-manifest.ts';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
const codeNames=['custody_smt','market_smt','custody_marker','marker_candidate','owner_lineage_candidate'];
/** Revalidate a browser-saved fixture manifest on every application load. */
export async function loadLocalMarketConfig(rpc:Rpc){
 const response=await fetch('/api/v2-init-bootstrap');
 if(!response.ok){const fallback=await fetch('/api/v2-local-bootstrap');if(!fallback.ok)throw Error('Local market configuration unavailable');return fallback.json();}
 const fixture=await response.json();if((await rpc('get_blockchain_info',[]) as {chain?:string})?.chain!=='ckb_dev'||await rpc('get_block_hash',['0x0'])!==fixture.genesis)throw Error('Wrong private chain');
 const raw=localStorage.getItem('roveko-local-market:'+fixture.genesis);if(!raw)throw Error('Verify initialized local market first');
 const manifest=JSON.parse(raw),names=codeNames;
 if(manifest.format!=='roveko-local-market-v1'||manifest.genesis!==fixture.genesis||!/^0x[0-9a-f]{64}$/i.test(manifest.initializationTransactionHash||'')||!/^0x[0-9a-f]{64}$/i.test(manifest.codeDeploymentTransactionHash||''))throw Error('Invalid local market manifest');
 const code=await rpc('get_transaction',[manifest.codeDeploymentTransactionHash]) as {transaction?:unknown};if(!code?.transaction)throw Error('Code transaction unavailable');
 const codeTx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(code.transaction as never));
 if(codeTx.hash()!==manifest.codeDeploymentTransactionHash)throw Error('Code transaction mismatch');
 await verifyCodeDeployment(rpc,codeTx,fixture.genesis,names.map(n=>fixture.hashes[n]));
 for(let i=0;i<names.length;i++)if(manifest.deps?.[names[i]]?.outPoint?.txHash!==manifest.codeDeploymentTransactionHash||BigInt(manifest.deps[names[i]].outPoint.index)!==BigInt(i)||manifest.deps[names[i]].depType!=='code')throw Error('Code dependency differs from verified deployment');
 const xudt=ccc.CellDep.from(manifest.deps?.xudt),expectedXudt=ccc.CellDep.from(fixture.deps.xudt);
 if(xudt.depType!=='code'||xudt.outPoint.txHash!==expectedXudt.outPoint.txHash||xudt.outPoint.index!==expectedXudt.outPoint.index)throw Error('xUDT dependency differs from fixture');
 const xcell=await rpc('get_live_cell',[{tx_hash:xudt.outPoint.txHash,index:ccc.numToHex(xudt.outPoint.index)},true]) as {status?:string;cell?:{data?:{content?:string}}};
 if(xcell?.status!=='live'||!xcell.cell?.data?.content||ccc.hashCkb(xcell.cell.data.content as ccc.Hex)!==fixture.hashes.xudt)throw Error('xUDT dependency unavailable');
 const row=await rpc('get_transaction',[manifest.initializationTransactionHash]) as {transaction?:unknown;tx_status?:{status?:string;block_hash?:string}};
 if(row?.tx_status?.status!=='committed'||!row.transaction||!row.tx_status.block_hash)throw Error('Initialization not committed');
 const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(row.transaction as never));
 const header=await rpc('get_header',[row.tx_status.block_hash]) as {hash?:string;number?:string};
 if(tx.hash()!==manifest.initializationTransactionHash||!header?.number||header.hash!==row.tx_status.block_hash||await rpc('get_block_hash',[header.number])!==header.hash)throw Error('Initialization is not canonical');
 const scripts=manifest.scripts;
 const expected=deriveMarketIdentity({anchor:fixture.wallets[0].outPoint,genesis:fixture.genesis,base:1000000000n,step:100000000n,supply:2000n,codes:{market:fixture.hashes.market_smt,marker:fixture.hashes.marker_candidate,owner:fixture.hashes.owner_lineage_candidate,custody:fixture.hashes.custody_smt,custodyMarker:fixture.hashes.custody_marker,xudt:fixture.hashes.xudt}});
 for(const name of ['market','marker','owner','token','custody','custodyMarker'] as const)if(ccc.Script.from(scripts[name]).hash()!==expected[name].hash())throw Error('Manifest script identity differs from fixture');
 assertLocalMarketScripts(tx,expected);
 const initial=[0,1,2,3].map(i=>({tx_hash:tx.hash(),index:'0x'+i.toString(16)}));
 return {...manifest,initial,funding:{txHash:tx.hash(),index:'0x4'}};
}
