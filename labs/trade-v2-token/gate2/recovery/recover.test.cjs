'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');

const here = __dirname;
const root = path.resolve(here, '../../../../');
const smtManifest = path.join(here, '..', 'smt-tools', 'Cargo.toml');
const recoveryManifest = path.join(here, 'Cargo.toml');
const recoveryBinary = path.join(here, 'target', 'release', process.platform === 'win32' ? 'trade-v2-recovery.exe' : 'trade-v2-recovery');
const C = require(path.join(root, 'labs', 'rebuild', 'native', 'src', 'lib.cjs'));

function h(byte) { return `0x${byte.repeat(32)}`; }
function script(codeByte, args = '0x') { return { code_hash: h(codeByte), hash_type: 'data1', args }; }
function scriptHash(s) { return C.U.scriptToHash({ codeHash: s.code_hash, hashType: s.hash_type, args: s.args }); }
function rpcServer(handler) {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const part of req) raw += part;
    const body = JSON.parse(raw);
    try {
      const result = await handler(body.method, body.params || []);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    } catch (e) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -1, message: String(e.message || e) } }));
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
function rpcTx(hash, inputs, outputs, outputsData, witness) {
  return { hash, version: '0x0', cell_deps: [], header_deps: [], inputs, outputs, outputs_data: outputsData, witnesses: [witness] };
}
function rawInput(txHash, index) { return { previous_output: { tx_hash: txHash, index: `0x${index.toString(16)}` }, since: '0x0' }; }
function cell(lock, type, data) { return { capacity: '0x1000000000', lock, type, data }; }
function writeAmountRoot(amount, rootHex) {
  const data = Buffer.alloc(48);
  data.writeBigUInt64LE(BigInt(amount), 0);
  Buffer.from(rootHex.slice(2), 'hex').copy(data, 16);
  return `0x${data.toString('hex')}`;
}
function makeProof(tmp, name, request) {
  const input = path.join(tmp, `${name}.input.json`);
  const output = path.join(tmp, `${name}.output.json`);
  fs.writeFileSync(input, JSON.stringify(request));
  execFileSync('cargo', ['run', '--quiet', '--locked', '--offline', '--manifest-path', smtManifest, '--', 'proof', input, output], { cwd: root, stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(output, 'utf8'));
}
function runCli(args, cwd, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stdout.on('data', (x) => { stdout += x; });
    child.stderr.setEncoding('utf8'); child.stderr.on('data', (x) => { stderr += x; });
    child.on('error', (error) => resolve({ status: null, stdout, stderr: `${stderr}${error}` }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('independent RPC collection rebuilds committed TMS1 history and fails closed on a history gap', async (t) => {
  execFileSync('cargo', ['build', '--release', '--locked', '--offline', '--manifest-path', recoveryManifest], { cwd: root, stdio: 'pipe' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-v2-recovery-rpc-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const dataScript = (data, args = '0x') => ({ code_hash: C.hash(Buffer.from(data)), hash_type: 'data1', args });
  const xudt = dataScript('xudt-code');
  const markerType = dataScript('marker-code', h('11'));
  const assetHash = scriptHash(xudt);
  const markerHash = scriptHash(markerType);
  const domain = {
    genesis_hash: h('22'), market_script_hash: h('11'),
    xudt_type_script_hash: assetHash, custody_marker_type_hash: markerHash,
  };
  const args = Buffer.concat([
    Buffer.from(domain.market_script_hash.slice(2), 'hex'), Buffer.from(assetHash.slice(2), 'hex'),
    Buffer.from(domain.genesis_hash.slice(2), 'hex'), Buffer.from(markerHash.slice(2), 'hex'),
  ]);
  const custodyLock = { ...dataScript('custody-code', `0x${args.toString('hex')}`) };
  const custodyLockHash = scriptHash(custodyLock);
  const markerData = `0x${custodyLockHash.slice(2)}${assetHash.slice(2)}`;
  const ownerA = h('61');
  const recoveryKey = `0x${'2'.padStart(64, '0')}`;
  const ownerB = C.U.scriptToHash(C.locks[1]);
  const initial = makeProof(tmp, 'initial', { domain, op: 0, owners: [], updates: [{ owner_lock_hash: ownerA, balance: '5', revision: '0', active: true }] });
  const next = makeProof(tmp, 'next', { domain, op: 1, owners: [{ owner_lock_hash: ownerA, balance: '5', revision: '0', active: true }], updates: [{ owner_lock_hash: ownerB, balance: '2', revision: '1', active: true }] });
  const txA = h('91');
  const txB = h('92');
  const blockA = h('a1');
  const blockB = h('b1');
  const tipHash = h('c1');
  const outAData = writeAmountRoot(initial.total_after, initial.new_root);
  const outBData = writeAmountRoot(next.total_after, next.new_root);
  const outA = cell(custodyLock, xudt, outAData);
  const marker = cell(custodyLock, markerType, markerData);
  const txAView = rpcTx(txA, [], [outA, marker], [outAData, markerData], initial.contract_witness.hex);
  const outB = cell(custodyLock, xudt, outBData);
  const markerB = cell(custodyLock, markerType, markerData);
  const txBView = rpcTx(txB, [rawInput(txA, 0), rawInput(txA, 1)], [outB, markerB], [outBData, markerData], next.contract_witness.hex);
  const txMap = new Map([[txA, { transaction: txAView, block_number: '0x1', block_hash: blockA }], [txB, { transaction: txBView, block_number: '0x2', block_hash: blockB }]]);
  let omitSecond = false;
  const fundingHash = h('f0');
  const fundingIndex = 3;
  const fundingOutput = { capacity: '0x10000000000', lock: C.snake(C.locks[1]) };
  const fundingCell = { output: fundingOutput, data: '0x' };
  const codeLabels = ['custody-code', 'marker-code', 'xudt-code'];
  const codeDatas = codeLabels.map((label) => `0x${Buffer.from(label).toString('hex')}`);
  const codeOutputs = [...codeDatas.map(() => ({ capacity: '0x1000000000', lock: C.snake(C.locks[0]) })), fundingOutput];
  const genesisTxs = [
    { hash: h('f0'), outputs: codeOutputs, outputs_data: [...codeDatas, '0x'] },
    { hash: h('f1'), outputs: [{ capacity: '0x1000000000', lock: C.snake(C.locks[0]) }], outputs_data: ['0x'] },
  ];
  let chainTipNumber = '0x3';
  let chainTipHash = tipHash;
  let withdrawalRecord = null;
  const createdCells = new Map();
  const spentPoints = new Set();
  const canonicalCamel = (value) => {
    const tx = C.camel(value);
    for (const dep of tx.cellDeps || []) if (dep.depType === 'dep_group') dep.depType = 'depGroup';
    return tx;
  };

  const node = await rpcServer(async (method, params) => {
    if (method === 'local_node_info') return { version: '0.210.0 (test)' };
    if (method === 'get_tip_header') return { number: chainTipNumber, hash: chainTipHash };
    if (method === 'get_block_by_number') {
      const n = params[0];
      if (n === '0x0') return { header: { number: n, hash: domain.genesis_hash }, transactions: genesisTxs };
      if (n === '0x4' && withdrawalRecord) return { header: { number: n, hash: withdrawalRecord.block_hash }, transactions: [withdrawalRecord.transaction] };
      const hash = n === '0x1' ? blockA : n === '0x2' ? blockB : tipHash;
      const tx = n === '0x1' ? [txAView] : n === '0x2' ? [txBView] : [];
      return { header: { number: n, hash }, transactions: tx };
    }
    if (method === 'estimate_cycles') return { cycles: '0x1234' };
    if (method === 'send_transaction') {
      const transaction = params[0];
      const hash = C.U.rawTransactionToHash(canonicalCamel(transaction));
      const committedTx = { ...transaction, outputs: transaction.outputs.map((output) => output.type ? output : { ...output, type: null }), hash };
      const blockHash = h('c2');
      withdrawalRecord = { transaction: committedTx, hash, block_number: '0x4', block_hash: blockHash };
      for (const input of transaction.inputs) spentPoints.add(`${input.previous_output.tx_hash}:${Number(BigInt(input.previous_output.index))}`);
      for (let i = 0; i < transaction.outputs.length; i++) {
        createdCells.set(`${hash}:${i}`, { output: transaction.outputs[i], data: transaction.outputs_data[i] });
      }
      chainTipNumber = '0x4'; chainTipHash = blockHash;
      return hash;
    }
    if (method === 'generate_block') return chainTipHash;
    if (method === 'get_transaction') {
      if (withdrawalRecord && params[0] === withdrawalRecord.hash) return {
        transaction: withdrawalRecord.transaction,
        tx_status: { status: 'committed', block_number: withdrawalRecord.block_number, block_hash: withdrawalRecord.block_hash },
      };
      const row = txMap.get(params[0]);
      if (!row) return null;
      return { transaction: row.transaction, tx_status: { status: 'committed', block_number: row.block_number, block_hash: row.block_hash } };
    }
    if (method === 'get_live_cell') {
      const point = params[0];
      const key = `${point.tx_hash}:${Number(BigInt(point.index))}`;
      if (spentPoints.has(key)) return { status: 'unknown' };
      const created = createdCells.get(key);
      if (created) return { status: 'live', cell: { output: created.output, data: { content: created.data } } };
      if (key === `${txB}:0`) return { status: 'live', cell: { output: outB, data: { content: outBData } } };
      if (key === `${txB}:1`) return { status: 'live', cell: { output: markerB, data: { content: markerData } } };
      if (key === `${fundingHash}:${fundingIndex}`) return { status: 'live', cell: { output: fundingOutput, data: { content: '0x' } } };
      throw new Error(`unexpected live cell ${key}`);
    }
    throw new Error(`unexpected node RPC ${method}`);
  });
  const indexer = await rpcServer(async (method, params) => {
    if (method === 'get_transactions') {
      assert.equal(params[0].script_type, 'lock');
      assert.equal(params[0].script_search_mode, 'exact');
      assert.equal(scriptHash(params[0].script), custodyLockHash);
      const objects = [
        { tx_hash: txA, block_number: '0x1', tx_index: '0x0', io_type: 'output', io_index: '0x0' },
        { tx_hash: txA, block_number: '0x1', tx_index: '0x0', io_type: 'output', io_index: '0x1' },
        { tx_hash: txB, block_number: '0x2', tx_index: '0x0', io_type: 'input', io_index: '0x0' },
        { tx_hash: txB, block_number: '0x2', tx_index: '0x0', io_type: 'output', io_index: '0x0' },
      ].filter((x) => !omitSecond || x.tx_hash !== txB);
      return { objects, last_cursor: '0x' };
    }
    if (method === 'get_cells') return { objects: [{ out_point: { tx_hash: txB, index: '0x0' }, output: outB, output_data: outBData }], last_cursor: '0x' };
    throw new Error(`unexpected indexer RPC ${method}`);
  });
  t.after(() => { node.server.close(); indexer.server.close(); });

  const custodyPath = path.join(tmp, 'custody.json');
  const assetPath = path.join(tmp, 'xudt.json');
  fs.writeFileSync(custodyPath, JSON.stringify(custodyLock));
  fs.writeFileSync(assetPath, JSON.stringify(xudt));
  const bundlePath = path.join(tmp, 'bundle.json');
  const cli = path.join(here, 'recover.cjs');
  const argsFor = (out) => [cli, 'collect', '--node', node.url, '--indexer', indexer.url, '--init', txA, '--owner', ownerB, '--custody-lock', custodyPath, '--xudt-type', assetPath, '--out', out];

  const collected = await runCli(argsFor(bundlePath), root);
  assert.equal(collected.status, 0, `${collected.stderr}\n${collected.stdout}`);
  const result = JSON.parse(fs.readFileSync(`${bundlePath}.result.json`, 'utf8'));
  assert.equal(result.owner.balance, '2');
  assert.equal(result.owner.revision, '1');
  assert.equal(result.entitlement_total, '7');
  assert.equal(result.custody_amount, '7');
  assert.equal(result.transitions.length, 2);
  assert.equal(result.owner_membership_proof.root_verified, true);
  assert.equal(result.withdrawal_template.quantity, '2');

  const blockBundlePath = path.join(tmp, 'full-block-bundle.json');
  const blockArgs = [cli, 'collect-blocks', '--node', node.url, '--init', txA, '--owner', ownerB, '--custody-lock', custodyPath, '--xudt-type', assetPath, '--max-blocks', '10', '--out', blockBundlePath];
  const scanned = await runCli(blockArgs, root);
  assert.equal(scanned.status, 0, `${scanned.stderr}\n${scanned.stdout}`);
  const blockBundle = JSON.parse(fs.readFileSync(blockBundlePath, 'utf8'));
  const blockResult = JSON.parse(fs.readFileSync(`${blockBundlePath}.result.json`, 'utf8'));
  assert.equal(blockBundle.collection.source, 'canonical-full-block-scan');
  assert.equal(blockBundle.collection.indexer_used, false);
  assert.equal(blockBundle.collection.scanned_blocks, 3);
  assert.equal(blockResult.entitlement_total, '7');
  assert.equal(blockResult.owner.balance, '2');

  omitSecond = true;
  const gapPath = path.join(tmp, 'gap.json');
  const gap = await runCli(argsFor(gapPath), root);
  assert.notEqual(gap.status, 0, 'a truncated indexer history must not produce a recovery result');
  assert.match(gap.stderr, /initialization transaction|live canonical custody output|previous custody/i);

  omitSecond = false;
  const withdrawalPath = path.join(tmp, 'withdrawal.json');
  const withdrawn = await runCli([
    cli, 'withdraw', '--node', node.url, '--bundle', bundlePath,
    '--out', withdrawalPath,
  ], root, { TRADE_RECOVERY_PRIVATE_KEY: recoveryKey });
  assert.equal(withdrawn.status, 0, `${withdrawn.stderr}\n${withdrawn.stdout}`);
  const withdrawal = JSON.parse(fs.readFileSync(withdrawalPath, 'utf8'));
  assert.equal(withdrawal.format, 'trade-v2-independent-withdrawal-v1');
  assert.equal(withdrawal.owner_lock_hash, ownerB);
  assert.equal(withdrawal.quantity, '2');
  assert.equal(withdrawal.entitlement_total_before, '7');
  assert.equal(withdrawal.custody_amount_after, '5');
  assert.equal(withdrawal.funding_outpoint.tx_hash, fundingHash);
  assert.equal(withdrawal.funding_outpoint.index, `0x${fundingIndex.toString(16)}`);
  assert.equal(withdrawal.funding_discovery.source, 'canonical-full-block-scan');
  assert.equal(withdrawal.funding_discovery.indexer_used, false);
  assert.match(withdrawal.transaction_hash, /^0x[0-9a-f]{64}$/);
  assert.equal(withdrawal.external_xudt_outpoint.index, '0x2');
  assert.equal(Buffer.from(withdrawal.external_xudt_data.slice(2), 'hex').readBigUInt64LE(0), 2n);
  assert.match(withdrawal.transaction.witnesses[3], /^0x544d5331/);
  assert.notEqual(withdrawal.transaction.witnesses[2], '0x');
  withdrawal.status = 'broadcast';
  fs.writeFileSync(withdrawalPath, JSON.stringify(withdrawal, null, 2));
  const verified = await runCli([cli, 'verify-withdrawal', '--node', node.url, '--report', withdrawalPath], root);
  assert.equal(verified.status, 0, `${verified.stderr}\n${verified.stdout}`);
  const verifiedReport = JSON.parse(fs.readFileSync(withdrawalPath, 'utf8'));
  assert.equal(verifiedReport.status, 'committed');
  assert.equal(verifiedReport.block_hash, h('c2'));
});
