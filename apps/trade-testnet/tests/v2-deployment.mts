import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/core';
import {prepareCodeDeployment} from '../lib/v2-engine/deployment.ts';
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x'+'11'.repeat(20)};
const cell=(i:number)=>({outPoint:{txHash:'0x'+i.toString(16).padStart(64,'0'),index:'0x0'},capacity:10000000000n,lock,data:'0x'});
const data='0x'+'12'.repeat(60), codes=[{name:'example',data,expectedDataHash:ccc.hashCkb(data)}];
const dep={outPoint:{txHash:'0x'+'aa'.repeat(32),index:'0x0'},depType:'depGroup'};
const result=prepareCodeDeployment(codes,[cell(1),cell(2),cell(3)],lock,dep,1000n);
assert.equal(result.status,'review');
if(result.status==='review'){assert.equal(result.selected.length,2);assert.equal(result.fee,result.transaction.estimateFee(1000n));assert.equal(result.fee,result.size+4n);assert.equal(result.transaction.outputs[0].capacity,12100000000n);assert.equal(result.transaction.outputs[1].capacity,result.change);}
assert.equal(prepareCodeDeployment(codes,[cell(1)],lock,dep,1000n).status,'insufficient');
assert.throws(()=>prepareCodeDeployment([{...codes[0],expectedDataHash:'0x'+'00'.repeat(32)}],[cell(1)],lock,dep,1000n),/mismatch/);
console.log('unsigned code deployment checks passed');
