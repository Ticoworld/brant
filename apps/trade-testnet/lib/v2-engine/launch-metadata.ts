import {ccc} from '@ckb-ccc/core';

const hash = /^0x[0-9a-f]{64}$/;
const secpCode = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';

export function normalizeLaunchMetadata(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid token metadata');
  const fields = input as Record<string, unknown>;
  function field(name: string, limit: number) {
    const value = fields[name] ?? '';
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) {
      throw Error('Invalid token metadata field: ' + name);
    }
    return value.trim().normalize('NFC');
  }
  const name = field('name', 80);
  const ticker = field('ticker', 12).toUpperCase();
  const description = field('description', 1000);
  const link = field('link', 500);
  if (!name || !/^[A-Z0-9]{1,12}$/.test(ticker)) throw Error('Invalid token name or ticker');
  if (link) {
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Expected a public HTTPS link');
  }
  return {name, ticker, description, link};
}

export function launchMetadataMessage(
  scope: {genesis: string; market: string; owner: string},
  metadata: ReturnType<typeof normalizeLaunchMetadata>,
) {
  if (![scope.genesis, scope.market, scope.owner].every(value => hash.test(value))) {
    throw Error('Invalid launch publication identity');
  }
  const digest = ccc.hashCkb(new TextEncoder().encode(JSON.stringify(normalizeLaunchMetadata(metadata))));
  return [
    'BRANT TOKEN METADATA PUBLICATION v1',
    'Genesis: ' + scope.genesis,
    'Market: ' + scope.market,
    'Creator: ' + scope.owner,
    'Metadata digest: ' + digest,
  ].join('\n');
}

export function verifyLaunchMetadata(
  scope: Parameters<typeof launchMetadataMessage>[0], input: unknown, signature: unknown,
) {
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw Error('Expected a recoverable creator signature');
  }
  const metadata = normalizeLaunchMetadata(input);
  const message = launchMetadataMessage(scope, metadata);
  const publicKey = ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message), signature);
  const lock = ccc.Script.from({codeHash: secpCode, hashType: 'type', args: ccc.hashCkbShort(publicKey)});
  if (lock.hash() !== scope.owner || !ccc.verifyMessageCkbSecp256k1(message, signature, publicKey)) {
    throw Error('Metadata signature does not match the creator');
  }
  return metadata;
}
