import assert from 'node:assert/strict';
import {isPlainFundingCell} from '../lib/plain-cell.ts';
const code={txHash:'0x'+'11'.repeat(32),index:'0x0'},point={tx_hash:code.txHash,index:'0x0'};
assert.equal(isPlainFundingCell({output:{},output_data:'0x1234',out_point:point},code),false);
assert.equal(isPlainFundingCell({output:{type:{}},output_data:'0x',out_point:point},code),false);
assert.equal(isPlainFundingCell({output:{},output_data:'0x',out_point:point},code),false);
assert.equal(isPlainFundingCell({output:{},output_data:'0x',out_point:{tx_hash:'0x'+'22'.repeat(32),index:'0x0'}},code),true);
assert.equal(isPlainFundingCell({output:{},out_point:point},code),false);
console.log('Plain funding cell checks passed');
