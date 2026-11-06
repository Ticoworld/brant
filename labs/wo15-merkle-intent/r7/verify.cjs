// Independent replay of recorded native trace, adapted from the R5 replayer.
const fs=require('fs'),path=require('path'),Module=require('module');
const source=path.resolve(__dirname,'../src/verify.cjs');
let text=fs.readFileSync(source,'utf8');
text=text.replace("const dir=process.argv[2]", "const {saleMessage}=require('../r7/intent.cjs');const {ccc}=require('../../../apps/trade-testnet/node_modules/@ckb-ccc/core');const dir=process.argv[2]");
text=text.replace('(op===8?105:0)', '(op===8?106:0)');
text=text.replace(/sig=payload\.subarray\(e\+41,e\+105\),pre=.*?assert\(ec\.keyFromPublic\(pub\)\.verify\(digest,\{r,s:ss\}\)\);/, `sig=payload.subarray(e+41,e+106);const message=saleMessage({genesis,vault:tree.id,covenant:C.U.scriptToHash(script),position:String(index),seller:old.owner,principal:String(old.p),backing:String(old.b),revision:String(old.revision),price:String(price)});const recovered=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message),C.hx(sig));assert.equal(recovered,C.hx(pub));assert(ccc.verifyMessageCkbSecp256k1(message,C.hx(sig),recovered));`);
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
