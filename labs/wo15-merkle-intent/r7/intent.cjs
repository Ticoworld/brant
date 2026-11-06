'use strict';

// Canonical ASCII serialization. All amounts are integer shannons.
const hash = (value, name) => {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) throw new Error(`invalid ${name}`);
  return value;
};
const integer = (value, name) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value) > 0xffffffffffffffffn) throw new Error(`invalid ${name}`);
  return value;
};
function saleMessage(t) {
  return [
    'TRADE SALE AUTHORIZATION v1',
    'Scope: sell one funded financial position; any buyer; no expiry',
    'Network: CKB chain identified by genesis',
    `Genesis: ${hash(t.genesis, 'genesis')}`,
    `Vault: ${hash(t.vault, 'vault')}`,
    `Covenant script hash: ${hash(t.covenant, 'covenant')}`,
    `Position: ${integer(t.position, 'position')}`,
    `Seller lock hash: ${hash(t.seller, 'seller')}`,
    `Principal shannons: ${integer(t.principal, 'principal')}`,
    `Backing shannons: ${integer(t.backing, 'backing')}`,
    `Revision: ${integer(t.revision, 'revision')}`,
    `Minimum payment shannons: ${integer(t.price, 'price')}`,
    `Payment recipient lock hash: ${hash(t.seller, 'seller')}`,
  ].join('\n');
}
module.exports = { saleMessage };
