import { ccc } from '@ckb-ccc/core';

export type OrderTerms = {genesis:string; market:string; asset:string; custody:string; seller:string; revision:bigint; quantity:bigint; minimum:bigint; payout:string; orderId:string};
const h = /^0x[0-9a-f]{64}$/;
const max = (1n << 64n) - 1n;
/** The exact Gate 2 order message. Expiry is not enforced on chain. */
export function orderMessage(t: OrderTerms): string {
  if (![t.genesis,t.market,t.asset,t.custody,t.seller,t.payout,t.orderId].every(x=>h.test(x)) || t.revision < 0n || t.revision > max || t.quantity <= 0n || t.quantity > max || t.minimum < 0n || t.minimum > max) throw Error('Invalid order terms');
  return `TRADE V2 MERKLE TOKEN SALE v1\nGenesis: ${t.genesis}\nMarket: ${t.market}\nAsset: ${t.asset}\nCustody: ${t.custody}\nSeller: ${t.seller}\nRevision: ${t.revision}\nQuantity: ${t.quantity}\nMinimum shannons: ${t.minimum}\nPayout: ${t.payout}\nOrder id: ${t.orderId}\nBuyer: any\nExpiry: none`;
}
/** Uses the connected wallet's message-signing API; no private key leaves it. */
export async function signOrder(t: OrderTerms, signer: {signMessageRaw(message:string):Promise<string>}) {
  const message = orderMessage(t);
  const signature = await signer.signMessageRaw(message);
  if (!/^0x[0-9a-f]{130}$/i.test(signature)) throw Error('Wallet returned an invalid signature');
  const publicKey = ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message), signature as ccc.Hex);
  const owner = ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(publicKey)});
  if (owner.hash() !== t.seller) throw Error('Signing wallet does not match seller');
  return {message, signature, publicKey};
}

/** Encode the exact operation-8 payload appended to the compiled SMT proof. */
export function orderPayload(t: OrderTerms, publicKey: string, signature: string): string {
  orderMessage(t);
  if (!/^0x(?:02|03)[0-9a-f]{64}$/i.test(publicKey) || !/^0x[0-9a-f]{130}$/i.test(signature)) throw Error('Invalid order signature or public key');
  const le = (n:bigint) => Array.from({length:8}, (_,i) => Number((n >> BigInt(i*8)) & 255n).toString(16).padStart(2,'0')).join('');
  return '0x' + le(t.quantity) + le(t.minimum) + t.orderId.slice(2) + t.seller.slice(2) + t.payout.slice(2) + publicKey.slice(2) + signature.slice(2);
}
