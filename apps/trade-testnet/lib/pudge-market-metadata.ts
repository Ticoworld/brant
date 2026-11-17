type MarketMetadataIdentity = {
  genesis: string;
  marketScriptHash: string;
  tokenTypeHash: string;
  initializationTransactionHash: string;
};

const records = [
  {
    identity: {
      genesis: '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606',
      marketScriptHash: '0x94eb3a5227c80a2d65cb2713df29a800e859a8bd36c47fb367e79f5bbe62ea0e',
      tokenTypeHash: '0xa706188a0d74a200306109a88fd7835b75eff42f35e9983fa0d3c2138e181ddb',
      initializationTransactionHash: '0xc37029b982276a7c3e126a5658510fda1cd5f2963caf650b04f397a8484c7d2a',
    },
    name: 'Roveko Genesis',
    symbol: 'RVK',
    description: 'Roveko first public Pudge test token. Display metadata is off-chain and does not alter the xUDT type.',
  },
] as const;

export function resolvePudgeTokenMetadata(identity: MarketMetadataIdentity) {
  const normalized = {
    genesis: identity.genesis.toLowerCase(),
    marketScriptHash: identity.marketScriptHash.toLowerCase(),
    tokenTypeHash: identity.tokenTypeHash.toLowerCase(),
    initializationTransactionHash: identity.initializationTransactionHash.toLowerCase(),
  };
  const record = records.find((candidate) =>
    candidate.identity.genesis === normalized.genesis &&
    candidate.identity.marketScriptHash === normalized.marketScriptHash &&
    candidate.identity.tokenTypeHash === normalized.tokenTypeHash &&
    candidate.identity.initializationTransactionHash === normalized.initializationTransactionHash
  );
  return record
    ? { name: record.name, symbol: record.symbol, description: record.description, metadata: 'off-chain-testnet-registry' }
    : { name: 'xUDT', symbol: 'xUDT', description: '', metadata: 'not-encoded' };
}
