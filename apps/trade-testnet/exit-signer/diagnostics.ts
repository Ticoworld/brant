export class SigningDiagnostic extends Error {}

function field(value: unknown, key: string): unknown {
  try {
    return value && typeof value === 'object' ? Reflect.get(value, key) : undefined;
  } catch {
    return undefined;
  }
}

export function providerFailure(stage: string, value: unknown) {
  const rawCode = field(value, 'code');
  const code = typeof rawCode === 'number' || typeof rawCode === 'string' ? String(rawCode) : '';
  const rawMessage = typeof value === 'string' ? value : field(value, 'message');
  const message = typeof rawMessage === 'string' ? rawMessage.slice(0, 240) : '';
  const rejected = code === '4001' || code === 'ACTION_REJECTED' ||
    /\b(?:user|owner) (?:rejected|denied|cancelled|canceled)\b|^request rejected$/i.test(message);
  // Only report recognized phrases. Provider messages can include keys, addresses or transactions.
  const description = rejected ? 'Wallet approval rejected' :
    /\bdisconnect(?:ed)?\b/i.test(message) ? 'Wallet disconnected' :
    /\b(?:wrong|unsupported) network\b/i.test(message) ? 'Wallet network mismatch' :
    /\b(?:timeout|timed out)\b/i.test(message) ? 'Wallet provider timed out' :
    /\binvalid params\b/i.test(message) ? 'Wallet provider reported invalid parameters' :
    'Wallet provider failed';
  const safeCode = /^(?:-?[0-9]{1,6}|ACTION_REJECTED)$/.test(code) ? ` (code ${code})` : '';
  return new SigningDiagnostic(`${stage}. ${description}${safeCode}`);
}
