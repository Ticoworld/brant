'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { saleMessage } = require('./intent.cjs');
const { ccc } = require(path.resolve(__dirname, '../../../apps/trade-testnet/node_modules/@ckb-ccc/core'));

async function main() {
  const signer = new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), '0x' + '1'.padStart(64, '0'));
  const terms = { genesis: '0x' + '11'.repeat(32), vault: '0x' + '22'.repeat(32), covenant: '0x' + '33'.repeat(32), seller: '0x' + '44'.repeat(32), position: '1', principal: '100', backing: '80', revision: '2', price: '6100000000' };
  const message = saleMessage(terms);
  const signature = await signer.signMessageRaw(message);
  assert.equal((signature.length - 2) / 2, 65);
  const digest = ccc.messageHashCkbSecp256k1(message);
  const recovered = ccc.recoverMessageSecp256k1(digest, signature);
  assert.equal(ccc.verifyMessageCkbSecp256k1(message, signature, recovered), true);
  assert.equal(ccc.verifyMessageCkbSecp256k1(saleMessage({ ...terms, price: '6100000001' }), signature, recovered), false);
  assert.notEqual(ccc.messageHashCkbSecp256k1(Buffer.from(message)), digest);
  assert.throws(() => saleMessage({ ...terms, price: '01' }));
  console.log(JSON.stringify({ message, digest, signature, recovered, result: 'local CCC software signer only' }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
