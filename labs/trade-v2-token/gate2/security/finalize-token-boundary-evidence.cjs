#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const directory = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.statSync(directory).isDirectory()) {
  throw new Error('usage: node finalize-token-boundary-evidence.cjs <native-token-boundaries evidence directory>');
}
const readJson = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const readJsonl = name => fs.readFileSync(path.join(directory, name), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const events = readJsonl('events.jsonl');
const attacks = readJsonl('boundary-attacks.jsonl');
const provenance = readJson('provenance.json');
const previousSummary = fs.existsSync(path.join(directory, 'summary.json'))
  ? readJson('summary.json')
  : readJson('target-completion.json');
const byHash = new Map(events.map(event => [event.hash, event]));
const issue = events.find(event => event.label === 'issue_fixed_supply');
if (!issue) throw new Error('missing committed issue_fixed_supply positive control');
const xudtType = issue.tx.outputs.find(output => output.type)?.type;
if (!xudtType) throw new Error('issue transaction omitted its xUDT type script');

function amountLE128(data) {
  const bytes = Buffer.from(data.slice(2), 'hex');
  if (bytes.length < 16) throw new Error('xUDT cell data is shorter than its 16-byte quantity prefix');
  let value = 0n;
  for (let i = 15; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

function exactType(script) {
  return !!script && script.codeHash === xudtType.codeHash && script.hashType === xudtType.hashType && script.args === xudtType.args;
}

function tokenTotals(transaction) {
  let input = 0n;
  for (const cellInput of transaction.inputs) {
    const event = byHash.get(cellInput.previousOutput.txHash);
    if (!event) throw new Error('input is not resolved by committed fixture events: ' + JSON.stringify(cellInput.previousOutput));
    const index = Number(BigInt(cellInput.previousOutput.index));
    if (exactType(event.tx.outputs[index]?.type)) input += amountLE128(event.tx.outputsData[index]);
  }
  let output = 0n;
  for (let i = 0; i < transaction.outputs.length; i++) {
    if (exactType(transaction.outputs[i].type)) output += amountLE128(transaction.outputsData[i]);
  }
  return { input: input.toString(), output: output.toString(), conserved: input === output };
}

const attackRows = attacks.map(attack => {
  let sendFailure;
  try {
    sendFailure = JSON.parse(attack.sendTransactionError);
  } catch {
    sendFailure = { message: attack.sendTransactionError || 'missing send_transaction error' };
  }
  const verifiedByNativeScript = /Script\(TransactionScriptError/.test(sendFailure.message || '');
  return {
    label: attack.label,
    classification: verifiedByNativeScript ? 'VERIFIED_NATIVE_REJECTION' : 'NOT_PROVEN_NATIVE_ATTACK',
    rawTransactionHash: attack.rawTransactionHash,
    fullSignedTransactionSha256: attack.fullSignedTransactionSha256,
    witnessesSha256: attack.witnessesSha256,
    rejectingSource: attack.rejectingSource,
    rejectingScript: attack.rejectingScript,
    rejectingScriptHash: attack.rejectingCodeHash,
    vmError: attack.rejectingCode,
    nativeSendFailure: sendFailure.message,
    estimateCyclesFailure: attack.estimateCyclesError,
    transactionFile: path.basename(attack.label + '.json'),
    exactTypeTokenTotals: tokenTotals(attack.transaction),
    positiveControl: attack.positiveControl,
    exploitHypothesis: attack.alteredCondition,
  };
});

const positiveLabels = new Set([
  'issue_fixed_supply',
  'offline_seller_initial_purchase',
  'positive_partial_external_withdrawal_three_units',
  'positive_remaining_external_withdrawal_four_units',
  'positive_genuine_xudt_quantity_preserving_transfer',
  'positive_canonical_external_curve_sale_one_unit',
]);
const positiveControls = events.filter(event => positiveLabels.has(event.label)).map(event => ({
  label: event.label,
  transactionHash: event.hash,
  cycles: event.cycles.cycles,
  inputCount: event.tx.inputs.length,
  outputCount: event.tx.outputs.length,
  serializedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(event.tx)).digest('hex'),
  committed: event.committed.tx_status.status === 'committed',
}));

const summary = {
  classification: attackRows.length === 5 && attackRows.every(attack => attack.classification === 'VERIFIED_NATIVE_REJECTION') && positiveControls.every(control => control.committed)
    ? 'VERIFIED_NATIVE_TARGETED_RUN'
    : 'PARTIAL_NATIVE_TARGETED_RUN',
  ckbVersion: provenance.ckbVersion,
  privateDisposableChain: true,
  genesis: previousSummary.genesis,
  supply: amountLE128(issue.tx.outputsData[0]).toString(),
  maximumSupplyIssue: positiveControls.find(control => control.label === 'issue_fixed_supply'),
  positiveControls,
  attacks: attackRows,
  rejectedAttackCount: attackRows.filter(attack => attack.classification === 'VERIFIED_NATIVE_REJECTION').length,
  notProvenAttackCount: attackRows.filter(attack => attack.classification !== 'VERIFIED_NATIVE_REJECTION').length,
  conservationPreservingAttackCount: attackRows.filter(attack => attack.exactTypeTokenTotals.conserved).length,
  caveat: 'Counterfeit-type substitution is rejected by market lineage before the counterfeit or genuine xUDT Type Script result is relied on. The maximum remaining-supply curve quantity and arithmetic/capacity extremes are not tested here.',
  sourceHashes: provenance.sourceHashes,
  binaryHashes: provenance.binaryHashes,
  files: {
    rawRpc: { path: 'rpc.jsonl', sha256: sha256(path.join(directory, 'rpc.jsonl')), bytes: fs.statSync(path.join(directory, 'rpc.jsonl')).size, storage: 'local-only' },
    rawEvents: { path: 'events.jsonl', sha256: sha256(path.join(directory, 'events.jsonl')), bytes: fs.statSync(path.join(directory, 'events.jsonl')).size, storage: 'local-only' },
    nodeLog: { path: 'node.log', sha256: sha256(path.join(directory, 'node.log')), bytes: fs.statSync(path.join(directory, 'node.log')).size, storage: 'local-only' },
  },
};
fs.writeFileSync(path.join(directory, 'target-completion.json'), JSON.stringify(summary, null, 2));

const trackedFiles = [
  'provenance.json',
  'target-completion.json',
  ...attacks.map(attack => path.basename(attack.label + '.json')),
].sort();
const localFiles = ['rpc.jsonl', 'events.jsonl', 'node.log', 'dev.toml'].map(name => ({
  path: name,
  sha256: sha256(path.join(directory, name)),
  bytes: fs.statSync(path.join(directory, name)).size,
  storage: 'local-only',
}));
fs.writeFileSync(path.join(directory, 'evidence-manifest.json'), JSON.stringify({
  classification: 'VERIFIED_EVIDENCE_MANIFEST',
  sourceDirectory: path.basename(directory),
  trackedFiles: trackedFiles.map(name => ({ path: name, sha256: sha256(path.join(directory, name)), bytes: fs.statSync(path.join(directory, name)).size })),
  localOnlyFiles: localFiles,
}, null, 2));
console.log(JSON.stringify({
  targetCompletion: path.join(directory, 'target-completion.json'),
  evidenceManifest: path.join(directory, 'evidence-manifest.json'),
  verifiedAttacks: summary.rejectedAttackCount,
  issueHash: summary.maximumSupplyIssue.transactionHash,
}, null, 2));
