// Native cross-market substitution fixture. Uses the preserved Gate 1 binaries
// and disposable CKB 0.210.0 only; no mainnet or public assets.
const path = require('node:path');
const nativeRoot = process.env.TRADE_NATIVE_ROOT || path.resolve(__dirname, '../../../rebuild/native');
const C = require(nativeRoot + '/src/lib.cjs');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const { ccc } = require((process.env.TRADE_NATIVE_ROOT || C.ROOT) + '/node_modules/@ckb-ccc/core');
const signGroup = require((process.env.TRADE_NATIVE_ROOT || C.ROOT) + '/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const { fs, UNIT, fee, hex, hx, b, le, hash, locks, keys, U } = C;
for (let k = 4; k <= 6; k++) {
  keys.push('0x' + k.toString(16).padStart(64, '0'));
  locks.push({ codeHash: locks[0].codeHash, hashType: 'type', args: '0x' + U.blake160(U.privateKeyToPublicKey(keys[k - 1]), 'hex') });
}
const gate1 = path.resolve(__dirname, '../../');
const build = process.env.TRADE_GATE1_BUILD_DIR || path.join(gate1, 'build');
const out = path.join(__dirname, 'evidence', 'cross-lineage-' + Date.now());
fs.mkdirSync(out, { recursive: true });
const chain = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-two-market-')) + '/chain';
const rpcUrl = process.env.TRADE_SECURITY_RPC || 'http://127.0.0.1:19224';
let child;
let secp;

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const json = await response.json();
  fs.appendFileSync(path.join(out, 'rpc.jsonl'), JSON.stringify({ method, params, response: json }) + '\n');
  if (json.error) throw Error(JSON.stringify(json.error));
  return json.result;
}
const cell = (capacity, lock, type, data = '0x') => ({ capacity: BigInt(capacity), lock, type, data });
function tx(inputs, outputs, deps = []) {
  return { version: '0x0', cellDeps: [secp, ...deps], headerDeps: [], inputs: inputs.map(x => ({ previousOutput: x.outPoint, since: '0x0' })), outputs: outputs.map(x => ({ capacity: hex(x.capacity), lock: x.lock, ...(x.type ? { type: x.type } : {}) })), outputsData: outputs.map(x => x.data), witnesses: inputs.map(() => '0x') };
}
function sign(t, inputs, role) {
  t = structuredClone(t);
  const ids = inputs.map((c, i) => U.scriptToHash(c.lock) === U.scriptToHash(locks[role]) ? i : -1).filter(i => i >= 0);
  assert(ids.length, `no input for signer role ${role}`);
  const first = ids[0];
  let message;
  try { message = U.rawTransactionToHash(t); }
  catch (error) { fs.writeFileSync(path.join(out, 'raw-transaction-hash-error.json'), JSON.stringify({ error: error.message, outputs: t.outputs }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2)); throw error; }
  const group = [{ lock: '', inputType: '', outputType: '' }, ...ids.slice(1).map(j => t.witnesses[j]), ...t.witnesses.slice(inputs.length)];
  t.witnesses[first] = signGroup(keys[role], message, group)[0];
  return t;
}
async function send(label, t) {
  const cycles = await rpc('estimate_cycles', [C.snake(t)]);
  const txHash = await rpc('send_transaction', [C.snake(t), 'passthrough']);
  let result;
  for (let i = 0; i < 30; i++) {
    result = await rpc('get_transaction', [txHash]);
    if (result.tx_status.status === 'committed') break;
    await rpc('generate_block');
  }
  assert.equal(result.tx_status.status, 'committed', `${label} not committed`);
  fs.appendFileSync(path.join(out, 'events.jsonl'), JSON.stringify({ label, hash: txHash, cycles, tx: t, receipt: result }) + '\n');
  console.log(label, txHash, cycles.cycles);
  return t.outputs.map((o, i) => ({ ...o, capacity: BigInt(o.capacity), data: t.outputsData[i], outPoint: { txHash, index: hex(i) } }));
}
async function rejectCase(label, t, source, code, scriptHash) {
  let error;
  try { await rpc('estimate_cycles', [C.snake(t)]); } catch (e) { error = e; }
  assert(error, `unexpectedly accepted: ${label}`);
  const message = JSON.parse(error.message).message;
  const choices = Array.isArray(source) ? source : [[source, code, scriptHash]];
  const attribution = choices.find(([src, c, h]) => message.includes(`source: ${src}, cause: ValidationFailure: see error code ${c} `) && message.includes(h.slice(2)));
  assert(attribution, `expected one of ${JSON.stringify(choices)}; actual ${message}`);
  const [actualSource, actualCode, actualScriptHash] = attribution;
  fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify({ label, error: error.message, source: actualSource, code: actualCode, scriptHash: actualScriptHash, tx: t }, null, 2));
  console.log('rejected', label, actualSource, actualCode, actualScriptHash);
  return { message: error.message, source: actualSource, code: actualCode, scriptHash: actualScriptHash };
}
const ZERO = '0x' + '00'.repeat(32);
const emptyRecord = () => ({ owner: ZERO, balance: 0n, revision: 0n });
const recordsCopy = xs => xs.map(x => ({ ...x }));
const recordBytes = r => Buffer.concat([b(r.owner), le(r.balance), le(r.revision)]);
function tree(records) {
  let layer = records.map((r, i) => hash(Buffer.concat([Buffer.from([1]), le(i), recordBytes(r)])));
  for (let width = 8; width > 1; width >>= 1) {
    const next = [];
    for (let i = 0; i < width; i += 2) next.push(hash(Buffer.concat([Buffer.from([2]), b(layer[i]), b(layer[i + 1])])));
    layer = next;
  }
  return layer[0];
}
const custodyData = records => hx(Buffer.concat([le(records.reduce((n, r) => n + r.balance, 0n), 16), b(tree(records))]));
const witness = (op, seller, buyer, qty, price, order, old, next) => hx(Buffer.concat([le(op), le(seller), le(buyer), le(qty), le(price), b(order), ...old.map(recordBytes), ...next.map(recordBytes), Buffer.alloc(33), Buffer.alloc(65)]));

function marketFor(anchor, role, genesis, hashes) {
  const anchorBytes = Buffer.concat([b(anchor.outPoint.txHash), le(BigInt(anchor.outPoint.index), 4)]);
  const markerId = hash(Buffer.concat([le(0), anchorBytes, le(1)]));
  const marker = { codeHash: hashes.marker_candidate, hashType: 'data1', args: markerId };
  const market = { codeHash: hashes.market, hashType: 'data1', args: hx(Buffer.concat([b(hash(anchorBytes)), le(10n * UNIT), le(UNIT), le(1000n), b(U.scriptToHash(marker))])) };
  const owner = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([anchorBytes, b(hashes.xudt), b(U.scriptToHash(market)), le(1000n, 16)])) };
  const token = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(owner) };
  const marketData = hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token))]));
  const custodyMarker = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(market) };
  const custody = { codeHash: hashes.custody, hashType: 'data1', args: hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token)), b(genesis), b(U.scriptToHash(custodyMarker))])) };
  const custodyMarkerData = hx(Buffer.concat([b(U.scriptToHash(custody)), b(U.scriptToHash(token))]));
  return { role, anchor, anchorBytes, market, marker, owner, token, marketData, custodyMarker, custody, custodyMarkerData, genesis };
}

async function main() {
  execFileSync(process.execPath, [C.ROOT + '/src/setup.cjs', chain]);
  let spec = fs.readFileSync(chain + '/specs/dev.toml', 'utf8'), extra = '';
  const names = ['marker_candidate', 'market', 'owner_lineage_candidate', 'custody', 'custody_marker'];
  for (const name of names) {
    fs.copyFileSync(path.join(build, name), chain + '/' + name);
    extra += `[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n\n`;
  }
  spec = spec.replace('[genesis.system_cells_lock]', extra + '[genesis.system_cells_lock]');
  fs.writeFileSync(chain + '/specs/dev.toml', spec);
  child = spawn(C.ROOT + '/tools/ckb', ['run', '-C', chain, '--ba-advanced'], { stdio: ['ignore', fs.openSync(path.join(out, 'node.log'), 'w'), 'ignore'] });
  for (let i = 0; i < 100; i++) { try { await rpc('get_tip_header'); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  const genesisBlock = await rpc('get_block_by_number', ['0x0']);
  const genesis = genesisBlock.header.hash;
  secp = { outPoint: { txHash: genesisBlock.transactions[1].hash, index: '0x0' }, depType: 'depGroup' };
  const hashes = {};
  for (const name of names) hashes[name] = hash(fs.readFileSync(path.join(build, name)));
  hashes.xudt = hash(fs.readFileSync(C.ROOT + '/vendor/ickb/build/release/xudt'));
  const deps = {};
  let genesisWallets = [];
  for (const t of genesisBlock.transactions) for (let i = 0; i < t.outputs.length; i++) {
    const dataHash = hash(b(t.outputs_data[i]));
    for (const [name, scriptHash] of Object.entries(hashes)) if (dataHash === scriptHash) deps[name] = { outPoint: { txHash: t.hash, index: hex(i) }, depType: 'code' };
    for (let role = 0; role < 3; role++) if (t.outputs[i].lock.args === locks[role].args) genesisWallets[role] = { ...C.camel(t.outputs[i]), capacity: BigInt(t.outputs[i].capacity), data: t.outputs_data[i], outPoint: { txHash: t.hash, index: hex(i) } };
  }
  assert.equal(Object.keys(deps).length, 6);
  for (let i = 0; i < 12; i++) await rpc('generate_block');
  const A = marketFor(genesisWallets[0], 0, genesis, hashes);
  const B = marketFor(genesisWallets[1], 1, genesis, hashes);
  assert.notEqual(U.scriptToHash(A.market), U.scriptToHash(B.market), 'market lineages must be distinct');
  assert.notEqual(U.scriptToHash(A.token), U.scriptToHash(B.token), 'xUDT identities must be distinct');
  assert.notEqual(U.scriptToHash(A.marker), U.scriptToHash(B.marker), 'market marker identities must be distinct');

  const reserveA = 200n * UNIT, reserveB = 200n * UNIT, walletCapacity = 1000n * UNIT;
  const setupInputs = [genesisWallets[2]];
  const setupTx = tx(setupInputs, [cell(reserveA, A.owner), cell(reserveB, B.owner), ...[2, 3, 4, 5].map(role => cell(walletCapacity, locks[role])), cell(genesisWallets[2].capacity - reserveA - reserveB - walletCapacity * 4n - fee, locks[2])]);
  const setup = await send('fund-two-lineage-test-wallets', sign(setupTx, setupInputs, 2));
  const issue = async (label, M) => {
    const inputs = [M.anchor, setup[M.role]];
    const issueTx = tx(inputs, [cell(300n * UNIT, M.market, M.token, hx(le(1000n, 16))), cell(300n * UNIT, M.market, M.marker, M.marketData), cell(M.anchor.capacity + setup[M.role].capacity - 600n * UNIT - fee, locks[M.role])], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
    const issued = await send(label, sign(issueTx, inputs, M.role));
    M.inventory = issued[0]; M.marketMarker = issued[1];
    M.lineage = { marketHash: U.scriptToHash(M.market), tokenHash: U.scriptToHash(M.token), markerHash: U.scriptToHash(M.marker), issueHash: issued[0].outPoint.txHash };
  };
  await issue('issue-market-A-independent-anchor', A);
  await issue('issue-market-B-independent-anchor', B);

  const initialize = async (label, M, buyerRole, setupIndex) => {
    const owner = U.scriptToHash(locks[buyerRole]);
    const records = Array.from({ length: 8 }, emptyRecord);
    records[0] = { owner, balance: 1n, revision: 0n };
    const custodyToken = { amount: 1n };
    const cost = 10n * UNIT;
    const inputs = [M.inventory, M.marketMarker, setup[setupIndex]];
    const t = tx(inputs, [cell(M.inventory.capacity + cost, M.market, M.token, hx(Buffer.concat([le(999n, 16), b(U.scriptToHash(M.custodyMarker))]))), cell(M.marketMarker.capacity, M.market, M.marker, M.marketData), cell(350n * UNIT, M.custody, M.token, custodyData(records)), cell(350n * UNIT, M.custody, M.custodyMarker, M.custodyMarkerData), cell(setup[setupIndex].capacity - cost - 700n * UNIT - fee, locks[buyerRole])], [deps.market, deps.marker_candidate, deps.custody_marker, deps.xudt]);
    t.headerDeps = [M.genesis];
    t.witnesses.push(hx(Buffer.concat([le(custodyToken.amount), le(10n * UNIT), ...records.map(recordBytes)])));
    const result = await send(label, sign(t, inputs, buyerRole));
    M.inventory = result[0]; M.marketMarker = result[1]; M.custodyCell = result[2]; M.custodyMarkerCell = result[3]; M.records = records;
    return result;
  };
  await initialize('initialize-market-A-custody', A, 2, 2);
  await initialize('initialize-market-B-custody', B, 3, 3);

  const continueBuy = async (label, M, buyerRole, setupIndex, expectedPrice) => {
    const old = recordsCopy(M.records), next = recordsCopy(old), owner = U.scriptToHash(locks[buyerRole]);
    const slot = next.findIndex(r => r.owner === ZERO);
    next[slot] = { owner, balance: 1n, revision: 1n };
    const price = expectedPrice;
    const inputs = [M.inventory, M.marketMarker, M.custodyCell, M.custodyMarkerCell, setup[setupIndex]];
    const t = tx(inputs, [cell(M.inventory.capacity + price, M.market, M.token, hx(Buffer.concat([le(BigInt('0x' + Buffer.from(b(M.inventory.data).subarray(0, 16)).reverse().toString('hex')) - 1n, 16), b(U.scriptToHash(M.custodyMarker))]))), cell(M.marketMarker.capacity, M.market, M.marker, M.marketData), cell(M.custodyCell.capacity, M.custody, M.token, custodyData(next)), cell(M.custodyMarkerCell.capacity, M.custody, M.custodyMarker, M.custodyMarkerData), cell(setup[setupIndex].capacity - price - fee, locks[buyerRole])], [deps.market, deps.marker_candidate, deps.custody, deps.custody_marker, deps.xudt]);
    t.headerDeps = [M.genesis];
    t.witnesses.push(witness(5, 0, slot, 1n, 0n, ZERO, old, next));
    const result = await send(label, sign(t, inputs, buyerRole));
    M.inventory = result[0]; M.marketMarker = result[1]; M.custodyCell = result[2]; M.custodyMarkerCell = result[3]; M.records = next;
    return { result, old, next, slot };
  };
  // Both market lineages have their own valid initial custody. A genuine
  // continuation purchase on B is the positive control for the attacked path.
  await continueBuy('positive-control-market-B-continuation', B, 4, 4, 11n * UNIT);

  const attackerRole = 5, buyer = U.scriptToHash(locks[attackerRole]);
  const reserveOld = recordsCopy(B.records), reserveNext = recordsCopy(reserveOld), reserveSlot = reserveNext.findIndex(r => r.owner === ZERO);
  reserveNext[reserveSlot] = { owner: buyer, balance: 1n, revision: 1n };
  const reservePrice = 12n * UNIT;
  const reserveInputs = [B.inventory, B.marketMarker, B.custodyCell, B.custodyMarkerCell, setup[5]];
  const reserveAttack = tx(reserveInputs, [cell(B.inventory.capacity + reservePrice - UNIT, B.market, B.token, hx(Buffer.concat([le(997n, 16), b(U.scriptToHash(B.custodyMarker))]))), cell(B.marketMarker.capacity, B.market, B.marker, B.marketData), cell(B.custodyCell.capacity, B.custody, B.token, custodyData(reserveNext)), cell(B.custodyMarkerCell.capacity, B.custody, B.custodyMarker, B.custodyMarkerData), cell(setup[5].capacity - reservePrice + UNIT - fee, locks[attackerRole])], [deps.market, deps.marker_candidate, deps.custody, deps.custody_marker, deps.xudt]);
  reserveAttack.headerDeps = [genesis];
  reserveAttack.witnesses.push(witness(5, 0, reserveSlot, 1n, 0n, ZERO, reserveOld, reserveNext));
  await rejectCase('market-reserve-one-ckb-extraction', sign(reserveAttack, reserveInputs, attackerRole), 'Inputs[0].Lock', 28, hashes.market);

  const oldA = recordsCopy(A.records), nextA = recordsCopy(oldA), slotA = nextA.findIndex(r => r.owner === ZERO);
  nextA[slotA] = { owner: buyer, balance: 1n, revision: 1n };
  const nextInventory = 997n;
  const priceB = 12n * UNIT;
  const attackInputs = [B.inventory, B.marketMarker, A.custodyCell, A.custodyMarkerCell, setup[5]];
  const attack = tx(attackInputs, [cell(B.inventory.capacity + priceB, B.market, B.token, hx(Buffer.concat([le(nextInventory, 16), b(U.scriptToHash(B.custodyMarker))]))), cell(B.marketMarker.capacity, B.market, B.marker, B.marketData), cell(A.custodyCell.capacity, A.custody, A.token, custodyData(nextA)), cell(A.custodyMarkerCell.capacity, A.custody, A.custodyMarker, A.custodyMarkerData), cell(setup[5].capacity - priceB - fee, locks[attackerRole])], [deps.market, deps.marker_candidate, deps.custody, deps.custody_marker, deps.xudt]);
  attack.headerDeps = [genesis];
  attack.witnesses.push(witness(5, 0, slotA, 1n, 0n, ZERO, oldA, nextA));
  const signedAttack = sign(attack, attackInputs, attackerRole);
  const error = await rejectCase('cross-market-A-custody-credited-by-market-B', signedAttack, [['Inputs[0].Lock', 22, hashes.market], ['Inputs[2].Lock', 20, hashes.custody]]);

  const attackRecord = {
    nativeVersion: await rpc('local_node_info'),
    markets: { A: A.lineage, B: B.lineage },
    positiveControl: 'market B initialization and continuation committed; hashes in events.jsonl',
    reserveExtraction: { rawTransactionHash: U.rawTransactionToHash(reserveAttack), description: 'diverts 1 CKB from the curve market output to the authorized buyer while preserving fee and occupied capacity', committedPositiveInput: B.inventory.outPoint },
    attack: { rawTransactionHash: U.rawTransactionToHash(signedAttack), error: error.message, rejectingSource: error.source, rejectingCode: error.code, rejectingScriptHash: error.scriptHash, marketBInput: B.inventory.outPoint, custodyAInput: A.custodyCell.outPoint, outputCustodyAAmount: '2', inputCustodyAAmount: '1' },
    interpretation: 'The independently initialized A and B lineages are crossed: the transaction spends B inventory/marker while attempting to credit A custody. The native VM rejects it in either the B Market asset/domain check or A Custody market-domain check, depending on script execution order; both are intended script checks. A and B issue/init controls and a valid B continuation committed.'
  };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(attackRecord, null, 2));
  console.log('evidence', out);
}

main().catch(error => { fs.writeFileSync(path.join(out, 'fatal.json'), JSON.stringify({ message: error.stack || error.message }, null, 2)); console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
