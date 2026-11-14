// Read-only public RPC check; no wallet or transaction submission.
import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/core';
const rpc=async(method:string,params:unknown[])=>{const response=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok||body.error)throw Error('Pudge RPC failed');return body.result;};
assert.equal(await rpc('get_block_hash',['0x0']),'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
for(const [tx,expected] of [['0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37','0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236'],['0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f','0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95']]){const row=await rpc('get_live_cell',[{tx_hash:tx,index:'0x0'},true]);assert.equal(row.status,'live');assert.equal(row.cell.data.hash,expected);assert.equal(ccc.hashCkb(row.cell.data.content),expected);}
console.log('Pudge genesis, secp and xUDT live dependency checks passed');
