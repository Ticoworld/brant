// Read-only deployment review. Never creates, signs, or broadcasts transactions.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ccc } from '@ckb-ccc/core';
const binaries = process.argv[2];
if (!binaries) throw Error('Usage: node deploy/v2-review.mjs <pinned-elf-directory>');
const expected = {
  custody_smt: '7db957901242d6c9243f585b393c55d42faad3c7ddd16f1672c1a19ad14d4601',
  market_smt: 'b33d7396778340c3d6e66c62897a1dbd1561b32848715106a94d8a077bb7cd1f',
  custody_marker: 'cca4552516f372d97377b4e27ebffe1655d4bdeea3535544f36da44ff15aba07',
  marker_candidate: '5941ccbc5ebd47e59811c4c8d8c8ae8d8f19431770fe771cf12b0e88d7bb5f4f',
  owner_lineage_candidate: '661820b1d9ce5b384762e5e67389335c04bb2c34aac7bbcb7cb684e9ea13671b',
};
const codes = [];
for (const [name, sha256] of Object.entries(expected)) {
  const data = await readFile(path.join(binaries,name));
  if (createHash('sha256').update(data).digest('hex') !== sha256) throw Error(`${name}: binary hash differs from Gate 2 manifest`);
  codes.push({name,bytes:data.length,sha256,dataHash:ccc.hashCkb(ccc.hexFrom(data)),occupiedCkbWithStandardSecpLock:data.length+61});
}
const rpc = async (method,params) => {
  const r = await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  if (!r.ok) throw Error(`RPC HTTP ${r.status}`);
  const v = await r.json(); if (v.error) throw Error(JSON.stringify(v.error)); return v.result;
};
const genesis = await rpc('get_block_hash',['0x0']);
if (genesis !== '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606') throw Error('Wrong genesis');
const secp = {tx_hash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'};
const dep = await rpc('get_live_cell',[secp,true]);
if (dep?.status !== 'live' || dep.cell?.data?.hash !== '0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236') throw Error('Expected Pudge secp dep group unavailable or changed');
// Official RFC 0052 Pudge deployment, checked live and against the Gate 2 fixture hash.
const xudt = {tx_hash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:'0x0'};
const xudtCell = await rpc('get_live_cell',[xudt,true]);
const xudtHash = '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95';
if (xudtCell?.status !== 'live' || xudtCell.cell?.data?.hash !== xudtHash || ccc.hashCkb(xudtCell.cell.data.content) !== xudtHash) throw Error('Official xUDT cell missing or byte hash mismatch');
console.log(JSON.stringify({status:'BLOCKED_NO_DEPLOYMENT',network:'pudge',genesis,secpDepGroup:secp,xudt:{outPoint:xudt,dataHash:xudtHash,hashType:'data1',depType:'code',output:xudtCell.cell.output,source:'https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md',compatibility:'Byte hash matches Gate 2 fixture; independent Pudge transaction execution remains unverified'},codes,codeOccupiedCkb:codes.reduce((sum,x)=>sum+x.occupiedCkbWithStandardSecpLock,0),singletonOccupiedCkb:{marketInventory:242,marketMarker:258,custody:282,custodyMarker:298,total:1080},assumptions:'Standard secp code-cell lock with 20-byte args; Gate 2 script and data lengths; no type script on code cells. Actual lock, fees, change, reserve and initialization require separate review.',fees:'UNDETERMINED: select actual inputs, outputs, fee rate and wallet before calculating serialized transaction fee',broadcast:false},null,2));
