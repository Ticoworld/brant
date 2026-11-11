#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const recoveryDir = __dirname;
const gate2Dir = path.resolve(recoveryDir, '..');
const repoRoot = path.resolve(gate2Dir, '..', '..', '..');
const runnerPath = path.join(gate2Dir, 'run.cjs');
const recoverPath = path.join(recoveryDir, 'recover.cjs');
const rpcUrl = process.env.TRADE_GATE2_RECOVERY_RPC || 'http://127.0.0.1:19224';
const nativeRoot = process.env.TRADE_NATIVE_ROOT;
const ckbBin = process.env.CKB_BIN;

if (!nativeRoot || !ckbBin) throw new Error('set TRADE_NATIVE_ROOT and CKB_BIN for the pinned private CKB environment');
const C = require(path.join(nativeRoot, 'src', 'lib.cjs'));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, env: options.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${path.basename(command)} exited ${code}: ${stderr.slice(-4000)}`)));
  });
}

function randomPrivateKey() {
  for (;;) {
    const key = `0x${crypto.randomBytes(32).toString('hex')}`;
    try { C.U.privateKeyToPublicKey(key); return key; } catch {}
  }
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function stopRunnerNode(evidenceDir) {
  if (evidenceDir && fs.existsSync(path.join(evidenceDir, 'node.pid'))) {
    fs.writeFileSync(path.join(evidenceDir, 'stop-node'), 'stop\n');
  }
}

async function recoverScale(evidenceDir, ownerKey, runnerEnv) {
  const summaryPath = path.join(evidenceDir, 'summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.owners, 1024, 'runner did not create 1,024 owner positions');
  assert(summary.initializationTransactionHash, 'runner omitted the public initialization transaction hash');
  assert(summary.recoveryOwnerLockHash, 'runner omitted the recovery owner lock hash');

  const identityDir = path.join(evidenceDir, 'public-recovery-identity');
  fs.mkdirSync(identityDir, { recursive: true });
  const script = value => ({ code_hash: value.codeHash, hash_type: value.hashType, args: value.args });
  const custodyPath = path.join(identityDir, 'custody-lock.json');
  const xudtPath = path.join(identityDir, 'xudt-type.json');
  fs.writeFileSync(custodyPath, `${JSON.stringify(script(summary.scripts.custody), null, 2)}\n`);
  fs.writeFileSync(xudtPath, `${JSON.stringify(script(summary.scripts.token), null, 2)}\n`);

  const owner = summary.recoveryOwnerLockHash;
  const bundlePath = path.join(evidenceDir, 'recovery-history.json');
  const verifyPath = `${bundlePath}.result.json`;
  const withdrawalPath = path.join(evidenceDir, 'recovery-withdrawal.json');
  const postBundlePath = path.join(evidenceDir, 'recovery-post-withdrawal-history.json');
  const postVerifyPath = `${postBundlePath}.result.json`;
  const recoveryEnv = {
    ...runnerEnv,
    TRADE_RECOVERY_PRIVATE_KEY: ownerKey,
    TRADE_RECOVERY_RPC_LOG: path.join(evidenceDir, 'recovery-rpc.jsonl'),
  };

  await run(process.execPath, [recoverPath, 'collect-blocks', '--node', rpcUrl,
    '--init', summary.initializationTransactionHash, '--owner', owner,
    '--custody-lock', custodyPath, '--xudt-type', xudtPath, '--out', bundlePath], { env: recoveryEnv });

  const before = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
  assert.equal(before.owner_membership_proof.root_verified, true);
  assert.equal(before.owner.active, true);
  assert(BigInt(before.owner.balance) > 0n, 'recovery owner has no unwithdrawn balance');
  assert.equal(before.custody_amount, before.entitlement_total);

  await run(process.execPath, [recoverPath, 'withdraw', '--node', rpcUrl,
    '--bundle', bundlePath, '--out', withdrawalPath, '--mine'], { env: recoveryEnv });
  await run(process.execPath, [recoverPath, 'verify-withdrawal', '--node', rpcUrl,
    '--report', withdrawalPath], { env: recoveryEnv });

  await run(process.execPath, [recoverPath, 'collect-blocks', '--node', rpcUrl,
    '--init', summary.initializationTransactionHash, '--owner', owner,
    '--custody-lock', custodyPath, '--xudt-type', xudtPath, '--out', postBundlePath], { env: recoveryEnv });
  const after = JSON.parse(fs.readFileSync(postVerifyPath, 'utf8'));
  const postBundle = JSON.parse(fs.readFileSync(postBundlePath, 'utf8'));
  assert.equal(after.owner.active, false);
  assert.equal(after.owner.balance, '0');
  assert.equal(after.custody_amount, after.entitlement_total);

  const withdrawal = JSON.parse(fs.readFileSync(withdrawalPath, 'utf8'));
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const result = {
    format: 'trade-v2-scale-recovery-acceptance-v1',
    private_chain: true,
    ckb_version: '0.210.0',
    owners: summary.owners,
    initialization_transaction: summary.initializationTransactionHash,
    recovery_owner_lock_hash: owner,
    source: 'canonical-full-block-scan',
    indexer_used: false,
    history_transactions_before: before.transitions.length,
    owner_balance_before: before.owner.balance,
    owner_revision_before: before.owner.revision,
    membership_proof_bytes: before.owner_membership_proof.proof_bytes,
    membership_root_verified: before.owner_membership_proof.root_verified,
    custody_before: before.custody_amount,
    entitlement_total_before: before.entitlement_total,
    withdrawal_transaction: withdrawal.transaction_hash,
    withdrawal_vm_cycles: withdrawal.cycles,
    withdrawal_block: withdrawal.block_number,
    owner_balance_after: after.owner.balance,
    owner_revision_after: after.owner.revision,
    custody_after: after.custody_amount,
    entitlement_total_after: after.entitlement_total,
    history_transactions_after: after.transitions.length,
    pre_withdrawal_tip: JSON.parse(fs.readFileSync(bundlePath, 'utf8')).collection.end_tip,
    post_withdrawal_tip: postBundle.collection.end_tip,
    sha256: {
      history: hash(bundlePath),
      replay: hash(verifyPath),
      withdrawal: hash(withdrawalPath),
      post_withdrawal_history: hash(postBundlePath),
      post_withdrawal_replay: hash(postVerifyPath),
    },
  };
  fs.writeFileSync(path.join(evidenceDir, 'recovery-acceptance.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`Scale recovery accepted: ${withdrawal.transaction_hash}; custody ${after.custody_amount} equals entitlements ${after.entitlement_total}.\n`);
}

async function main() {
  const version = spawnSync(ckbBin, ['--version'], { encoding: 'utf8' });
  if (version.status !== 0 || !/0\.210\.0/.test(version.stdout + version.stderr)) throw new Error('CKB binary must report version 0.210.0');
  try {
    await rpc('get_tip_header');
    throw new Error(`RPC ${rpcUrl} is already serving a chain; stop it before this fresh-chain run`);
  } catch (error) {
    if (/already serving/.test(error.message)) throw error;
  }

  const key = randomPrivateKey();
  const runnerEnv = {
    ...process.env,
    TRADE_GATE2_OWNER_TARGET: '1024',
    TRADE_GATE2_RECOVERY_OWNER_ROLE: '4',
    TRADE_GATE2_RECOVERY_OWNER_PRIVATE_KEY: key,
    TRADE_KEEP_NATIVE_NODE: '1',
  };
  const build = spawnSync('cargo', ['build', '--release', '--locked', '--offline', '--manifest-path', path.join(recoveryDir, 'Cargo.toml')], { cwd: repoRoot, env: runnerEnv, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('independent recovery verifier build failed');

  const runner = spawn(process.execPath, [runnerPath], { cwd: repoRoot, env: runnerEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let evidenceDir = null, lineBuffer = '', recoveryTask = null, recoveryError = null;
  runner.stdout.on('data', chunk => {
    const text = chunk.toString();
    process.stdout.write(text);
    lineBuffer += text;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('Evidence ')) {
        evidenceDir = line.slice('Evidence '.length).trim();
        recoveryTask = recoverScale(evidenceDir, key, runnerEnv).catch(error => {
          recoveryError = error;
        }).finally(() => stopRunnerNode(evidenceDir));
      }
    }
  });
  runner.stderr.on('data', chunk => process.stderr.write(chunk));
  const exitCode = await new Promise((resolve, reject) => {
    runner.on('error', reject);
    runner.on('close', resolve);
  });
  if (recoveryTask) await recoveryTask;
  stopRunnerNode(evidenceDir);
  if (exitCode !== 0) throw new Error(`1,024-owner native runner exited ${exitCode}`);
  if (recoveryError) throw recoveryError;
  if (!evidenceDir || !fs.existsSync(path.join(evidenceDir, 'recovery-acceptance.json'))) throw new Error('1,024-owner recovery did not produce acceptance evidence');
  process.stdout.write(`${path.join(evidenceDir, 'recovery-acceptance.json')}\n`);
  delete process.env.TRADE_GATE2_RECOVERY_OWNER_PRIVATE_KEY;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
