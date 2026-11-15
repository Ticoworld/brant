'use client';
import {useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {prepareCodeDeployment} from '../../../lib/v2-engine/deployment.ts';
import {readFundingCell} from '../../../lib/v2-engine/funding.ts';
import {verifyPudgeWitness} from '../../../lib/pudge-wallet-verify';
import {verifyCodeDeployment} from '../../../lib/v2-engine/deployment-verification.ts';
import {fetchLocalFixtureBootstrap} from '../../../lib/v2-engine/local-fixture.ts';

const pinned:Record<string,string>={custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',market_smt:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',marker_candidate:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',owner_lineage_candidate:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53'};
const publicGenesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
type Signer=ReturnType<typeof useSigner>;
/** Explicit development-only isolated-node test control. Never sends to Pudge. */
export default function LocalCode({signer}:{signer:Signer}){
 const [status,setStatus]=useState('Fixture-only code deployment. Prepare against the disposable local node.'),[review,setReview]=useState<Awaited<ReturnType<typeof prepare>>|null>(null),[submitted,setSubmitted]=useState('');
 const signed=useRef<ccc.Transaction|null>(null),activeSigner=useRef(signer);activeSigner.current=signer;
 const rpc=async(method:string,params:unknown[])=>{const response=await fetch('/api/local-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(!response.ok||body.error)throw Error('Local RPC failed');return body.result;};
 async function prepare(){
  if(!signer)throw Error('Connect disposable signer');
  const initResponse=await fetchLocalFixtureBootstrap();
  let config;
  if(initResponse.ok)config=await initResponse.json();
  else if(initResponse.status===404){const legacy=await fetch('/api/v2-local-bootstrap');if(!legacy.ok)throw Error(`Fixture bootstrap unavailable (${legacy.status})`);config=await legacy.json();}
  else throw Error(`Fixture bootstrap unavailable (${initResponse.status})`);
  if((await rpc('get_blockchain_info',[]) as {chain?:string})?.chain!=='ckb_dev'||!config.genesis||config.genesis===publicGenesis||await rpc('get_block_hash',['0x0'])!==config.genesis)throw Error('Private chain genesis required');
  const owner=(await signer.getRecommendedAddressObj()).script;
  if(initResponse.ok){const candidates=[config.wallets[1],config.wallets[2]].filter(Boolean);const match=candidates.find((wallet:{lock:ccc.ScriptLike})=>ccc.Script.from(wallet.lock).hash().toLowerCase()===owner.hash().toLowerCase());if(!match)throw Error('Connected wallet has no private genesis funding cell');config.codeFunding=match.outPoint;}
  const funding=await readFundingCell(rpc,config.codeFunding,owner.hash());
  const genesis=await rpc('get_block_by_number',['0x0']) as {transactions:{hash:string}[]};
  if(!genesis.transactions?.[1]?.hash)throw Error('Missing local secp dependency');
  const dep={outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup'};
  const depCell=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:dep.outPoint.index},true]) as {status?:string;cell?:{data?:{content?:string}}};
  if(depCell.status!=='live'||!depCell.cell?.data?.content)throw Error('Local secp dependency unavailable');
  const depHash=ccc.hashCkb(depCell.cell.data.content as ccc.Hex);
  const response=await fetch('/api/v2/code'),body=await response.json();if(!response.ok)throw Error('Pinned binaries unavailable');
  const codes=body.codes.map((code:{name:string;data:string})=>({name:code.name,data:code.data,expectedDataHash:pinned[code.name]}));
  if(codes.length!==5||new Set(codes.map((x:{name:string})=>x.name)).size!==5)throw Error('Invalid code set');
  const lock={codeHash:owner.codeHash,hashType:owner.hashType,args:owner.args};
  const result=prepareCodeDeployment(codes,[{...funding,lock}],lock,dep,1000n);
  if(result.status!=='review')throw Error('Insufficient fixture funding');
  return {...result,genesis:config.genesis as string,owner:owner.hash(),funding:config.codeFunding as {txHash:string;index:string},dep:dep.outPoint,depHash,codeHashes:codes.map((x:{expectedDataHash:string})=>x.expectedDataHash)};
 }
 async function fresh(){const active=activeSigner.current;if(!review||!active)throw Error('Prepare local review');if((await rpc('get_blockchain_info',[]) as {chain?:string})?.chain!=='ckb_dev'||await rpc('get_block_hash',['0x0'])!==review.genesis||review.genesis===publicGenesis||(await active.getRecommendedAddressObj()).script.hash()!==review.owner||activeSigner.current!==active)throw Error('Local account or network changed');const cell=await readFundingCell(rpc,review.funding,review.owner);if(cell.capacity!==review.selected[0].capacity)throw Error('Local funding changed');const dep=await rpc('get_live_cell',[{tx_hash:review.dep.txHash,index:review.dep.index},true]) as {status?:string;cell?:{data?:{content?:string}}};if(dep.status!=='live'||!dep.cell?.data?.content||ccc.hashCkb(dep.cell.data.content as ccc.Hex)!==review.depHash||activeSigner.current!==active)throw Error('Local dependency or account changed');}
 async function run(){try{signed.current=null;const next=await prepare();if(localStorage.getItem('roveko-local-code-attempt:'+next.genesis))throw Error('Existing local attempt must be reconciled');setReview(next);setStatus('Local unsigned code deployment prepared.');}catch(e){setStatus(e instanceof Error?e.message:'Preparation failed');}}
 async function sign(){try{await fresh();if(!signer||!review)throw Error('No local review');const candidate=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(review.transaction)));const tx=await signer.signTransaction(candidate);verifyPudgeWitness(tx,review.hash,(await signer.getRecommendedAddressObj()).script.args);await fresh();signed.current=tx;setStatus('Local signature verified; not submitted.');}catch(e){signed.current=null;setStatus(e instanceof Error?e.message:'Signature failed');}}
 async function submit(){try{if(!navigator.locks)throw Error('Exclusive lock unavailable');await navigator.locks.request('roveko-local-code-deployment',{ifAvailable:true},async lock=>{if(!lock)throw Error('Local deployment in progress');await fresh();if(!review||!signed.current||!signer)throw Error('Sign local review first');const key='roveko-local-code-attempt:'+review.genesis;if(localStorage.getItem(key))throw Error('Existing attempt requires reconciliation');verifyPudgeWitness(signed.current,review.hash,(await signer.getRecommendedAddressObj()).script.args);await fresh();localStorage.setItem(key,review.hash);const hash=await rpc('send_transaction',[cccA.JsonRpcTransformers.transactionFrom(signed.current),'passthrough']);signed.current=null;if(hash!==review.hash)throw Error('Unexpected local transaction hash');setSubmitted(review.hash);setStatus('Submitted '+review.hash+'; check committed cells.');});}catch(e){setStatus(e instanceof Error?e.message:'Submission outcome unknown');}}
 async function confirm(){try{if(!review||!submitted)throw Error('No submitted local review');const result=await verifyCodeDeployment(rpc,review.transaction,review.genesis,review.codeHashes);localStorage.setItem('roveko-local-code-confirmed:'+review.genesis,JSON.stringify({genesis:review.genesis,txHash:result.hash,codeHashes:review.codeHashes}));setStatus('Local code cells confirmed '+result.hash);}catch(e){setStatus(e instanceof Error?e.message:'Not confirmed');}}
 if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||process.env.NODE_ENV==='production')return null;
 return <section><h2>Disposable local code deployment</h2><p>Private-node fixture test only. No Pudge transaction is sent.</p><button onClick={run} disabled={!signer}>Prepare local code review</button>{review&&<><p>Size {review.size.toString()} bytes · fee {review.fee.toString()} shannons · code capacity {review.outputCapacity.toString()} shannons · change {review.change.toString()} shannons · hash {review.hash}</p><button onClick={sign}>Sign local code review</button> <button onClick={submit}>Submit local code deployment</button> <button onClick={confirm}>Check local code deployment</button></>}<p role="status">{status}</p></section>;
}
