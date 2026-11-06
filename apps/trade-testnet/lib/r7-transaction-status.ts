export type TransactionStatus = 'unknown' | 'pending' | 'committed' | 'rejected';

// Unknown includes RPC interruptions and transactions no longer reported by a node.
export function transactionStatus(result: unknown): TransactionStatus {
  if (!result || typeof result !== 'object') return 'unknown';
  const status = (result as { tx_status?: { status?: unknown } }).tx_status?.status;
  if (status === 'committed' || status === 'rejected') return status;
  if (status === 'pending' || status === 'proposed') return 'pending';
  return 'unknown';
}

export function transactionUnresolved(status: TransactionStatus): boolean {
  return status === 'unknown' || status === 'pending';
}
