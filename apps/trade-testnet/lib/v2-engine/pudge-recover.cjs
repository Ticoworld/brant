#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FEE_LIMIT = 1000000n;
const UNIT = 100000000n;
const RECOVERY_KEY_ENV = 'TRADE_RECOVERY_PRIVATE_KEY';
const RPC_LOG_ENV = 'TRADE_RECOVERY_RPC_LOG';
const RPC_TIMEOUT_ENV = 'ROVEKO_RECOVERY_RPC_TIMEOUT_MS';
const RPC_MAX_ENV = 'ROVEKO_RECOVERY_MAX_RPC';
const SECP_CODE_HASH = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
let rpcRequests = 0;

function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) fail(`unexpected argument ${key}`);
    if (key === '--help') { out.help = true; continue; }
    if (key === '--mine') { out.mine = true; continue; }
    const value = argv[++i]; if (!value || value.startsWith('--')) fail(`missing value for ${key}`);
    out[key.slice(2)] = value;
  }
  return out;
}
function usage() {
  return `Trade V2 independent custody recovery (experimental)\n\n`+
    `Collect canonical chain history and verify it:\n`+
    `  node recover.cjs collect --node http://127.0.0.1:8114 --indexer http://127.0.0.1:8116 \\\n`+
    `    --init 0x<tx-hash> --owner 0x<lock-hash> --custody-lock custody-lock.json \\\n`+
    `    --xudt-type xudt-type.json --out recovery-bundle.json\n\n`+
    `The CLI needs independent full-node transaction retrieval plus an indexer with full\n`+
    `history for the exact custody lock script. It reads no Trade service or private DB.\n\n`+
    `Without an indexer, scan every canonical full block from initialization to tip:\n`+
    `  node recover.cjs collect-blocks --node http://127.0.0.1:8114 --init 0x<tx-hash> \\\n`+
    `    --owner 0x<lock-hash> --custody-lock custody-lock.json --xudt-type xudt-type.json \\\n`+
    `    --max-blocks 100000 --out recovery-bundle.json\n\n`+
    `Authorize, broadcast, and verify a withdrawal from a replayable bundle:\n`+
    `  TRADE_RECOVERY_PRIVATE_KEY=0x<disposable-key> node recover.cjs withdraw \\\n`+
    `    --node http://127.0.0.1:8114 --bundle recovery-bundle.json \\\n`+
    `    --out withdrawal.json [--funding-outpoint 0x<tx-hash>:0x<index>] [--mine]\n`+
    `  node recover.cjs verify-withdrawal --node http://127.0.0.1:8114 --report withdrawal.json\n`+
    `The default funding search scans a bounded canonical full-block history from genesis.\n`;
}
function h256(value, field) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) fail(`${field} must be a 32-byte 0x hash`);
}
function qhex(v, field) {
  if (typeof v !== 'string' || !/^0x[0-9a-f]+$/i.test(v)) fail(`${field} is not an RPC hex quantity`);
  return BigInt(v);
}
async function rpc(url, method, params = []) {
  const maxRequests = Number(process.env[RPC_MAX_ENV] || 5000);
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 10000 || ++rpcRequests > maxRequests) fail('recovery RPC request limit exceeded');
  const timeoutMs = Number(process.env[RPC_TIMEOUT_ENV] || 15000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 15000) fail('recovery RPC timeout is invalid');
  let response;
  try {
    response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (process.env[RPC_LOG_ENV]) fs.appendFileSync(path.resolve(process.env[RPC_LOG_ENV]), `${JSON.stringify({ method, params, transport_error: String(error) })}\n`);
    throw error;
  }
  if (!response.ok) {
    const text = await response.text();
    if (process.env[RPC_LOG_ENV]) fs.appendFileSync(path.resolve(process.env[RPC_LOG_ENV]), `${JSON.stringify({ method, params, http_status: response.status, body: text })}\n`);
    fail(`${method}: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (process.env[RPC_LOG_ENV]) fs.appendFileSync(path.resolve(process.env[RPC_LOG_ENV]), `${JSON.stringify({ method, params, response: body })}\n`);
  if (body.error) fail(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}
function scriptKey(script, scriptType, filter, withData = false) {
  return { script, script_type: scriptType, script_search_mode: 'exact', ...(withData ? { with_data: true } : {}), ...(filter ? { filter } : {}) };
}
async function indexedHistory(indexer, custodyLock, xudtType, { maxPages = 64, maxTransactions = 2048 } = {}) {
  const result = [];
  const seen = new Map();
  let cursor;
  for (let pageNo = 0; pageNo < maxPages; pageNo++) {
    const params = [scriptKey(custodyLock, 'lock'), 'asc', '0x64'];
    if (cursor) params.push(cursor);
    const page = await rpc(indexer, 'get_transactions', params);
    if (!Array.isArray(page?.objects)) fail('get_transactions returned no objects array');
    for (const row of page.objects) {
      if (!row.tx_hash || !row.block_number || !row.tx_index) fail('indexer transaction row lacks tx_hash/block_number/tx_index');
      const key = row.tx_hash.toLowerCase();
      const candidate = { tx_hash: row.tx_hash, block_number: row.block_number, tx_index: row.tx_index };
      const old = seen.get(key);
      if (old && (old.block_number !== candidate.block_number || old.tx_index !== candidate.tx_index)) fail(`indexer reports conflicting position for ${row.tx_hash}`);
      if (!old) {
        seen.set(key, candidate);
        if (seen.size > maxTransactions) fail(`indexer history exceeds ${maxTransactions} transactions`);
      }
    }
    if (page.objects.length < 100) break;
    if (!page.last_cursor || page.last_cursor === cursor) fail('indexer pagination cursor did not advance');
    cursor = page.last_cursor;
    if (pageNo === maxPages - 1) fail(`indexer history exceeds ${maxPages} pages`);
  }
  result.push(...seen.values());
  result.sort((a, b) => {
    const block = qhex(a.block_number, 'block_number') - qhex(b.block_number, 'block_number');
    if (block !== 0n) return block < 0n ? -1 : 1;
    const tx = qhex(a.tx_index, 'tx_index') - qhex(b.tx_index, 'tx_index');
    return tx < 0n ? -1 : tx > 0n ? 1 : a.tx_hash.localeCompare(b.tx_hash);
  });
  return result;
}
function sameScript(a, b) {
  return !!a && !!b &&
    String(a.code_hash || '').toLowerCase() === String(b.code_hash || '').toLowerCase() &&
    String(a.hash_type || '').toLowerCase() === String(b.hash_type || '').toLowerCase() &&
    String(a.args || '').toLowerCase() === String(b.args || '').toLowerCase();
}
function pointKey(point) {
  return `${String(point.tx_hash || '').toLowerCase()}:${qhex(point.index, 'outpoint index').toString()}`;
}
function hasInputPoint(tx, point) {
  const expected = pointKey(point);
  return Array.isArray(tx.inputs) && tx.inputs.some((input) => pointKey(input.previous_output) === expected);
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sameRawTransaction(a, b) {
  const fields = ['version', 'cell_deps', 'header_deps', 'inputs', 'outputs', 'outputs_data', 'witnesses'];
  const normalized = (tx, field) => {
    const value = tx?.[field];
    if (field !== 'outputs' || !Array.isArray(value)) return value;
    return value.map((output) => {
      if (!output || output.type !== null) return output;
      const copy = { ...output };
      delete copy.type;
      return copy;
    });
  };
  return fields.every((field) => canonicalJson(normalized(a, field)) === canonicalJson(normalized(b, field)));
}
function fullTransactionHash(tx) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx?.hash || '')) fail('block transaction lacks a valid transaction hash');
  return tx.hash.toLowerCase();
}
async function canonicalBlock(node, number) {
  let block, error;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { block = await rpc(node, 'get_block_by_number', [`0x${number.toString(16)}`]); break; }
    catch (e) { error = e; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250)); }
  }
  if (!block && error) fail(`block ${number} unavailable after 3 attempts: ${error.message}`);
  if (!block?.header?.hash || !Array.isArray(block.transactions)) fail(`full node omitted canonical block body at ${number}`);
  if (qhex(block.header.number, 'block header number') !== number) fail(`full node returned the wrong block height for ${number}`);
  h256(block.header.hash, 'block hash');
  return block;
}
function nextCustodyPoints(tx, txHash, custodyLock, xudtType) {
  const out = Array.isArray(tx.outputs) ? tx.outputs : [];
  const assets = []; const markers = [];
  out.forEach((output, index) => {
    if (!sameScript(output.lock, custodyLock)) return;
    const point = { tx_hash: txHash, index: `0x${index.toString(16)}` };
    if (sameScript(output.type, xudtType)) assets.push(point);
    else markers.push(point);
  });
  return { assets, markers };
}
async function verifyBundleFile(manifest) {
  const verifier = path.join(__dirname, 'target', 'release', process.platform === 'win32' ? 'trade-v2-recovery.exe' : 'trade-v2-recovery');
  const alternate = path.join(__dirname, 'target', 'release', process.platform === 'win32' ? 'trade-v2-recovery' : 'trade-v2-recovery.exe');
  const binary = process.env.ROVEKO_PROOF_BINARY || (fs.existsSync(verifier) ? verifier : alternate);
  if (!fs.existsSync(binary)) fail('build verifier first: cargo build --release --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml');
  const replay = spawnSync(binary, ['replay', manifest, `${manifest}.result.json`], { stdio: 'inherit' });
  if (replay.error) throw replay.error;
  if (replay.status !== 0) fail(`independent transition replay exited ${replay.status}`);
  process.stdout.write(`${manifest}.result.json\n`);
}
function replayBundleFile(manifest) {
  const verifier = path.join(__dirname, 'target', 'release', process.platform === 'win32' ? 'trade-v2-recovery.exe' : 'trade-v2-recovery');
  const alternate = path.join(__dirname, 'target', 'release', process.platform === 'win32' ? 'trade-v2-recovery' : 'trade-v2-recovery.exe');
  const binary = fs.existsSync(verifier) ? verifier : alternate;
  if (!fs.existsSync(binary)) fail('build verifier first: cargo build --release --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml');
  const replay = spawnSync(binary, ['replay', manifest, '-'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (replay.error) throw replay.error;
  if (replay.status !== 0) fail(`independent transition replay exited ${replay.status}: ${replay.stderr || ''}`);
  return JSON.parse(replay.stdout);
}
async function collect(args) {
  for (const k of ['node', 'indexer', 'init', 'owner', 'custody-lock', 'xudt-type', 'out']) if (!args[k]) fail(`missing --${k}`);
  h256(args.init, 'init tx hash'); h256(args.owner, 'owner lock hash');
  const custodyLock = JSON.parse(fs.readFileSync(args['custody-lock'], 'utf8'));
  const xudtType = JSON.parse(fs.readFileSync(args['xudt-type'], 'utf8'));
  if (!custodyLock || !xudtType) fail('script JSON files must contain a Script object');
  const custodyArgs = Buffer.from((custodyLock.args || '').replace(/^0x/, ''), 'hex');
  if (custodyArgs.length !== 128) fail('custody lock args must contain 128 bytes');
  if (!/^0x[0-9a-fA-F]{64}$/.test(custodyLock.code_hash || '') || !['data', 'data1', 'data2', 'type'].includes(custodyLock.hash_type)) fail('invalid custody lock Script');
  const startTip = await rpc(args.node, 'get_tip_header');
  let indexerTip;
  for (let attempt = 0; attempt < 5; attempt++) {
    indexerTip = await rpc(args.indexer, 'get_indexer_tip');
    if (indexerTip && qhex(indexerTip.block_number, 'indexer tip') >= qhex(startTip.number, 'node tip')) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!indexerTip || qhex(indexerTip.block_number, 'indexer tip') < qhex(startTip.number, 'node tip')) fail('indexer is not caught up to the captured canonical tip');
  if (qhex(indexerTip.block_number, 'indexer tip') === qhex(startTip.number, 'node tip') && indexerTip.block_hash?.toLowerCase() !== startTip.hash.toLowerCase()) fail('indexer tip differs from canonical tip');
  const indexerCanonical = await canonicalBlock(args.node, qhex(indexerTip.block_number, 'indexer tip'));
  if (indexerCanonical.header.hash.toLowerCase() !== indexerTip.block_hash?.toLowerCase()) fail('indexer tip is not canonical');
  const maxPages = args['max-pages'] ? Number(args['max-pages']) : 64;
  const maxTransactions = args['max-transactions'] ? Number(args['max-transactions']) : 2048;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 64) fail('--max-pages must be an integer in 1..=64');
  if (!Number.isSafeInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 2048) fail('--max-transactions must be an integer in 1..=2048');
  const history = await indexedHistory(args.indexer, custodyLock, xudtType, { maxPages, maxTransactions });
  const initIndex = history.findIndex((x) => x.tx_hash.toLowerCase() === args.init.toLowerCase());
  if (initIndex < 0) fail('initialization transaction was not found in exact-script indexer history');
  const historyRows = [];
  for (const entry of history.slice(initIndex)) {
    const response = await rpc(args.node, 'get_transaction', [entry.tx_hash]);
    if (response?.tx_status?.status !== 'committed' || !response.transaction) fail(`full node cannot retrieve committed transaction ${entry.tx_hash}`);
    const statusBlock = qhex(response.tx_status.block_number, 'transaction block number');
    if (statusBlock !== qhex(entry.block_number, 'indexer block number')) fail(`indexer/full-node block mismatch for ${entry.tx_hash}`);
    const block = await rpc(args.node, 'get_block_by_number', [entry.block_number]);
    const blockHash = block?.header?.hash;
    if (!blockHash || blockHash.toLowerCase() !== response.tx_status.block_hash.toLowerCase()) fail(`transaction ${entry.tx_hash} is not canonical at indexed height`);
    const txIndex = Number(qhex(entry.tx_index, 'transaction index'));
    if (!Number.isSafeInteger(txIndex) || fullTransactionHash(block.transactions?.[txIndex]) !== entry.tx_hash.toLowerCase() || !sameRawTransaction(block.transactions[txIndex], response.transaction)) fail(`indexed transaction ${entry.tx_hash} is absent or differs in its canonical block`);
    historyRows.push({ ...entry, transaction: response.transaction });
  }
  const cellPage = await rpc(args.indexer, 'get_cells', [scriptKey(custodyLock, 'lock', { script: xudtType }, true), 'asc', '0x64']);
  if (!Array.isArray(cellPage?.objects) || cellPage.objects.length !== 1) fail(`expected one live custody xUDT cell, found ${cellPage?.objects?.length ?? 'no response'}`);
  const indexedCell = cellPage.objects[0];
  const live = await rpc(args.node, 'get_live_cell', [indexedCell.out_point, true]);
  if (live?.status !== 'live' || !live.cell?.output || !live.cell?.data?.content) fail('full node does not confirm indexer custody output is live');
  const endTip = await rpc(args.node, 'get_tip_header');
  const indexerEnd = await rpc(args.indexer, 'get_indexer_tip');
  if (!indexerEnd || qhex(indexerEnd.block_number, 'indexer tip') < qhex(startTip.number, 'captured tip')) fail('indexer tip regressed during collection');
  const startTipAtEnd = await rpc(args.node, 'get_block_by_number', [startTip.number]);
  if (startTipAtEnd?.header?.hash?.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical chain changed during collection; retry against a stable tip');
  const livePoint = indexedCell.out_point;
  const bundle = {
    format: 'trade-v2-recovery-bundle-v1',
    init_tx_hash: args.init,
    owner_lock_hash: args.owner,
    custody_lock: custodyLock,
    xudt_type_script: xudtType,
    collection: {
      node_url: args.node,
      indexer_url: args.indexer,
      start_tip: { number: startTip.number, hash: startTip.hash },
      end_tip: { number: endTip.number, hash: endTip.hash },
      historical_transactions: historyRows.length,
      indexed_transactions: history.length,
      canonical_block_checked: true,
      live_outpoint_checked_with_get_live_cell: true,
    },
    history: historyRows,
    live: {
      tx_hash: livePoint.tx_hash,
      index: livePoint.index,
      capacity: live.cell.output.capacity,
      data: live.cell.data.content,
      output: live.cell.output,
    },
  };
  fs.writeFileSync(args.out, JSON.stringify(bundle, null, 2) + '\n');
  process.stderr.write(`Fetched ${historyRows.length} committed custody transitions; live cell ${livePoint.tx_hash}:${livePoint.index}.\n`);
  const manifest = path.resolve(args.out);
  await verifyBundleFile(manifest);
}
async function collectIncremental(args) {
  for (const k of ['node', 'indexer', 'init', 'owner', 'custody-lock', 'xudt-type', 'checkpoint', 'out']) if (!args[k]) fail(`missing --${k}`);
  h256(args.init, 'init tx hash'); h256(args.owner, 'owner lock hash');
  const custodyLock = JSON.parse(fs.readFileSync(args['custody-lock'], 'utf8'));
  const xudtType = JSON.parse(fs.readFileSync(args['xudt-type'], 'utf8'));
  const previous = JSON.parse(fs.readFileSync(args.checkpoint, 'utf8'));
  if (previous.format !== 'trade-v2-recovery-bundle-v1' || previous.init_tx_hash?.toLowerCase() !== args.init.toLowerCase() || previous.owner_lock_hash?.toLowerCase() !== args.owner.toLowerCase() || !sameScript(previous.custody_lock, custodyLock) || !sameScript(previous.xudt_type_script, xudtType) || !Array.isArray(previous.history) || !previous.history.length || !previous.collection?.canonical_block_checked) fail('checkpoint identity or verification state is invalid');
  if (!previous.collection.end_tip?.number || !previous.collection.end_tip?.hash || !/^0x[0-9a-fA-F]{64}$/.test(previous.collection.end_tip.hash)) fail('checkpoint chain anchor is missing');
  const maxPages = args['max-pages'] ? Number(args['max-pages']) : 64;
  const maxTransactions = args['max-transactions'] ? Number(args['max-transactions']) : 2048;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 64) fail('--max-pages must be an integer in 1..=64');
  if (!Number.isSafeInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 2048) fail('--max-transactions must be an integer in 1..=2048');
  const startTip = await rpc(args.node, 'get_tip_header');
  const checkpointAnchor = await rpc(args.node, 'get_block_hash', [previous.collection.end_tip.number]);
  if (typeof checkpointAnchor !== 'string' || checkpointAnchor.toLowerCase() !== previous.collection.end_tip.hash.toLowerCase()) fail('checkpoint chain anchor is no longer canonical');
  let indexerTip;
  for (let attempt = 0; attempt < 5; attempt++) {
    indexerTip = await rpc(args.indexer, 'get_indexer_tip');
    if (indexerTip && qhex(indexerTip.block_number, 'indexer tip') >= qhex(startTip.number, 'node tip')) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!indexerTip || qhex(indexerTip.block_number, 'indexer tip') < qhex(startTip.number, 'node tip')) fail('indexer is not caught up to the captured canonical tip');
  if (qhex(indexerTip.block_number, 'indexer tip') === qhex(startTip.number, 'node tip') && indexerTip.block_hash?.toLowerCase() !== startTip.hash.toLowerCase()) fail('indexer tip differs from canonical tip');
  const indexerCanonical = await canonicalBlock(args.node, qhex(indexerTip.block_number, 'indexer tip'));
  if (indexerCanonical.header.hash.toLowerCase() !== indexerTip.block_hash?.toLowerCase()) fail('indexer tip is not canonical');
  const history = await indexedHistory(args.indexer, custodyLock, xudtType, { maxPages, maxTransactions });
  const initIndex = history.findIndex((x) => x.tx_hash.toLowerCase() === args.init.toLowerCase());
  if (initIndex < 0) fail('initialization transaction was not found in exact-script indexer history');
  const refs = history.slice(initIndex);
  if (previous.history.length > refs.length) fail('checkpoint history is ahead of the canonical indexer');
  for (let index = 0; index < previous.history.length; index++) {
    const old = previous.history[index], current = refs[index];
    if (old.tx_hash?.toLowerCase() !== current.tx_hash.toLowerCase() || qhex(old.block_number, 'checkpoint block number') !== qhex(current.block_number, 'indexer block number') || qhex(old.tx_index, 'checkpoint transaction index') !== qhex(current.tx_index, 'indexer transaction index')) fail('checkpoint history conflicts with canonical indexer history');
  }
  const additions = refs.slice(previous.history.length);
  if (additions.length > 256) fail('checkpoint successor batch exceeds 256 transactions');
  const appended = [];
  for (const entry of additions) {
    const response = await rpc(args.node, 'get_transaction', [entry.tx_hash]);
    if (response?.tx_status?.status !== 'committed' || !response.transaction) fail(`full node cannot retrieve committed transaction ${entry.tx_hash}`);
    if (qhex(response.tx_status.block_number, 'committed block number') !== qhex(entry.block_number, 'indexer block number')) fail(`indexer/full-node block mismatch for ${entry.tx_hash}`);
    const block = await rpc(args.node, 'get_block_by_number', [entry.block_number]);
    if (!block?.header?.hash || block.header.hash.toLowerCase() !== response.tx_status.block_hash.toLowerCase()) fail(`transaction ${entry.tx_hash} is not canonical at indexed height`);
    const txIndex = Number(qhex(entry.tx_index, 'transaction index'));
    if (!Number.isSafeInteger(txIndex) || fullTransactionHash(block.transactions?.[txIndex]) !== entry.tx_hash.toLowerCase() || !sameRawTransaction(block.transactions[txIndex], response.transaction)) fail(`indexed transaction ${entry.tx_hash} is absent or differs in its canonical block`);
    appended.push({ ...entry, transaction: response.transaction });
  }
  const cellPage = await rpc(args.indexer, 'get_cells', [scriptKey(custodyLock, 'lock', { script: xudtType }, true), 'asc', '0x64']);
  if (!Array.isArray(cellPage?.objects) || cellPage.objects.length !== 1) fail(`expected one live custody xUDT cell, found ${cellPage?.objects?.length ?? 'no response'}`);
  const indexedCell = cellPage.objects[0], live = await rpc(args.node, 'get_live_cell', [indexedCell.out_point, true]);
  if (live?.status !== 'live' || !live.cell?.output || !live.cell?.data?.content) fail('full node does not confirm indexer custody output is live');
  const endTip = await rpc(args.node, 'get_tip_header');
  const indexerEnd = await rpc(args.indexer, 'get_indexer_tip');
  if (!indexerEnd || qhex(indexerEnd.block_number, 'indexer tip') < qhex(startTip.number, 'captured tip')) fail('indexer tip regressed during collection');
  const startTipAtEnd = await rpc(args.node, 'get_block_by_number', [startTip.number]);
  if (startTipAtEnd?.header?.hash?.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical chain changed during incremental collection; retry');
  const bundle = {
    ...previous,
    collection: {
      ...previous.collection,
      node_url: args.node,
      indexer_url: args.indexer,
      start_tip: { number: startTip.number, hash: startTip.hash },
      end_tip: { number: endTip.number, hash: endTip.hash },
      historical_transactions: previous.history.length + appended.length,
      indexed_transactions: history.length,
      canonical_block_checked: true,
      live_outpoint_checked_with_get_live_cell: true,
    },
    history: [...previous.history, ...appended],
    live: {
      tx_hash: indexedCell.out_point.tx_hash,
      index: indexedCell.out_point.index,
      capacity: live.cell.output.capacity,
      data: live.cell.data.content,
      output: live.cell.output,
    },
  };
  fs.writeFileSync(args.out, JSON.stringify(bundle, null, 2) + '\n');
  process.stderr.write(`Reused ${previous.history.length} verified transitions and appended ${appended.length}; live cell ${bundle.live.tx_hash}:${bundle.live.index}.\n`);
  await verifyBundleFile(path.resolve(args.out));
}
async function collectBlocks(args) {
  for (const k of ['node', 'init', 'owner', 'custody-lock', 'xudt-type', 'out']) if (!args[k]) fail(`missing --${k}`);
  h256(args.init, 'init tx hash'); h256(args.owner, 'owner lock hash');
  const custodyLock = JSON.parse(fs.readFileSync(args['custody-lock'], 'utf8'));
  const xudtType = JSON.parse(fs.readFileSync(args['xudt-type'], 'utf8'));
  const lockArgs = Buffer.from(String(custodyLock.args || '').replace(/^0x/, ''), 'hex');
  if (lockArgs.length !== 128) fail('custody lock args must contain 128 bytes');
  if (!/^0x[0-9a-fA-F]{64}$/.test(custodyLock.code_hash || '') || !['data', 'data1', 'data2', 'type'].includes(custodyLock.hash_type)) fail('invalid custody lock Script');
  const maxBlocks = args['max-blocks'] ? Number(args['max-blocks']) : 100000;
  const maxTransitions = args['max-transitions'] ? Number(args['max-transitions']) : 10000;
  if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 1000000) fail('--max-blocks must be an integer in 1..=1000000');
  if (!Number.isSafeInteger(maxTransitions) || maxTransitions < 1 || maxTransitions > 100000) fail('--max-transitions must be an integer in 1..=100000');
  const startTip = await rpc(args.node, 'get_tip_header');
  const tipHeight = qhex(startTip.number, 'tip block number');
  h256(startTip.hash, 'tip block hash');
  const initResponse = await rpc(args.node, 'get_transaction', [args.init]);
  if (initResponse?.tx_status?.status !== 'committed' || !initResponse.transaction) fail('full node cannot retrieve the committed initialization transaction');
  const startHeight = qhex(initResponse.tx_status.block_number, 'initialization block number');
  if (startHeight > tipHeight) fail('initialization transaction is above the current full-node tip');
  const span = tipHeight - startHeight + 1n;
  if (span > BigInt(maxBlocks)) fail(`initialization-to-tip range ${span} exceeds --max-blocks ${maxBlocks}; increase the explicit bound after confirming archival RPC capacity`);
  const initTxHash = args.init.toLowerCase();
  const initBlock = await canonicalBlock(args.node, startHeight);
  if (initBlock.header.hash.toLowerCase() !== initResponse.tx_status.block_hash.toLowerCase()) fail('initialization transaction block is not canonical');
  const initIndex = initBlock.transactions.findIndex((tx) => fullTransactionHash(tx) === initTxHash);
  if (initIndex < 0) fail('initialization transaction body is absent from its canonical block');
  if (!sameRawTransaction(initBlock.transactions[initIndex], initResponse.transaction)) fail('get_transaction body differs from the initialization block body');
  const initialPoints = nextCustodyPoints(initResponse.transaction, initTxHash, custodyLock, xudtType);
  if (initialPoints.assets.length !== 1 || initialPoints.markers.length !== 1) fail('initialization must create one custody xUDT output and one custody marker output');
  let assetPoint = initialPoints.assets[0];
  let markerPoint = initialPoints.markers[0];
  const rows = [];
  const candidateBlocks = new Map([[startHeight.toString(), initBlock.header.hash]]);
  let scannedBlocks = 0;
  let previousHash;
  for (let first = startHeight; first <= tipHeight; first += 8n) {
    const count = Number(tipHeight - first + 1n > 8n ? 8n : tipHeight - first + 1n);
    const blocks = await Promise.all(Array.from({length: count}, (_, i) => first + BigInt(i) === startHeight ? initBlock : canonicalBlock(args.node, first + BigInt(i))));
    for (let i = 0; i < blocks.length; i++) {
    const height = first + BigInt(i), block = blocks[i];
    h256(block.header.parent_hash, 'block parent hash');
    if (previousHash && block.header.parent_hash.toLowerCase() !== previousHash.toLowerCase()) fail(`discontinuous block history at ${height}`);
    previousHash = block.header.hash;
    scannedBlocks++;
    if (height === startHeight && block.transactions.findIndex((tx) => fullTransactionHash(tx) === initTxHash) !== initIndex) fail('initialization transaction index changed during scan');
    const txStart = height === startHeight ? initIndex : 0;
    for (let txIndex = txStart; txIndex < block.transactions.length; txIndex++) {
      const tx = block.transactions[txIndex];
      const hash = fullTransactionHash(tx);
      const points = nextCustodyPoints(tx, hash, custodyLock, xudtType);
      const isInit = hash === initTxHash;
      const spendsCurrent = hasInputPoint(tx, assetPoint) || hasInputPoint(tx, markerPoint);
      const createsCustody = Array.isArray(tx.outputs) && tx.outputs.some((o) => sameScript(o.lock, custodyLock));
      if (!isInit && !spendsCurrent && !createsCustody) continue;
      if (rows.length >= maxTransitions) fail(`custody transition count exceeds --max-transitions ${maxTransitions}`);
      const retrieved = await rpc(args.node, 'get_transaction', [hash]);
      if (retrieved?.tx_status?.status !== 'committed' || !retrieved.transaction) fail(`full node cannot retrieve committed candidate transaction ${hash}`);
      if (qhex(retrieved.tx_status.block_number, 'candidate block number') !== height || retrieved.tx_status.block_hash.toLowerCase() !== block.header.hash.toLowerCase()) fail(`candidate transaction ${hash} is not committed in the scanned canonical block`);
      if (!sameRawTransaction(tx, retrieved.transaction)) fail(`block body and get_transaction body differ for ${hash}`);
      rows.push({ tx_hash: hash, block_number: `0x${height.toString(16)}`, tx_index: `0x${txIndex.toString(16)}`, block_hash: block.header.hash, transaction: retrieved.transaction });
      if (points.assets.length === 1 && points.markers.length === 1) {
        assetPoint = points.assets[0]; markerPoint = points.markers[0];
      }
      candidateBlocks.set(height.toString(), block.header.hash);
    }
    if (height === tipHeight) break;
    }
  }
  if (previousHash?.toLowerCase() !== startTip.hash.toLowerCase()) fail('scanned history does not reach captured tip');
  if (!rows.length || rows[0].tx_hash !== initTxHash) fail('canonical scan did not produce initialization-first custody history');
  const canonicalTip = await canonicalBlock(args.node, tipHeight);
  if (canonicalTip.header.hash.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical tip changed during full-node scan; retry from a stable tip');
  for (const [heightText, oldHash] of candidateBlocks) {
    const fresh = await canonicalBlock(args.node, BigInt(heightText));
    if (fresh.header.hash.toLowerCase() !== oldHash.toLowerCase()) fail(`canonical history changed at block ${heightText}; retry`);
  }
  const live = await rpc(args.node, 'get_live_cell', [assetPoint, true]);
  if (live?.status !== 'live' || !live.cell?.output || !live.cell?.data?.content) fail('last reconstructed custody xUDT output is not live at the canonical tip');
  const finalPoint = { tx_hash: assetPoint.tx_hash, index: assetPoint.index };
  const bundle = {
    format: 'trade-v2-recovery-bundle-v1',
    init_tx_hash: args.init,
    owner_lock_hash: args.owner,
    custody_lock: custodyLock,
    xudt_type_script: xudtType,
    collection: {
      node_url: args.node,
      source: 'canonical-full-block-scan',
      start_tip: { number: startTip.number, hash: startTip.hash },
      end_tip: { number: startTip.number, hash: startTip.hash },
      initialization_height: `0x${startHeight.toString(16)}`,
      initialization_tx_index: `0x${initIndex.toString(16)}`,
      scanned_blocks: scannedBlocks,
      candidate_transactions: rows.length,
      max_blocks: maxBlocks,
      max_transitions: maxTransitions,
      canonical_candidate_block_hashes_checked: candidateBlocks.size,
      live_outpoint_checked_with_get_live_cell: true,
      indexer_used: false,
    },
    history: rows,
    live: {
      tx_hash: finalPoint.tx_hash,
      index: finalPoint.index,
      capacity: live.cell.output.capacity,
      data: live.cell.data.content,
      output: live.cell.output,
    },
  };
  fs.writeFileSync(args.out, JSON.stringify(bundle, null, 2) + '\n');
  process.stderr.write(`Scanned ${scannedBlocks} canonical blocks; collected ${rows.length} custody transitions without an indexer.\n`);
  await verifyBundleFile(path.resolve(args.out));
}

function camelScript(script) {
  return {
    codeHash: script.code_hash ?? script.codeHash,
    hashType: script.hash_type ?? script.hashType,
    args: script.args,
  };
}
function rpcSnake(value) {
  if (Array.isArray(value)) return value.map(rpcSnake);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const name = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
    const mapped = name === 'dep_type' && child === 'depGroup' ? 'dep_group' : child;
    return [name, rpcSnake(mapped)];
  }));
}
function rpcCamel(value) {
  if (Array.isArray(value)) return value.map(rpcCamel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const name = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    const mapped = name === 'depType' && child === 'dep_group' ? 'depGroup' : rpcCamel(child);
    return [name, mapped];
  }));
}
function loadSdk(args) {
  const repo = path.resolve(__dirname, '../../../../');
  const nativeRoot = path.resolve(args['sdk-root'] || path.join(repo, 'labs', 'rebuild', 'native'));
  try {
    return {
      utils: require(path.join(nativeRoot, 'node_modules', '@nervosnetwork', 'ckb-sdk-utils')),
      signGroup: require(path.join(nativeRoot, 'node_modules', '@nervosnetwork', 'ckb-sdk-core', 'lib', 'signWitnessGroup.js')).default,
    };
  } catch (error) {
    fail(`pinned SDK not found under ${nativeRoot}; pass --sdk-root to the pinned native SDK directory (${error.message})`);
  }
}
function ckbHashHex(utils, data) {
  const state = utils.blake2b(32, null, null, utils.PERSONAL);
  state.update(data);
  return `0x${state.digest('hex')}`;
}
function localRpcUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { fail('--node must be an HTTP URL'); }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!['http:', 'https:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    fail('withdraw is restricted to a localhost CKB RPC endpoint');
  }
  return parsed.toString();
}
function scriptHash(utils, script) { return utils.scriptToHash(camelScript(script)); }
function outPoint(txHash, index) { return { txHash: txHash.toLowerCase(), index: hexQuantity(index) }; }
function hexQuantity(value) { return `0x${BigInt(value).toString(16)}`; }
function parseOutpoint(value) {
  const m = /^(0x[0-9a-fA-F]{64}):(0x[0-9a-fA-F]+|[0-9]+)$/.exec(value || '');
  if (!m) fail('--funding-outpoint must be 0x<tx-hash>:<hex-or-decimal-index>');
  return { tx_hash: m[1].toLowerCase(), index: hexQuantity(BigInt(m[2])) };
}
function littleEndian(value, bytes) {
  let n = BigInt(value);
  const result = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) { result[i] = Number(n & 255n); n >>= 8n; }
  if (n !== 0n) fail(`integer does not fit in ${bytes} bytes`);
  return result;
}
function occupiedCapacity(lock, type, dataLength) {
  const lockArgs = Buffer.from(lock.args.slice(2), 'hex').length;
  const typeBytes = type ? 33 + Buffer.from(type.args.slice(2), 'hex').length : 0;
  return BigInt(8 + 33 + lockArgs + typeBytes + dataLength) * UNIT;
}
function scriptOutPointDep(txHash, index, depType = 'code') {
  return { outPoint: { txHash, index: hexQuantity(index) }, depType };
}
function txHashOf(utils, tx) { return utils.rawTransactionToHash(tx); }
async function requireLiveCell(node, point, label) {
  const response = await rpc(node, 'get_live_cell', [point, true]);
  if (response?.status !== 'live' || !response.cell?.output) fail(`${label} is not live at the CKB node`);
  return { output: response.cell.output, data: response.cell.data?.content || '0x' };
}
function exactCellOutput(a, b) { return canonicalJson(a) === canonicalJson(b); }
function sameCellOutput(a, b) {
  return qhex(a?.capacity, 'output capacity') === qhex(b?.capacity, 'output capacity') &&
    sameScript(a?.lock, b?.lock) &&
    ((!a?.type && !b?.type) || sameScript(a?.type, b?.type));
}
function privateOwnerLock(utils, privateKey) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey || '')) fail(`${RECOVERY_KEY_ENV} must contain a disposable 32-byte 0x private key`);
  const publicKey = utils.privateKeyToPublicKey(privateKey);
  return {
    codeHash: SECP_CODE_HASH,
    hashType: 'type',
    args: `0x${utils.blake160(publicKey, 'hex')}`,
  };
}
function codeCellDeps(utils, genesis, scripts) {
  const found = new Map();
  for (const transaction of genesis.transactions || []) {
    for (let index = 0; index < (transaction.outputs_data || []).length; index++) {
      const dataHash = ckbHashHex(utils, Buffer.from(transaction.outputs_data[index].slice(2), 'hex')).toLowerCase();
      for (const script of scripts) {
        if (script.hashType !== 'data1') fail(`withdraw supports only data1 code dependencies; found ${script.hashType}`);
        if (dataHash === script.codeHash.toLowerCase()) {
          const points = found.get(script.codeHash.toLowerCase()) || [];
          points.push({ txHash: transaction.hash, index });
          found.set(script.codeHash.toLowerCase(), points);
        }
      }
    }
  }
  return scripts.map((script) => {
    const points = found.get(script.codeHash.toLowerCase()) || [];
    if (points.length !== 1) fail(`expected one genesis code cell for ${script.codeHash}, found ${points.length}`);
    return scriptOutPointDep(points[0].txHash, points[0].index);
  });
}
function versionIsPinned(value) { return /^0\.210\.0(?:$|[-+\s(])/.test(String(value || '')); }
async function checkCanonicalHistory(node, bundle, startTip) {
  const checkedBlocks = new Map();
  let previous = null;
  for (const row of bundle.history) {
    const blockNumber = qhex(row.block_number, 'history block number');
    const txIndex = qhex(row.tx_index, 'history transaction index');
    const order = [blockNumber, txIndex];
    if (previous && (order[0] < previous[0] || (order[0] === previous[0] && order[1] <= previous[1]))) fail('history rows are not strictly ordered');
    previous = order;
    const fetched = await rpc(node, 'get_transaction', [row.tx_hash]);
    if (fetched?.tx_status?.status !== 'committed' || !fetched.transaction) fail(`history transaction is not committed: ${row.tx_hash}`);
    if (qhex(fetched.tx_status.block_number, 'committed block') !== blockNumber) fail(`history block number changed for ${row.tx_hash}`);
    const key = blockNumber.toString();
    let block = checkedBlocks.get(key);
    if (!block) {
      block = await canonicalBlock(node, blockNumber);
      checkedBlocks.set(key, block);
    }
    if (block.header.hash.toLowerCase() !== fetched.tx_status.block_hash.toLowerCase()) fail(`history transaction is not in its canonical block: ${row.tx_hash}`);
    const canonicalTx = block.transactions[Number(txIndex)];
    if (!canonicalTx || fullTransactionHash(canonicalTx) !== row.tx_hash.toLowerCase() || !sameRawTransaction(canonicalTx, fetched.transaction) || !sameRawTransaction(row.transaction, fetched.transaction)) {
      fail(`history body does not match the canonical transaction at ${row.tx_hash}`);
    }
    if (row.block_hash && row.block_hash.toLowerCase() !== block.header.hash.toLowerCase()) fail(`history bundle records a stale block hash for ${row.tx_hash}`);
  }
  const stableTip = await canonicalBlock(node, qhex(startTip.number, 'starting tip number'));
  if (stableTip.header.hash.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical chain changed while checking recovery history; retry collection');
}
function markerOutpoint(bundle, markerHash, utils) {
  const row = bundle.history[bundle.history.length - 1];
  if (!row) fail('recovery bundle has no custody history');
  const matches = [];
  for (let i = 0; i < row.transaction.outputs.length; i++) {
    const output = row.transaction.outputs[i];
    if (sameScript(output.lock, bundle.custody_lock) && output.type && scriptHash(utils, output.type).toLowerCase() === markerHash.toLowerCase()) matches.push(i);
  }
  if (matches.length !== 1) fail(`last history transaction must create one custody marker, found ${matches.length}`);
  return { tx_hash: row.tx_hash.toLowerCase(), index: hexQuantity(matches[0]) };
}
async function findOwnerFundingCell(node, ownerLock, startTip, maxBlocks) {
  const tipHeight = qhex(startTip.number, 'starting tip number');
  if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 1000000) fail('--max-funding-scan-blocks must be an integer in 1..=1000000');
  if (tipHeight + 1n > BigInt(maxBlocks)) fail(`genesis-to-tip funding scan range ${tipHeight + 1n} exceeds --max-funding-scan-blocks ${maxBlocks}`);
  const wantedLock = rpcSnake(ownerLock);
  const cells = new Map();
  for (let height = 0n; height <= tipHeight; height++) {
    const block = await canonicalBlock(node, height);
    for (const tx of block.transactions) {
      for (const input of tx.inputs || []) {
        const p = input.previous_output;
        cells.delete(`${p.tx_hash.toLowerCase()}:${qhex(p.index, 'funding input index').toString()}`);
      }
      const txHash = fullTransactionHash(tx);
      for (let index = 0; index < (tx.outputs || []).length; index++) {
        const output = tx.outputs[index];
        const data = tx.outputs_data?.[index] || '0x';
        if (!sameScript(output.lock, wantedLock) || output.type || data !== '0x') continue;
        const key = `${txHash}:${index}`;
        cells.set(key, { point: { tx_hash: txHash, index: hexQuantity(index) }, output });
      }
    }
  }
  const stableTip = await canonicalBlock(node, tipHeight);
  if (stableTip.header.hash.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical chain changed during funding-cell scan; retry');
  const candidates = [...cells.values()].sort((a, b) => {
    const left = qhex(a.output.capacity, 'funding capacity');
    const right = qhex(b.output.capacity, 'funding capacity');
    return left === right ? 0 : left > right ? -1 : 1;
  });
  for (const candidate of candidates) {
    const live = await rpc(node, 'get_live_cell', [candidate.point, true]);
    if (live?.status !== 'live' || !live.cell?.output || (live.cell.data?.content || '0x') !== '0x') continue;
    if (!sameCellOutput(live.cell.output, candidate.output)) continue;
    return {
      point: candidate.point,
      cell: { output: live.cell.output, data: '0x' },
      discovery: { source: 'canonical-full-block-scan', indexer_used: false, scanned_blocks: Number(tipHeight + 1n), candidate_count: candidates.length },
    };
  }
  fail('no live plain CKB funding cell for the recovered owner was found in canonical block history');
}
function rpcDataHex(cell, label) {
  if (!cell || typeof cell.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(cell.data)) fail(`${label} data is not valid hex`);
  return Buffer.from(cell.data.slice(2), 'hex');
}
async function verifyCommittedReport(node, report, reportPath, utils) {
  if (report.format !== 'trade-v2-independent-withdrawal-v1' || !/^0x[0-9a-f]{64}$/i.test(report.transaction_hash || '')) fail('unsupported withdrawal report or transaction hash');
  if (txHashOf(utils, rpcCamel(report.transaction)).toLowerCase() !== report.transaction_hash.toLowerCase()) fail('withdrawal report transaction hash does not match its raw transaction');
  const nodeInfo = await rpc(node, 'local_node_info');
  if (!versionIsPinned(nodeInfo?.version)) fail(`verification requires CKB 0.210.0; node reports ${nodeInfo?.version || 'no version'}`);
  const startTip = await rpc(node, 'get_tip_header');
  const fetched = await rpc(node, 'get_transaction', [report.transaction_hash]);
  if (fetched?.tx_status?.status !== 'committed' || !fetched.transaction) fail('withdrawal is not committed with a retrievable transaction body');
  const height = qhex(fetched.tx_status.block_number, 'withdrawal block number');
  const block = await canonicalBlock(node, height);
  if (block.header.hash.toLowerCase() !== fetched.tx_status.block_hash.toLowerCase()) fail('withdrawal transaction block is not canonical');
  const committedTx = block.transactions.find((candidate) => fullTransactionHash(candidate) === report.transaction_hash.toLowerCase());
  if (!committedTx || !sameRawTransaction(committedTx, report.transaction) || !sameRawTransaction(fetched.transaction, report.transaction)) fail('committed transaction body differs from the authorized withdrawal');
  const outputs = report.transaction.outputs;
  const outputData = report.transaction.outputs_data;
  if (!Array.isArray(outputs) || outputs.length !== 4 || !Array.isArray(outputData) || outputData.length !== 4) fail('withdrawal report transaction has an invalid output layout');
  const created = await Promise.all([0, 1, 2].map(async (index) => {
    const live = await requireLiveCell(node, { tx_hash: report.transaction_hash, index: hexQuantity(index) }, `withdrawal output ${index}`);
    if (!sameCellOutput(live.output, outputs[index]) || live.data.toLowerCase() !== outputData[index].toLowerCase()) fail(`committed withdrawal output ${index} differs from the authorized transaction`);
    return live;
  }));
  if (scriptHash(utils, created[2].output.lock).toLowerCase() !== report.owner_lock_hash.toLowerCase() || !sameScript(created[2].output.type, outputs[0].type)) fail('committed external xUDT output has the wrong owner or asset');
  const externalAmount = rpcDataHex(created[2], 'external xUDT output');
  if (externalAmount.length !== 16 || externalAmount.readBigUInt64LE(0) !== BigInt(report.quantity) || externalAmount.subarray(8).some((byte) => byte !== 0)) fail('committed external xUDT amount differs from the recovered entitlement');
  const custodyData = rpcDataHex(created[0], 'updated custody output');
  if (custodyData.length !== 48 || custodyData.readBigUInt64LE(0) !== BigInt(report.custody_amount_after) || created[0].data.toLowerCase() !== report.new_custody_data.toLowerCase()) fail('committed custody output has the wrong amount or authenticated root');
  for (const point of [report.old_custody_outpoint, report.old_marker_outpoint, report.funding_outpoint]) {
    if (!hasInputPoint(report.transaction, point)) fail(`authorized withdrawal does not consume recorded input ${point.tx_hash}:${point.index}`);
    const status = await rpc(node, 'get_live_cell', [point, true]);
    if (status?.status === 'live' || !['dead', 'unknown'].includes(status?.status)) fail(`withdrawal input is not confirmed spent: ${point.tx_hash}:${point.index}`);
  }
  const stableTip = await canonicalBlock(node, qhex(startTip.number, 'verification starting tip'));
  if (stableTip.header.hash.toLowerCase() !== startTip.hash.toLowerCase()) fail('canonical chain changed during withdrawal verification; retry');
  report.status = 'committed';
  report.block_number = fetched.tx_status.block_number;
  report.block_hash = fetched.tx_status.block_hash;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { block_number: report.block_number, block_hash: report.block_hash };
}
async function withdraw(args) {
  for (const key of ['node', 'bundle', 'out']) if (!args[key]) fail(`missing --${key}`);
  if (path.resolve(args.out) === path.resolve(args.bundle)) fail('--out must not overwrite the recovery bundle');
  if (fs.existsSync(path.resolve(args.out))) fail(`refusing to overwrite existing withdrawal evidence: ${path.resolve(args.out)}`);
  const node = localRpcUrl(args.node);
  const sdk = loadSdk(args);
  const privateKey = process.env[RECOVERY_KEY_ENV];
  const ownerLock = privateOwnerLock(sdk.utils, privateKey);
  const bundlePath = path.resolve(args.bundle);
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const recovery = replayBundleFile(bundlePath);
  if (bundle.format !== 'trade-v2-recovery-bundle-v1' || recovery.format !== 'trade-v2-recovery-result-v1') fail('unsupported recovery bundle/result format');
  if (recovery.owner_membership_proof?.root_verified !== true || recovery.owner_lock_hash.toLowerCase() !== bundle.owner_lock_hash.toLowerCase()) fail('replayed owner proof or identity does not match the bundle');
  if (scriptHash(sdk.utils, ownerLock).toLowerCase() !== bundle.owner_lock_hash.toLowerCase()) fail('disposable private key does not match the recovered owner lock hash');
  const template = recovery.withdrawal_template;
  if (!template || template.op !== 5 || BigInt(template.quantity) <= 0n) fail('recovery bundle has no positive owner withdrawal');
  if (recovery.entitlement_total !== recovery.custody_amount) fail('replayed entitlement total differs from the custody xUDT amount');

  const nodeInfo = await rpc(node, 'local_node_info');
  if (!versionIsPinned(nodeInfo?.version)) fail(`withdraw requires CKB 0.210.0; node reports ${nodeInfo?.version || 'no version'}`);
  const startTip = await rpc(node, 'get_tip_header');
  const genesis = await rpc(node, 'get_block_by_number', ['0x0']);
  if (genesis?.header?.hash?.toLowerCase() !== recovery.domain.genesis_hash.toLowerCase()) fail('bundle genesis does not match this CKB node');
  const domainArgs = Buffer.from(bundle.custody_lock.args.slice(2), 'hex');
  if (domainArgs.length !== 128 || domainArgs.subarray(64, 96).toString('hex') !== recovery.domain.genesis_hash.slice(2).toLowerCase()) fail('custody script domain does not match recovered genesis');
  await checkCanonicalHistory(node, bundle, startTip);

  const custodyPoint = { tx_hash: bundle.live.tx_hash.toLowerCase(), index: hexQuantity(qhex(bundle.live.index, 'custody output index')) };
  const markerHash = `0x${domainArgs.subarray(96, 128).toString('hex')}`;
  const markerPoint = markerOutpoint(bundle, markerHash, sdk.utils);
  const [custodyCell, markerCell] = await Promise.all([
    requireLiveCell(node, custodyPoint, 'recovered custody xUDT cell'),
    requireLiveCell(node, markerPoint, 'recovered custody marker cell'),
  ]);
  const funding = args['funding-outpoint']
    ? { point: parseOutpoint(args['funding-outpoint']), cell: await requireLiveCell(node, parseOutpoint(args['funding-outpoint']), 'owner fee-funding cell'), discovery: { source: 'explicit-live-outpoint', indexer_used: false } }
    : await findOwnerFundingCell(node, ownerLock, startTip, args['max-funding-scan-blocks'] ? Number(args['max-funding-scan-blocks']) : 100000);
  const fundingPoint = funding.point;
  const fundingCell = funding.cell;
  if (!exactCellOutput(custodyCell.output, bundle.live.output) || custodyCell.data.toLowerCase() !== bundle.live.data.toLowerCase()) fail('recovered custody cell is not the current canonical live cell');
  const custodyLock = camelScript(bundle.custody_lock);
  const xudtType = camelScript(bundle.xudt_type_script);
  if (!sameScript(markerCell.output.lock, bundle.custody_lock) || !markerCell.output.type || scriptHash(sdk.utils, markerCell.output.type).toLowerCase() !== markerHash.toLowerCase()) fail('live custody marker identity does not match the custody domain');
  const expectedMarkerData = `0x${scriptHash(sdk.utils, custodyLock).slice(2)}${scriptHash(sdk.utils, xudtType).slice(2)}`;
  if (markerCell.data.toLowerCase() !== expectedMarkerData.toLowerCase()) fail('live custody marker data does not bind the recovered lock and xUDT type');
  if (!sameScript(fundingCell.output.lock, { code_hash: ownerLock.codeHash, hash_type: ownerLock.hashType, args: ownerLock.args }) || fundingCell.output.type || fundingCell.data !== '0x') fail('funding outpoint must be a plain CKB cell locked by the recovered owner');

  const custodyData = rpcDataHex(custodyCell, 'custody xUDT cell');
  if (custodyData.length !== 48 || custodyData.subarray(8, 16).some((byte) => byte !== 0)) fail('current custody amount has an unsupported encoding');
  const custodyAmount = custodyData.readBigUInt64LE(0);
  const quantity = BigInt(template.quantity);
  if (quantity !== BigInt(recovery.owner.balance) || quantity > custodyAmount) fail('withdrawal quantity differs from the recovered owner balance');
  if (`0x${custodyData.subarray(16).toString('hex')}`.toLowerCase() !== template.old_root.toLowerCase()) fail('recovered TMS1 old root does not match the live custody root');
  const tmsWitness = Buffer.from(template.tms1_witness.slice(2), 'hex');
  if (tmsWitness.length < 12 + 96 || tmsWitness.subarray(0, 4).toString('ascii') !== 'TMS1' || tmsWitness[5] !== 5 || tmsWitness[6] !== 1) fail('recovery verifier generated an invalid withdrawal TMS1 witness');
  if (tmsWitness.subarray(12, 44).toString('hex') !== bundle.owner_lock_hash.slice(2).toLowerCase()) fail('TMS1 withdrawal owner differs from the recovered owner');

  const genesisTransactions = genesis.transactions || [];
  if (!genesisTransactions[1]?.hash || !genesisTransactions[1]?.outputs?.[0]) fail('genesis block lacks the pinned standard-lock dep group at transaction 1 output 0');
  const secpDep = scriptOutPointDep(genesisTransactions[1].hash, 0, 'depGroup');
  const scriptDeps = codeCellDeps(sdk.utils, genesis, [
    custodyLock,
    xudtType,
    camelScript(markerCell.output.type),
  ]);
  const minExternalCapacity = occupiedCapacity(ownerLock, xudtType, 16);
  const minChangeCapacity = occupiedCapacity(ownerLock, null, 0);
  const externalCapacity = minExternalCapacity;
  const fee = args.fee ? BigInt(args.fee) : FEE_LIMIT;
  if (fee <= 0n || fee > FEE_LIMIT) fail(`--fee must be between 1 and ${FEE_LIMIT} shannons`);
  const waitSeconds = args['wait-seconds'] ? Number(args['wait-seconds']) : 60;
  if (!Number.isInteger(waitSeconds) || waitSeconds < 1 || waitSeconds > 600) fail('--wait-seconds must be an integer in 1..=600');
  const fundCapacity = qhex(fundingCell.output.capacity, 'funding capacity');
  const changeCapacity = fundCapacity - externalCapacity - fee;
  if (changeCapacity < minChangeCapacity) fail(`owner funding cell needs at least ${externalCapacity + fee + minChangeCapacity} shannons`);

  const nextCustodyData = Buffer.from(custodyData);
  nextCustodyData.writeBigUInt64LE(custodyAmount - quantity, 0);
  Buffer.from(template.new_root.slice(2), 'hex').copy(nextCustodyData, 16);
  const inputs = [
    { previousOutput: outPoint(custodyPoint.tx_hash, custodyPoint.index), since: '0x0' },
    { previousOutput: outPoint(markerPoint.tx_hash, markerPoint.index), since: '0x0' },
    { previousOutput: outPoint(fundingPoint.tx_hash, fundingPoint.index), since: '0x0' },
  ];
  const tx = {
    version: '0x0',
    cellDeps: [secpDep, ...scriptDeps],
    headerDeps: [],
    inputs,
    outputs: [
      { capacity: hexQuantity(custodyCell.output.capacity), lock: custodyLock, type: xudtType },
      { capacity: hexQuantity(markerCell.output.capacity), lock: custodyLock, type: camelScript(markerCell.output.type) },
      { capacity: hexQuantity(externalCapacity), lock: ownerLock, type: xudtType },
      { capacity: hexQuantity(changeCapacity), lock: ownerLock },
    ],
    outputsData: [
      `0x${nextCustodyData.toString('hex')}`,
      markerCell.data,
      `0x${littleEndian(quantity, 16).toString('hex')}`,
      '0x',
    ],
    witnesses: ['0x', '0x', '0x', `0x${tmsWitness.toString('hex')}`],
  };
  const txHash = txHashOf(sdk.utils, tx);
  const signerGroup = [{ lock: '', inputType: '', outputType: '' }, ...tx.witnesses.slice(inputs.length)];
  tx.witnesses[2] = sdk.signGroup(privateKey, txHash, signerGroup)[0];
  const rpcTx = rpcSnake(tx);
  const cycles = await rpc(node, 'estimate_cycles', [rpcTx]);
  if (!cycles?.cycles) fail('CKB estimate_cycles returned no VM cycle count');
  const report = {
    format: 'trade-v2-independent-withdrawal-v1',
    status: 'estimated',
    node_version: nodeInfo.version,
    genesis_hash: genesis.header.hash,
    owner_lock_hash: bundle.owner_lock_hash,
    quantity: quantity.toString(),
    entitlement_total_before: recovery.entitlement_total,
    custody_amount_before: custodyAmount.toString(),
    custody_amount_after: (custodyAmount - quantity).toString(),
    old_custody_outpoint: custodyPoint,
    old_marker_outpoint: markerPoint,
    funding_outpoint: fundingPoint,
    funding_discovery: funding.discovery,
    transaction_hash: txHash,
    cycles: cycles.cycles,
    fee: fee.toString(),
    external_xudt_outpoint: { tx_hash: txHash, index: '0x2' },
    external_xudt_data: rpcTx.outputs_data[2],
    new_custody_outpoint: { tx_hash: txHash, index: '0x0' },
    new_custody_data: rpcTx.outputs_data[0],
    witness_bytes: tmsWitness.length,
    transaction: rpcTx,
  };
  const reportPath = path.resolve(args.out);
  const reportFd = fs.openSync(reportPath, 'wx');
  fs.writeFileSync(reportFd, `${JSON.stringify(report, null, 2)}\n`);
  fs.closeSync(reportFd);
  const submittedHash = await rpc(node, 'send_transaction', [rpcTx, 'passthrough']);
  if (submittedHash.toLowerCase() !== txHash.toLowerCase()) fail('node returned a different transaction hash after broadcast');
  report.status = 'broadcast';
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  let committed;
  for (let attempt = 0; attempt < waitSeconds; attempt++) {
    if (args.mine) await rpc(node, 'generate_block');
    const response = await rpc(node, 'get_transaction', [txHash]);
    if (response?.tx_status?.status === 'committed') { committed = response; break; }
    if (response?.tx_status?.status === 'rejected') fail(`broadcast transaction was rejected: ${JSON.stringify(response.tx_status)}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!committed?.transaction) fail(`withdrawal ${txHash} was broadcast but not committed within ${waitSeconds}s`);
  const verification = await verifyCommittedReport(node, report, reportPath, sdk.utils);
  process.stdout.write(`Committed owner withdrawal ${txHash} in block ${verification.block_number}; output ${txHash}:0x2 contains ${quantity} xUDT.\n`);
}

async function verifyWithdrawal(args) {
  for (const key of ['node', 'report']) if (!args[key]) fail(`missing --${key}`);
  const node = localRpcUrl(args.node);
  const sdk = loadSdk(args);
  const reportPath = path.resolve(args.report);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const result = await verifyCommittedReport(node, report, reportPath, sdk.utils);
  process.stdout.write(`Verified owner withdrawal ${report.transaction_hash} in canonical block ${result.block_number}.\n`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (args.help || command === 'help' || command === '--help' || command === '-h' || !command) { process.stdout.write(usage()); return; }
  if (command === 'collect') await collect(args);
  else if (command === 'collect-incremental') await collectIncremental(args);
  else if (command === 'collect-blocks') await collectBlocks(args);
  else if (command === 'withdraw') await withdraw(args);
  else if (command === 'verify-withdrawal') await verifyWithdrawal(args);
  else fail(`unknown command ${command}`);
}
main().catch((e) => { process.stderr.write(`recovery error: ${e?.stack || e}\n`); process.exitCode = 2; });
