import {ccc} from '@ckb-ccc/core';
import {prepareCodeDeployment, type DeploymentCode} from './deployment.ts';
import type {FundingCandidate} from './multi-funding.ts';

const UNIT=100_000_000n;
const key=(c:FundingCandidate)=>`${c.outPoint.txHash.toLowerCase()}:${BigInt(c.outPoint.index)}`;

/** Choose a distinct, wallet-owned issuance anchor and reserve it from the
 * code transaction. The selected anchor is an input to identity derivation;
 * callers must persist and revalidate it against the canonical chain. */
export function planOwnerDeployment(codes:DeploymentCode[],cells:FundingCandidate[],owner:FundingCandidate['lock'],dep:ccc.CellDepLike,feeRate:bigint,protectedOutpoints:string[]=[]){
 const ownerHash=ccc.Script.from(owner).hash().toLowerCase();
 const reserved=new Set(protectedOutpoints.map(p=>{const m=/^(0x[0-9a-f]{64}):(0x[0-9a-f]+|[0-9]+)$/i.exec(p);if(!m)throw Error('Invalid protected outpoint');return `${m[1].toLowerCase()}:${BigInt(m[2])}`;}));
 // Issuance needs 600 CKB of outputs, a 200 CKB lineage input, a
 // minimum 61 CKB change cell and the builder's maximum allowed fee.
 const minimumAnchor=461n*UNIT+1_000_000n;
 // Setup funds a 200 CKB lineage output, a 2000 CKB buyer output,
 // a 61 CKB change cell and the builder's maximum allowed fee.
 const minimumSetup=2261n*UNIT+1_000_000n;
 const candidates=cells.filter(c=>!c.type&&c.data==='0x'&&c.capacity>=minimumAnchor&&!reserved.has(key(c))&&ccc.Script.from(c.lock).hash().toLowerCase()===ownerHash)
  .sort((a,b)=>a.capacity===b.capacity?key(a).localeCompare(key(b)):a.capacity<b.capacity?-1:1);
 for(const anchor of candidates){
  const result=prepareCodeDeployment(codes,cells,owner,dep,feeRate,[...protectedOutpoints,`${anchor.outPoint.txHash}:${anchor.outPoint.index}`]);
  if(result.status==='review'){
   const spent=new Set(result.selected.map(key));
   const remaining=cells.filter(c=>!spent.has(key(c))&&key(c)!==key(anchor)&&!reserved.has(key(c))&&!c.type&&c.data==='0x'&&ccc.Script.from(c.lock).hash().toLowerCase()===ownerHash).reduce((sum,c)=>sum+c.capacity,0n);
   if(result.change+remaining>=minimumSetup)return {anchor,code:result,minimumAnchor,minimumSetup};
  }
 }
 throw Error('No distinct owner anchor and deployment funding leave enough setup capacity; a confirmed preparatory split or additional funding is required');
}
