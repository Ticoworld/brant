const C=require('./lib.cjs'),assert=require('node:assert/strict');
const dir=C.ROOT+'/vendor/ickb',manifest=JSON.parse(C.fs.readFileSync(dir+'/PROVENANCE.json'));
assert.equal(manifest.commit,'c951927e35fb5d4a13e28c5e55687d49cea7ca05');
for(const [file,sha]of Object.entries(manifest.files))assert.equal(C.crypto.createHash('sha256').update(C.fs.readFileSync(dir+'/'+file)).digest('hex'),sha,file);
const expected={limit_order:'0x49dfb6afee5cc8ac4225aeea8cb8928b150caf3cd92fea33750683c74b13254a',ickb_logic:'0x2a8100ab5990fa055ab1b50891702e1e895c7bd1df6322cd725c1a6115873bd3',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',owned_owner:'0xacc79e07d107831feef4c70c9e683dac5644d5993b9cb106dca6e74baa381bd0'};
for(const [file,hash]of Object.entries(expected))assert.equal(C.hash(C.fs.readFileSync(dir+'/build/release/'+file)),hash,file);
console.log(JSON.stringify({status:'PASS',files:Object.keys(manifest.files).length,commit:manifest.commit,publishedCodeHashes:expected,scope:'Pinned source and published binary bytes; no independently rebuilt source-to-binary equivalence'}));
