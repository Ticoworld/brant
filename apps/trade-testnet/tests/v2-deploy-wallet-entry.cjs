// Bundled only into the isolated browser test; no private keys are used.
const {ccc}=require('@ckb-ccc/core');
window.createDeployReviewTestWallet=(genesis,args='0x'+'11'.repeat(20))=>({
  client:{getHeaderByNumber:async()=>({hash:genesis})},
  getRecommendedAddressObj:async()=>({script:ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args})}),
});
