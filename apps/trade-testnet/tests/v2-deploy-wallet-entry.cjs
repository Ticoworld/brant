// Bundled only into the isolated browser test; no private keys are used.
const {ccc}=require('@ckb-ccc/core');
const fixtureKey='0x'+'00'.repeat(31)+'01',fixturePublic='0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
window.createDeployReviewTestWallet=(genesis,args=ccc.hashCkbShort(fixturePublic))=>({
  client:{getHeaderByNumber:async()=>({hash:genesis}),sendTransaction:async tx=>{const r=await fetch('/test-submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v)});if(!r.ok)throw Error('Submission response lost');return (await r.json()).hash;}},
  isConnected:async()=>window.rovTestWalletNetworkWrong!==true,
  getRecommendedAddressObj:async()=>({script:ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args}),toString:()=> 'disposable-test-address'}),
  signTransaction:async tx=>{if(window.rovTestWalletMode==='modified'){tx.outputs[0].capacity+=1n;return tx;}if(window.rovTestWalletMode==='valid'){const first=window.rovTestWalletStage==='trade'?4:window.rovTestWalletStage==='purchase'?2:0,group=window.rovTestWalletStage==='trade'?[4]:window.rovTestWalletStage==='issuance'?[0]:window.rovTestWalletStage==='purchase'?[2]:tx.inputs.map((_,i)=>i),h=new ccc.HasherCkb();h.update(tx.hash());ccc.Transaction.hashWitnessToHasher(ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex(),h);for(const i of group.slice(1))ccc.Transaction.hashWitnessToHasher(tx.witnesses[i]||'0x',h);for(const w of tx.witnesses.slice(tx.inputs.length))ccc.Transaction.hashWitnessToHasher(w,h);tx.witnesses[first]=ccc.WitnessArgs.from({lock:ccc.signMessageSecp256k1(h.digest(),fixtureKey)}).toHex();return tx;}throw Error('Wallet declined');},
});
