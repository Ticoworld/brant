#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

if (!process.env.TRADE_NATIVE_ROOT) throw new Error('TRADE_NATIVE_ROOT is required');
if (!process.env.CKB_BIN) throw new Error('CKB_BIN is required');
if (!process.env.TRADE_GATE2_BUILD_DIR) throw new Error('TRADE_GATE2_BUILD_DIR is required');
if (!process.env.TRADE_GATE2_CHAIN_ROOT) throw new Error('TRADE_GATE2_CHAIN_ROOT must be a durable path');

const C = require(path.join(process.env.TRADE_NATIVE_ROOT, 'src', 'lib.cjs'));
const sdk = require(path.join(process.env.TRADE_NATIVE_ROOT, 'node_modules', '@nervosnetwork', 'ckb-sdk-utils'));
const names = ['marker_candidate', 'market_smt', 'owner_lineage_candidate', 'custody_smt', 'custody_marker'];
const root = path.resolve(__dirname, '..');
let child;
let nodeFd;
let rpcSequence = 0;

function readEvents(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function originalGenesis(sourceDir, expectedHash) {
  const rpcPath = path.join(sourceDir, 'rpc.jsonl');
  for (const line of fs.readFileSync(rpcPath, 'utf8').split('\n')) {
    if (!line) continue;
    const entry = JSON.parse(line);
    if (entry.method !== 'get_block_by_number' || entry.params?.[0] !== '0x0') continue;
    const block = entry.response?.result;
    assert.equal(block?.header?.hash?.toLowerCase(), expectedHash.toLowerCase(),
      'preserved genesis RPC response differs from the native run summary');
    const data = block.transactions?.[0]?.outputs_data?.[0];
    assert.match(data || '', /^0x(?:[0-9a-f]{2})+$/i, 'genesis cell message is missing or malformed');
    const message = Buffer.from(data.slice(2), 'hex').toString('utf8');
    assert.match(message, /^\d+$/, 'genesis cell message is not the generated decimal dev-chain message');
    return { rpcPath, block, data, message };
  }
  throw new Error('source RPC evidence does not contain the genesis block response');
}

async function rpc(out, method, params = []) {
  const response = await fetch('http://127.0.0.1:19224', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcSequence, method, params }),
  });
  const body = await response.json();
  fs.appendFileSync(path.join(out, 'rpc.jsonl'), `${JSON.stringify({ method, params, response: body })}\n`);
  if (!response.ok || body.error) throw new Error(`${method} failed: ${JSON.stringify(body.error || body)}`);
  return body.result;
}

async function main() {
  if (process.argv.length !== 4) {
    throw new Error('Usage: node replay-native-events.cjs <completed-native-run-dir> <new-evidence-dir>');
  }
  const sourceDir = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3]);
  const sourceSummary = JSON.parse(fs.readFileSync(path.join(sourceDir, 'summary.json'), 'utf8'));
  assert.equal(sourceSummary.owners, 1024);
  assert.equal(sourceSummary.fullSellDown, true);
  const sourceEventsPath = path.join(sourceDir, 'events.jsonl');
  const sourceEvents = readEvents(sourceEventsPath);
  assert(sourceEvents.length > 1000, 'source log is missing the full-scale lifecycle');
  const sourceGenesis = originalGenesis(sourceDir, sourceSummary.genesis);
  fs.mkdirSync(out, { recursive: false });
  const chainRoot = path.resolve(process.env.TRADE_GATE2_CHAIN_ROOT);
  fs.mkdirSync(chainRoot, { recursive: true });
  const chain = fs.mkdtempSync(path.join(chainRoot, 'trade-gate2-replay-')) + path.sep + 'chain';
  fs.mkdirSync(path.dirname(chain), { recursive: true });

  const ckbVersion = spawnSync(process.env.CKB_BIN, ['--version'], { encoding: 'utf8' });
  assert.equal(ckbVersion.status, 0, ckbVersion.stderr);
  assert.match(ckbVersion.stdout + ckbVersion.stderr, /0\.210\.0/);
  const setup = spawnSync(process.execPath, [path.join(C.ROOT, 'src', 'setup.cjs'), chain], {
    encoding: 'utf8', env: { ...process.env, CKB_BIN: process.env.CKB_BIN },
  });
  assert.equal(setup.status, 0, `${setup.stderr}\n${setup.stdout}`);

  let spec = fs.readFileSync(path.join(chain, 'specs', 'dev.toml'), 'utf8');
  const genesisMessagePattern = /(\[genesis\.genesis_cell\]\r?\nmessage = ")[^\"]+("\r?\n)/;
  assert(genesisMessagePattern.test(spec), 'native CKB template lacks the generated genesis cell message');
  spec = spec.replace(genesisMessagePattern, `$1${sourceGenesis.message}$2`);
  assert(spec.includes('[genesis.system_cells_lock]'), 'native CKB template lacks the expected system cell section');
  let genesisCells = '';
  for (const name of names) {
    const binary = path.join(process.env.TRADE_GATE2_BUILD_DIR, name);
    fs.copyFileSync(binary, path.join(chain, name));
    genesisCells += `[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n\n`;
  }
  spec = spec.replace('[genesis.system_cells_lock]', `${genesisCells}[genesis.system_cells_lock]`);
  fs.writeFileSync(path.join(chain, 'specs', 'dev.toml'), spec);

  nodeFd = fs.openSync(path.join(out, 'node.log'), 'w');
  child = spawn(process.env.CKB_BIN, ['run', '-C', chain, '--ba-advanced'], {
    stdio: ['ignore', nodeFd, nodeFd],
  });
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      await rpc(out, 'get_tip_header');
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert(ready, 'fresh private CKB node did not become ready');
  const genesis = await rpc(out, 'get_block_by_number', ['0x0']);
  assert.equal(genesis.header.hash.toLowerCase(), sourceSummary.genesis.toLowerCase(),
    'fresh replay genesis differs from the original signed transaction lineage');
  const genesisReplay = {
    source_genesis_hash: sourceSummary.genesis,
    replay_genesis_hash: genesis.header.hash,
    source_genesis_transaction_0_hash: sourceGenesis.block.transactions[0].hash,
    replay_genesis_transaction_0_hash: genesis.transactions[0].hash,
    source_genesis_cell_data: sourceGenesis.data,
    replay_genesis_cell_data: genesis.transactions[0].outputs_data[0],
    source_genesis_message: sourceGenesis.message,
    source_rpc_log_sha256: sha256(sourceGenesis.rpcPath),
    source_genesis_rpc_response_sha256: crypto.createHash('sha256').update(JSON.stringify(sourceGenesis.block)).digest('hex'),
    exact_genesis_match: true,
  };
  assert.equal(genesisReplay.source_genesis_transaction_0_hash.toLowerCase(),
    genesisReplay.replay_genesis_transaction_0_hash.toLowerCase());
  assert.equal(genesisReplay.source_genesis_cell_data.toLowerCase(),
    genesisReplay.replay_genesis_cell_data.toLowerCase());
  fs.writeFileSync(path.join(out, 'genesis-replay.json'), `${JSON.stringify(genesisReplay, null, 2)}\n`);
  for (let i = 0; i < 12; i++) await rpc(out, 'generate_block');

  const events = [];
  for (const source of sourceEvents) {
    const txHash = C.U.rawTransactionToHash(source.tx).toLowerCase();
    assert.equal(txHash, source.hash.toLowerCase(), `${source.label} signed transaction hash changed`);
    const cycles = await rpc(out, 'estimate_cycles', [C.snake(source.tx)]);
    const sentHash = await rpc(out, 'send_transaction', [C.snake(source.tx), 'passthrough']);
    assert.equal(sentHash.toLowerCase(), txHash, `${source.label} node transaction hash differs`);
    let committed;
    for (let attempt = 0; attempt < 30; attempt++) {
      await rpc(out, 'generate_block');
      committed = await rpc(out, 'get_transaction', [txHash]);
      if (committed?.tx_status?.status === 'committed') break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(committed?.tx_status?.status, 'committed', `${source.label} did not commit on the fresh node`);
    events.push({ label: source.label, hash: txHash, cycles, tx: source.tx, committed });
    fs.appendFileSync(path.join(out, 'events.jsonl'), `${JSON.stringify(events[events.length - 1])}\n`);
  }

  const tip = await rpc(out, 'get_tip_header');
  const summary = {
    ...sourceSummary,
    out,
    chain,
    genesis: genesis.header.hash,
    tip: tip.hash,
    replay_of: {
      source_native_run: path.basename(sourceDir),
      source_event_count: sourceEvents.length,
      source_events_sha256: sha256(sourceEventsPath),
      source_genesis_rpc_log_sha256: sha256(sourceGenesis.rpcPath),
      committed_to_fresh_ckb_node: true,
      canonical_history_must_be_refetched_from_rpc: true,
    },
  };
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    result: 'PASS', ckb_version: '0.210.0', source_transactions: sourceEvents.length,
    replayed_transactions: events.length, same_genesis: true, chain, tip: tip.hash,
    output: out,
  }, null, 2)}\n`);

  if (process.env.TRADE_KEEP_NATIVE_NODE === '1') {
    fs.writeFileSync(path.join(out, 'node.pid'), `${child.pid}\n`);
    const stopFile = path.join(out, 'stop-node');
    while (!fs.existsSync(stopFile)) await new Promise(resolve => setTimeout(resolve, 500));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  if (child) child.kill();
  if (nodeFd !== undefined) fs.closeSync(nodeFd);
});
