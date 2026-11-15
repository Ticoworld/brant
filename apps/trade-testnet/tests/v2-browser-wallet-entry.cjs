// This file is bundled only by the isolated Playwright test, never by the app.
const { ccc } = require('@ckb-ccc/core');
window.createDisposableTestSigner = (key, genesisSecp) => {
  const client = new ccc.ClientPublicTestnet({url: `${location.origin}/api/local-rpc`, fallbacks: []});
  const original = client.getKnownScript.bind(client);
  client.getKnownScript = async name => name === ccc.KnownScript.Secp256k1Blake160
    ? ccc.ScriptInfo.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',cellDeps:[{cellDep:genesisSecp}]})
    : original(name);
  return new ccc.SignerCkbPrivateKey(client, key);
};
