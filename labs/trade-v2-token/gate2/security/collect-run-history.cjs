#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function main() {
  if (process.argv.length !== 5) {
    fail('Usage: node collect-run-history.cjs <native-run-dir> <node-rpc-url> <new-output-dir>');
  }
  const runDir = path.resolve(process.argv[2]);
  const rpcUrl = process.argv[3];
  const outDir = path.resolve(process.argv[4]);
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
  if (summary.owners !== 1024 || summary.fullSellDown !== true) {
    fail('expected a completed 1,024-owner full sell-down run');
  }

  const events = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n');
  let owner = null;
  for (const line of events) {
    const event = JSON.parse(line);
    const witness = event.tx?.witnesses?.find(value => value.startsWith('0x544d5331'));
    if (!witness) continue;
    const bytes = Buffer.from(witness.slice(2), 'hex');
    if (bytes.length < 108 || bytes.readUInt16LE(6) < 1) fail(`invalid initialization TMS1 witness in ${event.label}`);
    owner = `0x${bytes.subarray(12, 44).toString('hex')}`;
    break;
  }
  if (!owner) fail('no committed TMS1 owner identifier found in the native run');

  fs.mkdirSync(outDir, { recursive: false });
  const identityDir = path.join(outDir, 'public-recovery-identity');
  fs.mkdirSync(identityDir);
  const script = value => ({ code_hash: value.codeHash, hash_type: value.hashType, args: value.args });
  const custodyPath = path.join(identityDir, 'custody-lock.json');
  const tokenPath = path.join(identityDir, 'xudt-type.json');
  fs.writeFileSync(custodyPath, `${JSON.stringify(script(summary.scripts.custody), null, 2)}\n`);
  fs.writeFileSync(tokenPath, `${JSON.stringify(script(summary.scripts.token), null, 2)}\n`);

  const bundlePath = path.join(outDir, 'history.json');
  const rpcLogPath = path.join(outDir, 'recovery-rpc.jsonl');
  const recoveryCli = path.resolve(__dirname, '..', 'recovery', 'recover.cjs');
  const result = spawnSync(process.execPath, [
    recoveryCli, 'collect-blocks', '--node', rpcUrl,
    '--init', summary.initializationTransactionHash, '--owner', owner,
    '--custody-lock', custodyPath, '--xudt-type', tokenPath,
    '--max-blocks', '100000', '--out', bundlePath,
  ], {
    encoding: 'utf8',
    env: { ...process.env, TRADE_RECOVERY_RPC_LOG: rpcLogPath },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`canonical history collection failed with exit code ${result.status}`);

  const replay = JSON.parse(fs.readFileSync(`${bundlePath}.result.json`, 'utf8'));
  process.stdout.write(`${JSON.stringify({
    result: 'PASS', source: 'canonical-full-block-scan', indexer_used: false,
    initialization_transaction: summary.initializationTransactionHash,
    queried_owner_lock_hash: owner,
    transitions: replay.transitions.length,
    final_owner_balance: replay.owner.balance,
    custody_amount: replay.custody_amount,
    entitlement_total: replay.entitlement_total,
    bundle: bundlePath,
    rpc_log: rpcLogPath,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
