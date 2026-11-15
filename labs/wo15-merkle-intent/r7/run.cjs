// Adapt the preserved R5 harness to exercise the R7 wire format.
const fs=require('fs'),path=require('path'),Module=require('module');
const source=path.resolve(__dirname,'../src/run.cjs');
let text=fs.readFileSync(source,'utf8');
text=text.replace("const EC=require", "const {saleMessage}=require('../r7/intent.cjs');const {ccc}=require('../../../apps/trade-testnet/node_modules/@ckb-ccc/core');const EC=require");
text=text.replace("'../evidence/r5-'", "'../r7/evidence/r7-'").replace("'../build/merkle_intent'", "'../r7/build/merkle_intent'");
text=text.replace(/function intent\(index,role,price\)\{.*?\}\nfunction offline/s, `async function intent(index,role,price){let old=m.tree.records[index];assert.equal(old.owner,owners[role]);const message=saleMessage({genesis:m.genesis,vault:m.tree.id,covenant:C.U.scriptToHash(m.script),position:String(index),seller:old.owner,principal:String(old.p),backing:String(old.b),revision:String(old.revision),price:String(price)});const signer=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),C.keys[role]);const sig=C.b(await signer.signMessageRaw(message));const pub=C.b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message),C.hx(sig)));return {index,old:{...old},price,pub,sig};}\nfunction offline`);
text=text.replace('const alice=intent(', 'const alice=await intent(').replace('let foreign=intent(', 'let foreign=await intent(').replace('const a=intent(', 'const a=await intent(').replace(',b=intent(', ',b=await intent(').replace('const cancellable=intent(', 'const cancellable=await intent(');
text=text.replace('stride=225+', 'stride=226+');
text=text.replace("let f=offline([alice],2);", `let f=offline([alice],2);let modified=structuredClone(f.tx),mw=C.b(modified.witnesses.at(-1)),priceOffset=16+120+32*m.tree.depth;mw.writeBigUInt64LE(alice.price-1n,priceOffset);modified.witnesses[modified.witnesses.length-1]=C.hx(mw);await e.reject('modified_signed_price',e.sign(modified,f.ins,[2]),/Inputs\\[0\\]\\.Lock.*error code 85 on/);`);
// R5's separate replay understands the R5 digest and cannot validate R7.
text=text.replace(/function recover\(name,i\)\{.*?\}\nasync function fill/s, 'function recover(){}\nasync function fill');
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
