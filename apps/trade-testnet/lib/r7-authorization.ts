import { ccc } from '@ckb-ccc/core';

export type SaleTerms = { genesis:string; vault:string; covenant:string; position:string; seller:string; principal:string; backing:string; revision:string; price:string };
const lockCode = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
function hash(value:string) { if (!/^0x[0-9a-f]{64}$/.test(value)) throw Error('Invalid hash'); return value; }
function integer(value:string) { if (!/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value)>0xffffffffffffffffn) throw Error('Invalid integer'); return value; }
export function saleMessage(t:SaleTerms) {
  return ['TRADE SALE AUTHORIZATION v1','Scope: sell one funded financial position; any buyer; no expiry','Network: CKB chain identified by genesis',`Genesis: ${hash(t.genesis)}`,`Vault: ${hash(t.vault)}`,`Covenant script hash: ${hash(t.covenant)}`,`Position: ${integer(t.position)}`,`Seller lock hash: ${hash(t.seller)}`,`Principal shannons: ${integer(t.principal)}`,`Backing shannons: ${integer(t.backing)}`,`Revision: ${integer(t.revision)}`,`Minimum payment shannons: ${integer(t.price)}`,`Payment recipient lock hash: ${hash(t.seller)}`].join('\n');
}
export function verifyAuthorization(t:SaleTerms,signature:string) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw Error('Expected a 65-byte recoverable signature');
  const message=saleMessage(t);
  const publicKey=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message),signature);
  const lock=ccc.Script.from({codeHash:lockCode,hashType:'type',args:ccc.hashCkbShort(publicKey)});
  if (lock.hash()!==t.seller || !ccc.verifyMessageCkbSecp256k1(message,signature,publicKey)) throw Error('Seller signature does not match lock');
  return {message,publicKey,lock};
}
