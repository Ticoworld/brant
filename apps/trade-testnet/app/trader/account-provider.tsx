"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useCcc,useSigner} from '@ckb-ccc/connector-react';
import {supportedLock,PUDGE_GENESIS,pudgeRpc,type RpcCell} from './rpc';
import {deriveTradeFunding,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE} from '../../lib/v2-engine/market-capacity.ts';
import {PUDGE_GATE2_ANCHOR} from '../../lib/v2-engine/pudge-public-registry.ts';

type State='disconnected'|'connecting'|'connection-timeout'|'connection-rejected'|'checking'|'ready'|'wrong-network'|'unsupported'|'indexer-lag'|'error';
type AccountValue={state:State;address:string;owner:string;totalCapacity:string;availableToTrade:string;hasFundingCell:boolean;error:string;connect:()=>void;refresh:()=>Promise<void>};
const AccountContext=createContext<AccountValue>({state:'disconnected',address:'',owner:'',totalCapacity:'',availableToTrade:'',hasFundingCell:false,error:'',connect:()=>{},refresh:async()=>{}});
const RESERVED_OUTPOINT=`${PUDGE_GATE2_ANCHOR.txHash.toLowerCase()}:${BigInt(PUDGE_GATE2_ANCHOR.index)}`;

async function readBalance(script:{codeHash:string;hashType:string;args:string}){
  const [nodeTip,indexerTip]=await Promise.all([pudgeRpc<{number:string;hash:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip')]);
  const indexedHeight=BigInt(indexerTip.block_number),nodeHeight=BigInt(nodeTip.number);
  if(indexedHeight<nodeHeight||(indexedHeight===nodeHeight&&indexerTip.block_hash.toLowerCase()!==nodeTip.hash.toLowerCase()))throw Error('Wallet balance index is catching up');
  const lock={code_hash:script.codeHash,hash_type:script.hashType,args:script.args};let cursor:string|undefined,total=0n,maxTradeCell=0n,pages=0;
  for(;;){
    const params:unknown[]=[{script:lock,script_type:'lock',script_search_mode:'exact',with_data:true},'asc','0x64'];if(cursor)params.push(cursor);
    const page=await pudgeRpc<{objects:RpcCell[];last_cursor?:string}>('get_cells',params);
    if(!Array.isArray(page.objects))throw Error('Wallet balance response is invalid');
    for(const cell of page.objects){
      if(!cell.output?.capacity)continue;
      const capacity=BigInt(cell.output.capacity);total+=capacity;
      const point=`${cell.out_point.tx_hash.toLowerCase()}:${BigInt(cell.out_point.index)}`;
      if(!cell.output.type&&typeof cell.output_data==='string'&&cell.output_data.toLowerCase()==='0x'&&point!==RESERVED_OUTPOINT)maxTradeCell=maxTradeCell>capacity?maxTradeCell:capacity;
    }
    pages++;if(page.objects.length<100)break;if(!page.last_cursor||page.last_cursor===cursor||pages>=1000)throw Error('Wallet has too many Cells to verify in one refresh');cursor=page.last_cursor;
  }
  const [nodeAfter,indexerAfter,canonicalStartHash]=await Promise.all([pudgeRpc<{number:string;hash:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip'),pudgeRpc<string>('get_block_hash',[nodeTip.number])]);
  const indexerHeightAfter=BigInt(indexerAfter.block_number),nodeHeightAfter=BigInt(nodeAfter.number);
  if(canonicalStartHash.toLowerCase()!==nodeTip.hash.toLowerCase()||indexerHeightAfter<nodeHeightAfter||(indexerHeightAfter===nodeHeightAfter&&indexerAfter.block_hash.toLowerCase()!==nodeAfter.hash.toLowerCase()))throw Error('Chain changed while checking wallet balance');
  const funding=deriveTradeFunding(maxTradeCell,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE);
  return {totalCapacity:total.toString(),availableToTrade:funding.availableToTrade.toString(),hasFundingCell:funding.hasFundingCell};
}

export default function AccountProvider({children}:{children:React.ReactNode}){
  const signer=useSigner(),connector=useCcc(),activeSigner=useRef(signer),connectionSigner=useRef(signer),connectionRequested=useRef(false),connectionTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);activeSigner.current=signer;
  const [state,setState]=useState<State>('disconnected'),[address,setAddress]=useState(''),[owner,setOwner]=useState(''),[totalCapacity,setTotalCapacity]=useState(''),[availableToTrade,setAvailableToTrade]=useState(''),[hasFundingCell,setHasFundingCell]=useState(false),[error,setError]=useState('');
  const connect=useCallback(()=>{
    if(connectionTimer.current)clearTimeout(connectionTimer.current);
    connectionRequested.current=true;connectionSigner.current=activeSigner.current;setError('');setState('connecting');
    try{
      connector.open();
      connectionTimer.current=setTimeout(()=>{if(connectionRequested.current){connectionRequested.current=false;setState('connection-timeout');setError('Wallet connection was not completed.');}},30_000);
    }catch(cause){connectionRequested.current=false;setState('connection-timeout');setError(cause instanceof Error?cause.message:'Wallet connection could not be opened');}
  },[connector]);
  const refresh=useCallback(async()=>{
    if(!signer){if(connectionRequested.current)return;setState('disconnected');setAddress('');setOwner('');setTotalCapacity('');setAvailableToTrade('');setHasFundingCell(false);setError('');return;}
    const connectionPending=connectionRequested.current;
    connectionRequested.current=false;
    if(connectionTimer.current){clearTimeout(connectionTimer.current);connectionTimer.current=undefined;}
    setState('checking');setError('');
    try{
      if(!await signer.isConnected())throw Error('Wallet connection is unavailable');
      const current=await signer.getRecommendedAddressObj(),script=current.script;
      setAddress(current.toString());setOwner(script.hash());
      const [walletGenesis,rpcGenesis]=await Promise.all([signer.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
      if(walletGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||rpcGenesis.toLowerCase()!==PUDGE_GENESIS){setState('wrong-network');setTotalCapacity('');setAvailableToTrade('');setHasFundingCell(false);return;}
      if(!supportedLock(script)){setState('unsupported');setTotalCapacity('');setAvailableToTrade('');setHasFundingCell(false);return;}
      const result=await readBalance(script);setTotalCapacity(result.totalCapacity);setAvailableToTrade(result.availableToTrade);setHasFundingCell(result.hasFundingCell);setState('ready');
    }catch(cause){
      const message=cause instanceof Error?cause.message:'Wallet verification failed';
      setTotalCapacity('');setAvailableToTrade('');setHasFundingCell(false);setError(message);
      if(/catching up|indexer/i.test(message))setState('indexer-lag');
      else if(connectionPending&&/connection is unavailable|not connected|reject|denied|cancel/i.test(message)){setAddress('');setOwner('');setState('connection-rejected');}
      else if(/connection is unavailable|not connected/i.test(message)){setAddress('');setOwner('');setState('disconnected');}
      else setState('error');
    }
  },[signer]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30_000);return()=>{clearInterval(timer);if(connectionTimer.current)clearTimeout(connectionTimer.current);};},[refresh]);
  useEffect(()=>{
    if(!connectionRequested.current||connector.isOpen)return;
    if(signer&&signer!==connectionSigner.current)return;
    if(signer){void refresh();return;}
    connectionRequested.current=false;if(connectionTimer.current){clearTimeout(connectionTimer.current);connectionTimer.current=undefined;}setState('connection-rejected');setError('');
  },[connector.isOpen,refresh,signer]);
  const value=useMemo(()=>({state,address,owner,totalCapacity,availableToTrade,hasFundingCell,error,connect,refresh}),[state,address,owner,totalCapacity,availableToTrade,hasFundingCell,error,connect,refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(){return useContext(AccountContext);}
