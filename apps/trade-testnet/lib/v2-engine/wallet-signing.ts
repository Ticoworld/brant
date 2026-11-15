import {ccc} from '@ckb-ccc/core';

export type WalletSigningStage = 'CCC transaction preparation'|'UTXO Global wallet request'|'CCC signer request'|'CCC signed transaction parsing';

/** Mirrors CCC Signer.signTransaction while exposing the provider boundary. */
export async function requestWalletTransactionSignature(
  signer: ccc.Signer,
  reviewed: ccc.Transaction,
  onStage: (stage: WalletSigningStage, walletResponseReceived: boolean) => void,
) {
  onStage('CCC transaction preparation', false);
  const prepared = await signer.prepareTransaction(reviewed);
  if (prepared.hash() !== reviewed.hash() || prepared.witnesses.length !== reviewed.witnesses.length || prepared.witnesses.some((witness, i) => witness.toLowerCase() !== reviewed.witnesses[i].toLowerCase()) || prepared.toBytes().length !== reviewed.toBytes().length) {
    throw Error('CCC signer preparation changed the reviewed transaction');
  }

  const provider = (signer as ccc.Signer & {provider?: {signTransaction?: (tx: ccc.TransactionLike) => Promise<ccc.TransactionLike>}}).provider;
  if (provider?.signTransaction) {
    onStage('UTXO Global wallet request', false);
    const returned = await provider.signTransaction(prepared);
    onStage('CCC signed transaction parsing', true);
    return ccc.Transaction.from(returned);
  }

  onStage('CCC signer request', false);
  const returned = await signer.signOnlyTransaction(prepared);
  onStage('CCC signed transaction parsing', true);
  return ccc.Transaction.from(returned);
}

export function safeSigningError(error: unknown) {
  const value = error && typeof error === 'object' ? error as {message?: unknown; code?: unknown} : {};
  const rawMessage = error instanceof Error ? error.message : typeof value.message === 'string' ? value.message : typeof error === 'string' ? error : 'Unknown signing error';
  const containsSecretContext = /private\s*key|seed\s*phrase|mnemonic|secret\s*phrase/i.test(rawMessage);
  const message = (containsSecretContext ? '[sensitive wallet error details redacted]' : rawMessage)
    .replace(/0x[0-9a-f]{32,}/gi, '[redacted hex data]')
    .replace(/\b(?:ckb|ckt)1[0-9a-z]{20,}\b/gi, '[redacted address]')
    .replace(/\b[A-Za-z0-9+/]{80,}={0,2}\b/g, '[redacted encoded data]')
    .replace(/[\r\n\t\0-\x1f\x7f]/g, ' ')
    .slice(0, 240)
    .trim() || 'Unknown signing error';
  const rawCode = value.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode) : undefined;
  return {message, code: code && /^[A-Za-z0-9_.:-]{1,48}$/.test(code) ? code : undefined};
}
