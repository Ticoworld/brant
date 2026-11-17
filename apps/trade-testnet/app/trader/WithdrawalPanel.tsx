"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {toast} from 'sonner';
import {prepareWithdrawal} from '../../lib/v2-engine/withdrawal-review.ts';
import {verifyInitializationSignature} from '../../lib/v2-engine/initialization-signature.ts';
import type {MarketData} from './types';
import {pudgeRpc} from './rpc';
import {useAccount} from './account-provider';
import {useLocale} from '../i18n-provider';
import {copy} from './copy';

const JOURNAL='roveko-pudge-withdrawal-v1';
type Review=Awaited<ReturnType<typeof prepareWithdrawal>>&{inputs:[any,any,any]};
type Attempt={version:1;genesis:string;owner:string;txHash:string;quantity:string;transaction:unknown};
const clone=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));
const key=(genesis:string,owner:string)=>`${JOURNAL}:${genesis.toLowerCase()}:${owner.toLowerCase()}`;

export default function WithdrawalPanel({market,owner,balance,onConfirmed}:{market:MarketData;owner:string;balance:bigint;onConfirmed:()=>Promise<void>}){
  const signer=useSigner(),account=useAccount(),{locale}=useLocale();
  const [quantity,setQuantity]=useState(''),[review,setReview]=useState<Review|null>(null),[attemptRaw,setAttemptRaw]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const active=useRef(signer),working=useRef(false),onConfirmedRef=useRef(onConfirmed);active.current=signer;onConfirmedRef.current=onConfirmed;
  const journalKey=owner?key(market.genesis,owner):'';
  const label=(en:string,zh:string)=>locale==='zh-CN'?zh:en;

  const reconcile=useCallback(async(silent=false)=>{
    if(!journalKey)return;
    const raw=localStorage.getItem(journalKey);if(!raw){setAttemptRaw('');return;}
    setAttemptRaw(raw);
    try{
      const record=JSON.parse(raw) as Attempt;
      if(record.version!==1||record.genesis.toLowerCase()!==market.genesis.toLowerCase()||record.owner.toLowerCase()!==owner.toLowerCase()||!/^0x[0-9a-f]{64}$/i.test(record.txHash))throw Error('Withdrawal record identity mismatch');
      const row=await pudgeRpc<any>('get_transaction',[record.txHash]);
      if(row?.tx_status?.status==='rejected'){
        localStorage.removeItem(journalKey);setAttemptRaw('');setMessage(label('Withdrawal was rejected. Prepare a new review before retrying.','提取交易已被拒绝。重试前请重新准备审查。'));return;
      }
      if(row?.tx_status?.status!=='committed'||!row.tx_status.block_hash||!row.transaction)throw Error('Withdrawal is not confirmed yet');
      const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(row.transaction));
      if(tx.hash().toLowerCase()!==record.txHash.toLowerCase()||tx.inputs.length!==3||tx.outputs.length!==4||tx.witnesses.length!==4)throw Error('Confirmed withdrawal differs from its review');
      const expected=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(record.transaction as never)));
      if(tx.outputs.some((output,index)=>output.capacity!==expected.outputs[index].capacity||output.lock.hash()!==expected.outputs[index].lock.hash()||output.type?.hash()!==expected.outputs[index].type?.hash())||tx.outputsData.some((data,index)=>data.toLowerCase()!==expected.outputsData[index].toLowerCase())||tx.witnesses[3].toLowerCase()!==expected.witnesses[3].toLowerCase())throw Error('Confirmed withdrawal terms differ from the reviewed transaction');
      const token=ccc.Script.from(market.manifest.scripts.token).hash().toLowerCase(),destination=tx.outputs[2];
      if(destination.lock.hash().toLowerCase()!==owner.toLowerCase()||destination.type?.hash().toLowerCase()!==token||tx.outputsData[2].toLowerCase()!==`0x${BigInt(record.quantity).toString(16).padStart(32,'0').match(/../g)!.reverse().join('')}`.toLowerCase())throw Error('Confirmed xUDT withdrawal output mismatch');
      const header=await pudgeRpc<any>('get_header',[row.tx_status.block_hash]);
      if(header?.hash?.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||!header.number||(await pudgeRpc<string>('get_block_hash',[header.number])).toLowerCase()!==row.tx_status.block_hash.toLowerCase())throw Error('Withdrawal block is not canonical');
      if(localStorage.getItem(journalKey)!==raw)throw Error('Withdrawal record changed during reconciliation');
      localStorage.removeItem(journalKey);setAttemptRaw('');setReview(null);setMessage(label('External xUDT withdrawal confirmed.','外部 xUDT 提取已确认。'));
      if(!silent)toast.success(label('Withdrawal confirmed','提取已确认'),{description:record.txHash});
      await onConfirmedRef.current();
    }catch(error){
      if(!silent)setMessage(error instanceof Error?error.message:label('Withdrawal is still awaiting confirmation.','提取仍在等待确认。'));
    }
  },[journalKey,market.genesis,market.manifest.scripts.token,owner]);

  useEffect(()=>{
    if(!journalKey)return;
    const raw=localStorage.getItem(journalKey);setAttemptRaw(raw||'');
    if(raw)void reconcile(true);
  },[journalKey,reconcile]);
  useEffect(()=>{if(!attemptRaw)return;const timer=window.setInterval(()=>void reconcile(true),8000);return()=>window.clearInterval(timer);},[attemptRaw,reconcile]);

  const prepare=async()=>{
    if(!/^[1-9][0-9]*$/.test(quantity)||BigInt(quantity)>balance)throw Error('Enter an available whole-token amount');
    const current=active.current;if(!current||!await current.isConnected()||account.state!=='ready'||account.owner.toLowerCase()!==owner.toLowerCase())throw Error('Connect and verify the Pudge wallet');
    const [walletGenesis,rpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
    if(walletGenesis?.hash?.toLowerCase()!==market.genesis.toLowerCase()||rpcGenesis.toLowerCase()!==market.genesis.toLowerCase())throw Error('Wallet network changed');
    const result=await prepareWithdrawal((method,params)=>pudgeRpc(method,params),market.manifest,owner,BigInt(quantity)) as Review;
    if(result.quantity!==BigInt(quantity))throw Error('Withdrawal amount changed during preparation');
    setReview(result);setMessage('');
    return result;
  };

  const submit=async()=>{
    if(working.current)return;working.current=true;setBusy(true);
    const toastId=toast.loading(label('Preparing withdrawal review','正在准备提取审查'));
    try{
      if(!navigator.locks)throw Error('Exclusive withdrawal lock unavailable');
      await navigator.locks.request(`roveko-withdrawal-${owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock)throw Error('Another withdrawal is in progress');
        if(localStorage.getItem(journalKey))throw Error('A previous withdrawal requires reconciliation');
        let prepared=review;if(!prepared){prepared=await prepare();toast.success(label('Review ready','审查已准备'),{id:toastId,description:label('Check the amount, fee and capacity before approving.','批准前请检查数量、手续费和容量。')});return;}
        const current=active.current;if(!current||current!==signer||!await current.isConnected())throw Error('Wallet changed before approval');
        await validateFresh(prepared,current);
        toast.loading(label('Approve in UTXO Global','在 UTXO Global 中批准'),{id:toastId});
        const signed=await current.signTransaction(clone(prepared.transaction));
        verifyInitializationSignature(prepared.transaction,signed,prepared.inputs.map(cell=>({lock:cell.lock})),2,owner);
        await validateFresh(prepared,current);
        const record:Attempt={version:1,genesis:market.genesis,owner,txHash:signed.hash(),quantity:prepared.quantity.toString(),transaction:cccA.JsonRpcTransformers.transactionFrom(signed)};
        const raw=JSON.stringify(record);localStorage.setItem(journalKey,raw);setAttemptRaw(raw);setReview(null);
        toast.loading(label('Broadcasting approved withdrawal','正在广播已批准的提取交易'),{id:toastId});
        const submitted=await current.client.sendTransaction(signed);
        if(submitted.toLowerCase()!==record.txHash.toLowerCase())throw Error('Wallet returned a different transaction hash; reconcile before retrying');
        toast.success(label('Withdrawal submitted','提取交易已提交'),{id:toastId,description:record.txHash});
        setMessage(label('Waiting for Pudge confirmation.','正在等待 Pudge 确认。'));
        await reconcile(true);
      });
    }catch(error){
      const text=error instanceof Error?error.message:label('Withdrawal failed.','提取失败。');setMessage(text);toast.error(label('Withdrawal not completed','提取未完成'),{id:toastId,description:text});
    }finally{working.current=false;setBusy(false);}
  };

  const canPrepare=signer&&account.state==='ready'&&account.owner.toLowerCase()===owner.toLowerCase()&&!attemptRaw&&!busy;
  return <section className="space-y-3 border-t border-[#28302f] pt-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-sm font-semibold">{copy(locale,'withdraw')}</h2><p className="mb-0 mt-1 text-[11px] text-[#87938e]">{balance.toString()} xUDT</p></div><span className="text-[10px] text-[#83908a]">{label('External wallet output','外部钱包输出')}</span></div>
    <div className="grid gap-3 sm:grid-cols-[minmax(180px,260px)_1fr] sm:items-end"><label htmlFor="withdraw-quantity" className="text-[11px] text-[#9ba6a2]">{copy(locale,'quantity')}<input id="withdraw-quantity" inputMode="numeric" value={quantity} onChange={event=>{setQuantity(event.target.value.replace(/[^0-9]/g,''));setReview(null);}} className="mt-1 min-h-10 w-full rounded-[3px] border border-[#303a37] bg-[#111615] px-3 text-sm tabular-nums text-[#e6ece9] outline-none focus:border-[#6d9583]" /></label>
      <div className="flex flex-wrap gap-2">{[25,50,75,100].map(percent=><button key={percent} type="button" disabled={!canPrepare} onClick={()=>{setQuantity(((balance*BigInt(percent))/100n).toString());setReview(null);}} className="min-h-8 rounded-[3px] border border-[#38433f] px-2 text-[10px] text-[#b9c4c0] disabled:opacity-40">{percent}%</button>)}</div></div>
    {review&&<dl className="grid gap-2 border-y border-[#28302f] py-3 text-[11px] sm:grid-cols-3"><div><dt className="text-[#87938e]">{copy(locale,'amount')}</dt><dd className="m-0 mt-1 text-[#dce5e1]">{review.quantity.toString()} xUDT</dd></div><div><dt className="text-[#87938e]">{copy(locale,'fee')}</dt><dd className="m-0 mt-1 text-[#dce5e1]">{review.fee.toString()} shannons</dd></div><div><dt className="text-[#87938e]">{label('Token Cell capacity','代币 Cell 容量')}</dt><dd className="m-0 mt-1 text-[#dce5e1]">{review.tokenCapacity.toString()} shannons</dd></div></dl>}
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!canPrepare||!quantity||BigInt(quantity)>balance} onClick={()=>void submit()} className="min-h-10 rounded-[3px] bg-[#72dfb0] px-4 text-xs font-semibold text-[#0a1710] disabled:cursor-not-allowed disabled:opacity-40">{busy?copy(locale,'reviewing'):attemptRaw?copy(locale,'pending'):review?label('Approve and withdraw','批准并提取'):copy(locale,'withdraw')}</button>{attemptRaw&&<button type="button" onClick={()=>void reconcile()} className="min-h-8 rounded-[3px] border border-[#76613b] px-3 text-[11px] text-[#e8d8b6]">{copy(locale,'reconcile')}</button>}</div>
    {message&&<p role="status" className="m-0 break-words text-[11px] text-[#aeb9b4]">{message}</p>}
  </section>;

  async function validateFresh(prepared:Review,current:NonNullable<typeof signer>){
    const [walletGenesis,rpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
    if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase()||walletGenesis?.hash?.toLowerCase()!==market.genesis.toLowerCase()||rpcGenesis.toLowerCase()!==market.genesis.toLowerCase())throw Error('Wallet or Pudge network changed');
    for(let index=0;index<prepared.inputs.length;index++){
      const expected=prepared.inputs[index],input=prepared.transaction.inputs[index];
      const row=await pudgeRpc<any>('get_live_cell',[{tx_hash:input.previousOutput.txHash,index:ccc.numToHex(input.previousOutput.index)},true]);
      const script=(value:any)=>value?ccc.Script.from({codeHash:value.code_hash,hashType:value.hash_type,args:value.args}).hash().toLowerCase():'';
      if(row?.status!=='live'||!row.cell||BigInt(row.cell.output.capacity)!==expected.capacity||row.cell.data.content.toLowerCase()!==expected.data.toLowerCase()||script(row.cell.output.lock)!==ccc.Script.from(expected.lock).hash().toLowerCase()||script(row.cell.output.type)!==(expected.type?ccc.Script.from(expected.type).hash().toLowerCase():''))throw Error('A reviewed withdrawal input changed; prepare again');
    }
    for(const [name,expected] of [['custody_smt','0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000'],['custody_marker','0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc'],['xudt','0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95']] as const){
      const dep=ccc.CellDep.from(market.manifest.deps[name]);
      const row=await pudgeRpc<any>('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]);
      if(dep.depType!=='code'||row?.status!=='live'||!row.cell||ccc.hashCkb(row.cell.data.content).toLowerCase()!==expected)throw Error(`Unverified ${name} dependency`);
    }
    if(prepared.inputs[0].data.slice(34).toLowerCase()!==prepared.custodyRoot.slice(2).toLowerCase())throw Error('Custody root changed; prepare again');
  }
}
