const {C,assert}=require('./engine.cjs'),path=require('path'),root=path.resolve(__dirname,'..');
const manifest=JSON.parse(C.fs.readFileSync(root+'/PROVENANCE.json'));let count=0;
for(const [file,sha]of Object.entries(manifest.files)){assert.equal(C.crypto.createHash('sha256').update(C.fs.readFileSync(root+'/'+file)).digest('hex'),sha,file);count++;}
const inherited=JSON.parse(C.fs.readFileSync(root+'/../rebuild/mechanisms/PROVENANCE.json'));let headers=0;
for(const [file,sha]of Object.entries(inherited.files))if(file.startsWith('deps/ckb-c-stdlib/')){assert.equal(C.crypto.createHash('sha256').update(C.fs.readFileSync(root+'/../rebuild/mechanisms/'+file)).digest('hex'),sha,file);headers++;}
console.log(JSON.stringify({status:'PASS',files:count,inheritedHeaders:headers,scope:'Exact content pins; stdlib upstream revision remains unknown, inherited published/source equivalence and production security not inferred'}));
