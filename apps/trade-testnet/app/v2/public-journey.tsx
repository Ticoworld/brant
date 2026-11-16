"use client";
import {useEffect,useState} from "react";
import {loadPudgeManifest,PUDGE_MARKET_KEY} from "../../lib/v2-engine/pudge-manifest.ts";
import {verifyPudgeInitialProof} from "../../lib/v2-engine/pudge-proof-client.ts";
import {discoverCustodyPair,discoverMarketPair} from "../../lib/v2-engine/lineage.ts";
import {readLiveSingletons} from "../../lib/v2-engine/live.ts";
import {validatePublicJourney} from "../../lib/v2-engine/public-journey-validation.ts";

type Snapshot={balance:string;transitions:{hash:string;block:string;op:number}[]};
export default function PublicJourney({ownerHash,activity}:{ownerHash:string;activity:boolean}){
 const [state,setState]=useState<Snapshot|null>(null),[message,setMessage]=useState("Connect a wallet to load verified history.");
 useEffect(()=>{let active=true;setState(null);if(!ownerHash)return;setMessage("Recovering verified Pudge history...");(async()=>{
  const rpc=async(method:string,params:unknown[])=>{const r=await fetch("/api/v2/pudge-rpc",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({method,params})});const b=await r.json();if(!r.ok)throw Error(b.error||"Pudge RPC unavailable");return b.result;};
  const raw=localStorage.getItem(PUDGE_MARKET_KEY);if(!raw)throw Error("No verified market found");const manifest=await loadPudgeManifest(rpc,raw,verifyPudgeInitialProof);
  const response=await fetch("/api/v2/pudge-journey",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({owner:ownerHash,manifest})});if(!response.ok)throw Error("Pudge history unavailable; retry later");const result=await response.json();
  if(result.genesis!==manifest.genesis||!/^(0|[1-9][0-9]*)$/.test(result.balance)||!Array.isArray(result.transitions))throw Error("Invalid recovered history");
  const [market,custody]=await Promise.all([discoverMarketPair(rpc,[manifest.initial[0],manifest.initial[1]]),discoverCustodyPair(rpc,result.tip)]);const live=await readLiveSingletons(rpc,[...market,...custody],manifest.genesis);validatePublicJourney(live,manifest,result.root);if(active){setState(result);setMessage("");}
 })().catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Recovery unavailable");});return()=>{active=false;};},[ownerHash]);
 return <section className="p-6 text-[#e7eee9]"><h1 className="text-xl font-semibold">{activity?"Activity":"Portfolio"}</h1>{!state?<p role="status">{message}</p>:activity?<table className="mt-5 w-full text-left text-sm"><thead><tr><th>Block</th><th>Type</th><th>Transaction</th></tr></thead><tbody>{state.transitions.map(t=><tr key={t.hash}><td>{BigInt(t.block).toString()}</td><td>{t.op===0?"Launch":t.op===1?"Buy":t.op===4?"Sell":"Other"}</td><td className="break-all">{t.hash}</td></tr>)}</tbody></table>:<p className="mt-5">Verified holding: <strong>{state.balance} tokens</strong></p>}</section>;
}
