"use client";

import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useCcc,useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {supportedLock,PUDGE_GENESIS,pudgeRpc,type RpcCell} from './rpc';
import {deriveTradeFunding,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE} from '../../lib/v2-engine/market-capacity.ts';
import {PUDGE_GATE2_ANCHOR} from '../../lib/v2-engine/pudge-public-registry.ts';
import type {FundingHint} from '../../lib/v2-engine/multi-funding.ts';

type State='disconnected'|'connecting'|'connection-timeout'|'connection-rejected'|'checking'|'ready'|'wrong-network'|'unsupported'|'error';
type BalanceState='idle'|'refreshing'|'ready'|'indexer-lag'|'error';
type AccountValue={state:State;balanceState:BalanceState;address:string;owner:string;totalCapacity:string;availableToTrade:string;fundingHint?:FundingHint;hasFundingCell:boolean;error:string;connect:()=>void;refresh:()=>Promise<void>};
const emptyBalance={totalCapacity:'',availableToTrade:'',hasFundingCell:false,fundingHint:undefined as FundingHint|undefined};
const AccountContext=createContext<AccountValue>({state:'disconnected',balanceState:'idle',address:'',owner:'',...emptyBalance,error:'',connect:()=>{},refresh:async()=>{}});
const RESERVED_OUTPOINT=`${PUDGE_GATE2_ANCHOR.txHash.toLowerCase()}:${BigInt(PUDGE_GATE2_ANCHOR.index)}`;
const REFRESH_MS=30_000;
const MAX_INDEXER_LAG=6n;
class IndexerAdvanced extends Error {}

async function readBalance(script:{codeHash:string;hashType:string;args:string}){
  const [nodeTip,indexerTip]=await Promise.all([pudgeRpc<{number:string;hash:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip')]);
  const indexedHeight=BigInt(indexerTip.block_number),nodeHeight=BigInt(nodeTip.number);
  if(indexedHeight>nodeHeight||nodeHeight-indexedHeight>MAX_INDEXER_LAG)throw Error('Wallet balance index is catching up');
  const indexedHash=indexerTip.block_hash.toLowerCase();
  const lock={code_hash:script.codeHash,hash_type:script.hashType,args:script.args};
  const matchesLock=(value:RpcCell['output']['lock'])=>value?.code_hash.toLowerCase()===lock.code_hash.toLowerCase()&&value.hash_type===lock.hash_type&&value.args.toLowerCase()===lock.args.toLowerCase();
  let cursor:string|undefined,total=0n,pages=0;
  let candidate:RpcCell|undefined;
  const seen=new Set<string>();
  for(;;){
    const params:unknown[]=[{script:lock,script_type:'lock',script_search_mode:'exact',with_data:true},'asc','0x64'];if(cursor)params.push(cursor);
    const page=await pudgeRpc<{objects:RpcCell[];last_cursor?:string}>('get_cells',params);
    if(!Array.isArray(page.objects))throw Error('Wallet balance response is invalid');
    for(const cell of page.objects){
      const point=`${cell.out_point.tx_hash.toLowerCase()}:${BigInt(cell.out_point.index)}`;
      if(seen.has(point)||!matchesLock(cell.output?.lock)||!/^0x[0-9a-f]+$/i.test(cell.output.capacity))throw Error('Wallet balance response is inconsistent');
      seen.add(point);
      const capacity=BigInt(cell.output.capacity);total+=capacity;
      if(!cell.output.type&&cell.output_data==='0x'&&point!==RESERVED_OUTPOINT&&(!candidate||BigInt(candidate.output.capacity)<capacity))candidate=cell;
    }
    pages++;if(page.objects.length<100)break;if(!page.last_cursor||page.last_cursor===cursor||pages>=1000)throw Error('Wallet has too many Cells to verify in one refresh');cursor=page.last_cursor;
  }
  const proposal=candidate;
  const live=proposal?await pudgeRpc<{status:string;cell?:{output:RpcCell['output'];data:{content:string}}}>('get_live_cell',[proposal.out_point,true]):null;
  const [nodeAfter,indexerAfter,anchor]=await Promise.all([pudgeRpc<{number:string}>('get_tip_header'),pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip'),pudgeRpc<string|null>('get_block_hash',[indexerTip.block_number])]);
  const nodeHeightAfter=BigInt(nodeAfter.number);
  if(anchor?.toLowerCase()!==indexedHash||nodeHeightAfter<indexedHeight||nodeHeightAfter-indexedHeight>MAX_INDEXER_LAG)throw Error('Wallet balance index is catching up');
  if(BigInt(indexerAfter.block_number)>indexedHeight)throw new IndexerAdvanced('Wallet balance index advanced during refresh');
  if(BigInt(indexerAfter.block_number)!==indexedHeight||indexerAfter.block_hash.toLowerCase()!==indexedHash)throw Error('Wallet balance index changed during refresh');
  if(proposal&&(live?.status!=='live'||!live.cell||!matchesLock(live.cell.output.lock)||live.cell.output.type||live.cell.data.content!=='0x'||BigInt(live.cell.output.capacity)!==BigInt(proposal.output.capacity)))throw Error('Wallet funding Cell changed during balance refresh');
  const funding=deriveTradeFunding(proposal?BigInt(proposal.output.capacity):0n,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE);
  return {totalCapacity:total.toString(),availableToTrade:funding.availableToTrade.toString(),hasFundingCell:funding.hasFundingCell,fundingHint:proposal?{txHash:proposal.out_point.tx_hash,index:proposal.out_point.index,owner:ccc.Script.from(script as ccc.ScriptLike).hash(),genesis:PUDGE_GENESIS}:undefined};
}

export default function AccountProvider({children}:{children:React.ReactNode}){
  const signer=useSigner(),{client,isOpen,open}=useCcc();
  const [identity,setIdentity]=useState<{state:State;address:string;owner:string;error:string}>({state:'disconnected',address:'',owner:'',error:''});
  const [balance,setBalance]=useState({...emptyBalance,state:'idle' as BalanceState,error:''});
  const requestRefresh=useRef<()=>Promise<void>>(async()=>{});
  const inFlight=useRef<Promise<void>|undefined>(undefined);
  const connectionTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const requested=useRef(false),opened=useRef(false);
  const finishConnection=useCallback(()=>{
    requested.current=false;
    opened.current=false;
    clearTimeout(connectionTimer.current);
  },[]);
  const refresh=useCallback(()=>requestRefresh.current(),[]);
  const connect=useCallback(()=>{
    if(signer){open();return;}
    if(requested.current||isOpen)return;
    requested.current=true;
    setIdentity({state:'connecting',address:'',owner:'',error:''});
    try{
      open();
      connectionTimer.current=setTimeout(()=>{
        finishConnection();
        setIdentity({state:'connection-timeout',address:'',owner:'',error:''});
      },REFRESH_MS);
    }catch{
      finishConnection();
      setIdentity({state:'connection-rejected',address:'',owner:'',error:''});
    }
  },[signer,isOpen,open,finishConnection]);
  useEffect(()=>{
    if(!requested.current)return;
    if(isOpen){opened.current=true;return;}
    if(opened.current&&!signer){
      finishConnection();
      setIdentity({state:'connection-rejected',address:'',owner:'',error:''});
    }
  },[isOpen,signer,finishConnection]);
  useEffect(()=>()=>clearTimeout(connectionTimer.current),[]);

  useLayoutEffect(()=>{
    let current=true,lastFinished=0,queued:Promise<void>|undefined;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let verifiedOwner='';
    setBalance({...emptyBalance,state:'idle',error:''});
    if(!signer){
      if(!requested.current)setIdentity({state:'disconnected',address:'',owner:'',error:''});
      requestRefresh.current=async()=>{};
      return;
    }
    finishConnection();
    setIdentity({state:'checking',address:'',owner:'',error:''});
    const update=async()=>{
      if(!current||document.hidden)return;
      setBalance(previous=>({...previous,state:'refreshing',error:''}));
      try{
        if(!await signer.isConnected()){
          if(current)setIdentity({state:'disconnected',address:'',owner:'',error:''});
          verifiedOwner='';
          if(current)setBalance({...emptyBalance,state:'idle',error:''});
          return;
        }
        const [account,genesis,rpcGenesis]=await Promise.all([
          signer.getRecommendedAddressObj(),signer.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0']),
        ]);
        if(!current)return;
        const script=account.script,owner=script.hash(),address=account.toString();
        const state=genesis?.hash?.toLowerCase()!==PUDGE_GENESIS||rpcGenesis?.toLowerCase()!==PUDGE_GENESIS
          ?'wrong-network':supportedLock(script)?'ready':'unsupported';
        if(verifiedOwner!==owner)setBalance({...emptyBalance,state:'refreshing',error:''});
        verifiedOwner=state==='ready'?owner:'';
        setIdentity({state,address,owner:verifiedOwner,error:''});
        if(state!=='ready'){
          setBalance({...emptyBalance,state:'idle',error:''});
          return;
        }
        const result=await readBalance(script).catch(error=>{
          if(error instanceof IndexerAdvanced&&current&&!document.hidden)return readBalance(script);
          throw error;
        });
        if(!current)return;
        const [connected,latest]=await Promise.all([signer.isConnected(),signer.getRecommendedAddressObj()]);
        if(!current)return;
        if(!connected||latest.script.hash()!==owner){
          verifiedOwner='';
          setIdentity({state:connected?'checking':'disconnected',address:'',owner:'',error:''});
          setBalance({...emptyBalance,state:'idle',error:''});
          return;
        }
        setBalance({...result,state:'ready',error:''});
      }catch(cause){
        if(!current)return;
        const error=cause instanceof Error?cause.message:'Wallet verification failed';
        if(!verifiedOwner)setIdentity({state:'error',address:'',owner:'',error});
        setBalance(previous=>({...previous,state:/index/i.test(error)?'indexer-lag':'error',error}));
      }
    };
    const run=()=>{
      if(document.hidden)return Promise.resolve();
      if(queued)return queued;
      clearTimeout(timer);
      const previous=inFlight.current;
      const pending=Promise.resolve(previous).then(update).finally(()=>{
        lastFinished=Date.now();
        if(inFlight.current===pending)inFlight.current=undefined;
        queued=undefined;
        if(current&&!document.hidden)timer=setTimeout(run,REFRESH_MS);
      });
      queued=pending;
      inFlight.current=pending;
      return pending;
    };
    requestRefresh.current=run;
    const refreshIfStale=()=>{
      clearTimeout(timer);
      if(document.hidden||queued)return;
      const remaining=REFRESH_MS-(Date.now()-lastFinished);
      if(remaining<=0)void run();
      else timer=setTimeout(run,remaining);
    };
    void run();
    document.addEventListener('visibilitychange',refreshIfStale);
    return ()=>{
      current=false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange',refreshIfStale);
    };
  },[signer,client,finishConnection]);
  const value=useMemo(()=>({
    ...identity,availableToTrade:balance.availableToTrade,totalCapacity:balance.totalCapacity,
    fundingHint:balance.state==='error'||balance.state==='indexer-lag'?undefined:balance.fundingHint,
    hasFundingCell:balance.hasFundingCell,balanceState:balance.state,error:identity.error||balance.error,connect,refresh,
  }),[identity,balance,connect,refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(){return useContext(AccountContext);}
