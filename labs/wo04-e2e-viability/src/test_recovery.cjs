const assert=require('assert'),{encode,decode,witness,id}=require('./recovery.cjs'),U=require('../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
let cases=0;const bad=(fn)=>{assert.throws(fn);cases++;};
const terms=Buffer.alloc(536,3),terms2=Buffer.alloc(536,4),p={txHash:'0x'+'11'.repeat(32),index:'0x0'};
let r=encode([{index:0,terms},{index:1,terms}]);assert.equal(r.length,1092);assert.deepEqual(decode(r).map(x=>x.index),[0,1]);cases++;
assert.notEqual(id(terms,p),id(terms,{...p,index:'0x1'}));assert.notEqual(id(terms,p),id(terms2,p));cases+=2;
for(let i=0;i<r.length;i++)bad(()=>decode(r.subarray(0,i)));
for(let i=0;i<8;i++){let b=Buffer.from(r);b[i]^=1;bad(()=>decode(b));}
for(const entries of [[],[{index:0,terms},{index:0,terms}],[{index:1,terms},{index:0,terms}],[{index:0,terms:Buffer.alloc(535)}],[{index:2**32,terms}]])bad(()=>encode(entries));
let w=U.serializeWitnessArgs({lock:'0x'+'00'.repeat(65),inputType:'',outputType:'0x'+r.toString('hex')});assert.equal(witness(w)[2].length,1092);cases++;
for(let i=0;i<16;i++)bad(()=>witness('0x'+Buffer.from(w.slice(2),'hex').subarray(0,i).toString('hex')));
for(let i=4;i<16;i+=4){let b=Buffer.from(w.slice(2),'hex');b.writeUInt32LE(0xffffffff,i);bad(()=>witness('0x'+b.toString('hex')));}
bad(()=>id(terms,{...p,index:'0x100000000'}));bad(()=>decode(Buffer.concat([r,Buffer.from([0])])));
const result={cases,recordVersion:'CKBREC01',completeOrderBytes:536,multipleIdenticalRecords:true,malformedAndTruncatedRejected:true};console.log(JSON.stringify(result,null,2));
