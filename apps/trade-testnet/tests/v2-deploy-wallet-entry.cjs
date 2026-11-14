// Bundled only into the isolated browser test; no private keys are used.
const {ccc}=require('@ckb-ccc/core');
const fixtureKey='0x'+'00'.repeat(31)+'01',fixturePublic='0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
window.createDeployReviewTestWallet=(genesis,args=ccc.hashCkbShort(fixturePublic))=>({
  client:{getHeaderByNumber:async()=>({hash:genesis})},
  getRecommendedAddressObj:async()=>({script:ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args}),toString:()=> 'disposable-test-address'}),
  signTransaction:async tx=>{if(window.rovTestWalletMode==='modified'){tx.outputs[0].capacity+=1n;return tx;}if(window.rovTestWalletMode==='valid'){const h=new ccc.HasherCkb();h.update(tx.hash());ccc.Transaction.hashWitnessToHasher(ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex(),h);for(const w of tx.witnesses.slice(1))ccc.Transaction.hashWitnessToHasher(w,h);tx.witnesses[0]=ccc.WitnessArgs.from({lock:ccc.signMessageSecp256k1(h.digest(),fixtureKey)}).toHex();return tx;}throw Error('Wallet declined');},
});
