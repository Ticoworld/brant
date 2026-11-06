// Private devnet only. Public address supplied by the user; no wallet access.
const fs=require('fs'),path=require('path'),Module=require('module');
const source=path.resolve(__dirname,'../../../labs/wo15-merkle-intent/src/run.cjs');
let text=fs.readFileSync(source,'utf8').replace("'../build/merkle_intent'","'../r7/build/merkle_intent'").replace("'../evidence/r5-'","'../r7/evidence/extension-prepare-'");
const marker=' const alice=intent(0,0,80n*C.UNIT),before=m.tree.root,old=m.tree.records[2];';
if(!text.includes(marker))throw Error('Fixture source changed');
text=text.slice(0,text.indexOf(marker))+`
 const external={codeHash:C.locks[0].codeHash,hashType:'type',args:'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'};
 assert.equal(C.U.scriptToHash(external),'0xc47b33f79bb3439876bf5be3af7d790eca8ae73779346297b5290ad73e4436ca');
 const funding=e.wallets[2],amount=200n*C.UNIT;
 const funded=await e.send('fund_external_lock',e.sign(e.tx([funding],[cell(amount,external),cell(funding.capacity-amount-F,C.locks[2])]),[funding],[2]));
 e.wallets[2]=funded[1];const buyer=funded[0],seller=e.wallets[0],old=m.tree.records[0],price=80n*C.UNIT;
 const u=M.update(m,4,[{i:0,r:{...old,owner:C.U.scriptToHash(external)}}]);
 const inputs=[m.vault,seller,buyer],outputs=[vault(u.next),cell(seller.capacity+price,C.locks[0]),cell(buyer.capacity-price-F,external)];
 const tx=e.sign(e.tx(inputs,outputs,[e.dep('market')],['0x','0x','0x',u.witness]),inputs,[0]);
 C.write(out+'/review.json',{privateGenesis:m.genesis,covenant:m.script,vaultOutPoint:m.vault.outPoint,externalLock:external,position:0,principal:old.p,backing:old.b,revision:old.revision,price,fee:F,transaction:tx,note:'Seller fixture has signed. Buyer input requires the supplied address to sign this exact private-chain transaction. Do not submit on public networks.'});
 console.log('PRIVATE_REVIEW',out+'/review.json');
 await new Promise(resolve=>process.once('SIGINT',resolve));e.close();
}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();\n`;
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
