"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {supportedLock,PUDGE_GENESIS,pudgeRpc,type RpcCell} from './rpc';

type State='disconnected'|'checking'|'ready'|'unsupported'|'error';
type AccountValue={state:State;address:string;owner:string;balance:string;error:string;refresh:()=>Promise<void>};
const AccountContext=createContext<AccountValue>({state:'disconnected',address:'',owner:'',balance:'',error:'',refresh:async()=>{}});

async function readBalance(script:{codeHash:string;hashType:string;args:string}){
  const [nodeTip,indexerTip]=await Promise.all([pudgeRpc<{number:string;hash:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip')]);
  const indexedHeight=BigInt(indexerTip.block_number),nodeHeight=BigInt(nodeTip.number);
  if(indexedHeight<nodeHeight||(indexedHeight===nodeHeight&&indexerTip.block_hash.toLowerCase()!==nodeTip.hash.toLowerCase()))throw Error('Wallet balance index is catching up');
  const lock={code_hash:script.codeHash,hash_type:script.hashType,args:script.args};let cursor:string|undefined,total=0n,pages=0;
  for(;;){
    const params:unknown[]=[{script:lock,script_type:'lock',script_search_mode:'exact',with_data:true},'asc','0x64'];if(cursor)params.push(cursor);
    const page=await pudgeRpc<{objects:RpcCell[];last_cursor?:string}>('get_cells',params);
    if(!Array.isArray(page.objects))throw Error('Wallet balance response is invalid');
    for(const cell of page.objects){if(cell.output?.capacity)total+=BigInt(cell.output.capacity);}
    pages++;if(page.objects.length<100)break;if(!page.last_cursor||page.last_cursor===cursor||pages>=1000)throw Error('Wallet has too many Cells to verify in one refresh');cursor=page.last_cursor;
  }
  const [nodeAfter,indexerAfter,canonicalStartHash]=await Promise.all([pudgeRpc<{number:string;hash:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip'),pudgeRpc<string>('get_block_hash',[nodeTip.number])]);
  const indexerHeightAfter=BigInt(indexerAfter.block_number),nodeHeightAfter=BigInt(nodeAfter.number);
  if(canonicalStartHash.toLowerCase()!==nodeTip.hash.toLowerCase()||indexerHeightAfter<nodeHeightAfter||(indexerHeightAfter===nodeHeightAfter&&indexerAfter.block_hash.toLowerCase()!==nodeAfter.hash.toLowerCase()))throw Error('Chain changed while checking wallet balance');
  return total;
}

export default function AccountProvider({children}:{children:React.ReactNode}){
  const signer=useSigner();
  const [state,setState]=useState<State>('disconnected'),[address,setAddress]=useState(''),[owner,setOwner]=useState(''),[balance,setBalance]=useState(''),[error,setError]=useState('');
  const refresh=useCallback(async()=>{
    if(!signer){setState('disconnected');setAddress('');setOwner('');setBalance('');setError('');return;}
    setState('checking');setError('');
    try{
      if(!await signer.isConnected())throw Error('Wallet connection is unavailable');
      const current=await signer.getRecommendedAddressObj(),script=current.script;
      setAddress(current.toString());setOwner(script.hash());
      const [walletGenesis,rpcGenesis]=await Promise.all([signer.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
      if(walletGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||rpcGenesis.toLowerCase()!==PUDGE_GENESIS)throw Error('Connect a wallet on CKB Pudge');
      if(!supportedLock(script)){setState('unsupported');setBalance('');return;}
      const value=await readBalance(script);setBalance(value.toString());setState('ready');
    }catch(cause){setBalance('');setError(cause instanceof Error?cause.message:'Wallet verification failed');setState('error');}
  },[signer]);
  useEffect(()=>{void refresh();if(!signer)return;const timer=setInterval(()=>void refresh(),30_000);return()=>clearInterval(timer);},[refresh,signer]);
  const value=useMemo(()=>({state,address,owner,balance,error,refresh}),[state,address,owner,balance,error,refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(){return useContext(AccountContext);}
