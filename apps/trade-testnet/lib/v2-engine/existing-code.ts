import {ccc} from '@ckb-ccc/core';
import type {FundingCandidate} from './multi-funding.ts';

/** Discover exact pinned code data under the connected owner's lock. Results
 * are recovery hints and must be checked against canonical transactions. */
export function findExistingOwnerCode(cells:FundingCandidate[],ownerHash:string,expectedHashes:string[]){
 if(!/^0x[0-9a-f]{64}$/i.test(ownerHash)||!expectedHashes.length||expectedHashes.some(h=>!/^0x[0-9a-f]{64}$/i.test(h))||new Set(expectedHashes.map(h=>h.toLowerCase())).size!==expectedHashes.length)throw Error('Invalid code discovery request');
 const expected=new Set(expectedHashes.map(h=>h.toLowerCase()));
 return cells.flatMap(cell=>{
  if(cell.type||cell.data==='0x'||ccc.Script.from(cell.lock).hash().toLowerCase()!==ownerHash.toLowerCase())return [];
  if(!/^0x(?:[0-9a-f]{2})+$/i.test(cell.data))throw Error('Invalid cell data');
  const dataHash=ccc.hashCkb(cell.data).toLowerCase();
  return expected.has(dataHash)?[{outPoint:cell.outPoint,dataHash}]:[];
 });
}
