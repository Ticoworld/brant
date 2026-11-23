// Fresh disposable native-chain Gate2 smoke journey. Uses only locally controlled keys.
const C = require(process.env.TRADE_NATIVE_ROOT + '/src/lib.cjs');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { ccc } = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@ckb-ccc/core');
const signGroup = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const { fs, UNIT, fee, hex, hx, b, le, hash, locks, keys, U } = C;
const ckbBin = process.env.CKB_BIN || path.join(C.ROOT, 'tools/ckb');
const OWNER_TARGET = Number(process.env.TRADE_GATE2_OWNER_TARGET || 128);
const SUPPLY = BigInt(process.env.TRADE_GATE2_SUPPLY || '2000');
assert(OWNER_TARGET >= 3 && OWNER_TARGET <= 1024);
const recoveryOwnerKey = process.env.TRADE_GATE2_RECOVERY_OWNER_PRIVATE_KEY;
const recoveryOwnerRole = Number(process.env.TRADE_GATE2_RECOVERY_OWNER_ROLE || OWNER_TARGET + 1);
if (recoveryOwnerKey) {
  assert(/^0x[0-9a-f]{64}$/i.test(recoveryOwnerKey), 'recovery owner key must be a 32-byte hex value');
  assert(Number.isInteger(recoveryOwnerRole) && recoveryOwnerRole >= 4 && recoveryOwnerRole <= OWNER_TARGET + 1, 'recovery owner role must identify a batched owner position');
  U.privateKeyToPublicKey(recoveryOwnerKey);
}
for (let n = 4; n <= OWNER_TARGET + 2; n++) {
  const key = recoveryOwnerKey && n === recoveryOwnerRole + 1
    ? recoveryOwnerKey
    : '0x' + n.toString(16).padStart(64, '0');
  keys.push(key);
  locks.push({ codeHash: locks[0].codeHash, hashType: 'type', args: '0x' + U.blake160(U.privateKeyToPublicKey(key), 'hex') });
}
const recoveryOwnerLockHash = recoveryOwnerKey ? U.scriptToHash(locks[recoveryOwnerRole]) : null;

const out = path.join(__dirname, 'evidence', 'native-' + Date.now());
const build = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, 'build');
const chainRoot = process.env.TRADE_GATE2_CHAIN_ROOT || os.tmpdir();
fs.mkdirSync(chainRoot, { recursive: true });
const chain = fs.mkdtempSync(path.join(chainRoot, 'trade-gate2-')) + '/chain';
fs.mkdirSync(out, { recursive: true });
let child, secp, rpcSequence = 0;
let initializationTransactionHash;
const eventPath = path.join(out, 'events.jsonl');
function record(file, v) { fs.appendFileSync(path.join(out, file), JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x) + '\n'); }
async function rpc(method, params = []) {
  const res = await fetch('http://127.0.0.1:19224', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcSequence, method, params }),
  });
  const json = await res.json();
  record('rpc.jsonl', { method, params, response: json });
  if (json.error) throw Error(JSON.stringify(json.error));
  return json.result;
}
const cell = (capacity, lock, type, data = '0x') => ({ capacity: BigInt(capacity), lock, type, data });
function tx(inputs, outputs, deps = []) {
  for (const [i, output] of outputs.entries()) assert(output.lock && output.lock.codeHash && output.lock.hashType && output.lock.args !== undefined, `output ${i} has incomplete lock: ${JSON.stringify({ lock: output.lock, type: output.type })}`);
  return {
    version: '0x0', cellDeps: [secp, ...deps], headerDeps: [],
    inputs: inputs.map(x => ({ previousOutput: x.outPoint, since: '0x0' })),
    outputs: outputs.map(x => ({ capacity: hex(x.capacity), lock: x.lock, ...(x.type ? { type: x.type } : {}) })),
    outputsData: outputs.map(x => x.data), witnesses: inputs.map(() => '0x'),
  };
}
function sign(t, inputs, roles) {
  t = structuredClone(t);
  for (const role of [...new Set(roles)]) {
    const indices = inputs.map((c, i) => U.scriptToHash(c.lock) === U.scriptToHash(locks[role]) ? i : -1).filter(i => i >= 0);
    assert(indices.length, `missing signer input for role ${role}`);
    const i = indices[0], h = U.rawTransactionToHash(t);
    const group = [{ lock: '', inputType: '', outputType: '' }, ...indices.slice(1).map(j => t.witnesses[j]), ...t.witnesses.slice(inputs.length)];
    t.witnesses[i] = signGroup(keys[role], h, group)[0];
  }
  return t;
}
async function commit(label, signed) {
  const cycles = await rpc('estimate_cycles', [C.snake(signed)]);
  const hashValue = await rpc('send_transaction', [C.snake(signed), 'passthrough']);
  if (label === 'initial_curve_purchase') initializationTransactionHash = hashValue;
  let result;
  for (let i = 0; i < 60; i++) {
    result = await rpc('get_transaction', [hashValue]);
    if (result.tx_status.status === 'committed') break;
    await rpc('generate_block');
  }
  assert.equal(result.tx_status.status, 'committed', `${label} was not committed`);
  record('events.jsonl', { label, hash: hashValue, cycles, tx: signed, committed: result });
  console.log(`${label} ${hashValue} cycles=${cycles.cycles}`);
  return signed.outputs.map((x, i) => ({ ...x, capacity: BigInt(x.capacity), data: signed.outputsData[i], outPoint: { txHash: hashValue, index: hex(i) } }));
}
async function reject(label, signed, expectedCode) {
  let error;
  try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (caught) { error = caught; }
  assert(error, `${label} was accepted`);
  const result = JSON.parse(error.message);
  assert.match(result.message, new RegExp(`ValidationFailure: see error code ${expectedCode}\\b`), result.message);
  record('rejections.jsonl', { label, expectedCode, error: error.message, tx: signed });
  console.log(`rejected ${label} code=${expectedCode}`);
}
function orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId) {
  return `TRADE V2 MERKLE TOKEN SALE v1\nGenesis: ${domain.genesis_hash}\nMarket: ${domain.market_script_hash}\nAsset: ${domain.xudt_type_script_hash}\nCustody: ${custodyHash}\nSeller: ${seller}\nRevision: ${revision}\nQuantity: ${quantity}\nMinimum shannons: ${minimum}\nPayout: ${payout}\nOrder id: ${orderId}\nBuyer: any\nExpiry: none`;
}
async function signedOrder(domain, custodyHash, sellerRole, revision, quantity, minimum, payout, orderId) {
  const seller = U.scriptToHash(locks[sellerRole]);
  const message = orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId);
  const signer = new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), keys[sellerRole]);
  const signature = b(await signer.signMessageRaw(message));
  const publicKey = b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message), hx(signature)));
  assert.equal(signature.length, 65);
  assert.equal(publicKey.length, 33);
  const extra = Buffer.concat([le(quantity), le(minimum), b(orderId), b(seller), b(payout), publicKey, signature]);
  assert.equal(extra.length, 210);
  return { extra, message, signature, publicKey, seller };
}
function proofInput(domain, op, owners, updates) {
  return { domain, op, owners: owners.map(x => ({ owner_lock_hash: x.owner, balance: String(x.balance), revision: String(x.revision), active: x.balance > 0n })),
    updates: updates.map(x => ({ owner_lock_hash: x.owner, balance: String(x.balance), revision: String(x.revision), active: x.balance > 0n })) };
}
function makeProof(domain, op, owners, updates, extra = Buffer.alloc(0)) {
  const data = JSON.stringify(proofInput(domain, op, owners, updates));
  const args = ['run', '--quiet', '--locked', '--manifest-path', path.join(__dirname, 'smt-tools', 'Cargo.toml'), '--', 'proof', '-', '-'];
  const result = execFileSync('cargo', args, { input: data, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(result);
  return { root: parsed.new_root, witness: hx(Buffer.concat([b(parsed.contract_witness.hex), extra])), parsed };
}
function u128(amount, root) { return hx(Buffer.concat([le(amount, 16), b(root)])); }

async function main() {
  execFileSync(process.execPath, [path.join(C.ROOT, 'src/setup.cjs'), chain], { stdio: 'inherit', env: { ...process.env, CKB_BIN: ckbBin } });
  let spec = fs.readFileSync(path.join(chain, 'specs/dev.toml'), 'utf8'), extra = '';
  const names = ['marker_candidate', 'market_smt', 'owner_lineage_candidate', 'custody_smt', 'custody_marker'];
  for (const name of names) {
    fs.copyFileSync(path.join(build, name), path.join(chain, name));
    extra += `[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n\n`;
  }
  spec = spec.replace('[genesis.system_cells_lock]', extra + '[genesis.system_cells_lock]');
  fs.writeFileSync(path.join(chain, 'specs/dev.toml'), spec);
  const nodeArgs = ['run', '-C', chain, '--ba-advanced'];
  if (process.env.TRADE_SHARED_LAUNCH_MODULE) nodeArgs.push('--indexer');
  child = spawn(ckbBin, nodeArgs, { stdio: ['ignore', fs.openSync(path.join(out, 'node.log'), 'w'), 'ignore'] });
  for (let i = 0; i < 180; i++) {
    try { await rpc('get_tip_header'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  const genesis = await rpc('get_block_by_number', ['0x0']);
  secp = { outPoint: { txHash: genesis.transactions[1].hash, index: '0x0' }, depType: 'depGroup' };
  const hashes = Object.fromEntries(names.map(name => [name, hash(fs.readFileSync(path.join(build, name)))]));
  hashes.xudt = hash(fs.readFileSync(path.join(C.ROOT, 'vendor/ickb/build/release/xudt')));
  const deps = {};
  const wallets = [];
  for (const t of genesis.transactions) for (let i = 0; i < t.outputs.length; i++) {
    const dataHash = hash(b(t.outputs_data[i]));
    for (const [name, codeHash] of Object.entries(hashes)) if (dataHash === codeHash) deps[name] = { outPoint: { txHash: t.hash, index: hex(i) }, depType: 'code' };
    for (let role = 0; role < 3; role++) if (t.outputs[i].lock.args === locks[role].args) wallets[role] = { ...C.camel(t.outputs[i]), capacity: BigInt(t.outputs[i].capacity), data: t.outputs_data[i], outPoint: { txHash: t.hash, index: hex(i) } };
  }
  assert.equal(Object.keys(deps).length, 6);
  for (let i = 0; i < 12; i++) await rpc('generate_block');

  if (process.env.TRADE_SHARED_LAUNCH_MODULE) {
    const {pathToFileURL} = require('node:url');
    const {runSharedLaunch} = await import(pathToFileURL(process.env.TRADE_SHARED_LAUNCH_MODULE).href);
    await runSharedLaunch({rpc, genesis: genesis.header.hash, hashes, deps, secp, wallets, locks,
      cell, tx, sign, commit, makeProof, le, out, camel: C.camel});
    return;
  }

  const anchor = wallets[0];
  const anchorBytes = Buffer.concat([b(anchor.outPoint.txHash), le(BigInt(anchor.outPoint.index), 4)]);
  const markerId = hash(Buffer.concat([le(0), anchorBytes, le(1)]));
  const marker = { codeHash: hashes.marker_candidate, hashType: 'data1', args: markerId };
  const market = { codeHash: hashes.market_smt, hashType: 'data1', args: hx(Buffer.concat([b(hash(anchorBytes)), le(10n * UNIT), le(UNIT), le(SUPPLY), b(U.scriptToHash(marker))])) };
  const owner = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([anchorBytes, b(hashes.xudt), b(U.scriptToHash(market)), le(SUPPLY, 16)])) };
  const token = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(owner) };
  const markerData = hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token))]));
  const custodyMarker = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(market) };
  const custody = { codeHash: hashes.custody_smt, hashType: 'data1', args: hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token)), b(genesis.header.hash), b(U.scriptToHash(custodyMarker))])) };
  const custodyMarkerData = hx(Buffer.concat([b(U.scriptToHash(custody)), b(U.scriptToHash(token))]));
  const marketId = U.scriptToHash(market), assetId = U.scriptToHash(token), markerIdHash = U.scriptToHash(custodyMarker);
  const domain = { genesis_hash: genesis.header.hash, market_script_hash: marketId, xudt_type_script_hash: assetId, custody_marker_type_hash: markerIdHash };

  const setup = await commit('fund', sign(tx([wallets[2]], [
    cell(200n * UNIT, owner), cell(2000n * UNIT, locks[1]), cell(2000n * UNIT, locks[2]),
    cell(1000n * UNIT, locks[3]), cell(200n * UNIT, owner), cell(wallets[2].capacity - 5400n * UNIT - fee, locks[2]),
  ]), [wallets[2]], [2]));

  const issue = tx([anchor, setup[0]], [
    cell(300n * UNIT, market, token, hx(le(SUPPLY, 16))), cell(300n * UNIT, market, marker, markerData),
    cell(anchor.capacity + setup[0].capacity - 600n * UNIT - fee, locks[0]),
  ], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
  const issued = await commit('issue_fixed_supply', sign(issue, [anchor, setup[0]], [0]));

  // The initial market purchase proves a new leaf from the empty authenticated root.
  const initialQty = 7n, initialPrice = 91n * UNIT, initialInventory = SUPPLY - initialQty;
  const initBuyer = U.scriptToHash(locks[1]);
  const init = makeProof(domain, 0, [], [{ owner: initBuyer, balance: initialQty, revision: 0n }], le(initialPrice));
  fs.writeFileSync(path.join(out, 'init-proof.json'), JSON.stringify(init.parsed, null, 2));
  const initTx = tx([issued[0], issued[1], setup[1]], [
    cell(issued[0].capacity + initialPrice, market, token, hx(Buffer.concat([le(initialInventory, 16), b(U.scriptToHash(custodyMarker))]))),
    cell(issued[1].capacity, market, marker, markerData),
    cell(350n * UNIT, custody, token, u128(initialQty, init.root)),
    cell(350n * UNIT, custody, custodyMarker, custodyMarkerData),
    cell(setup[1].capacity - initialPrice - 700n * UNIT - fee, locks[1]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  initTx.headerDeps = [genesis.header.hash];
  initTx.witnesses.push(init.witness);
  const initial = await commit('initial_curve_purchase', sign(initTx, [issued[0], issued[1], setup[1]], [1]));
  assert.equal(initial[2].data, u128(initialQty, init.root));

  // An existing holder buys again, advancing its authenticated revision.
  let inventoryCell = initial[0], marketMarkerCell = initial[1], custodyCell = initial[2], custodyMarkerCell = initial[3];
  let inventoryAmount = initialInventory;
  const existingOld = { owner: initBuyer, balance: initialQty, revision: 0n };
  const existingQty = 1n, existingPrice = 10n * UNIT + UNIT * (SUPPLY - inventoryAmount);
  const existingNext = { owner: initBuyer, balance: initialQty + existingQty, revision: 1n };
  const existingProof = makeProof(domain, 1, [existingOld], [existingNext]);
  const existingInputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, initial[4]];
  const existingTx = tx(existingInputs, [
    cell(inventoryCell.capacity + existingPrice, market, token, hx(Buffer.concat([le(inventoryAmount - existingQty, 16), b(markerIdHash)]))),
    cell(marketMarkerCell.capacity, market, marker, markerData),
    cell(custodyCell.capacity, custody, token, u128(initialQty + existingQty, existingProof.root)),
    cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(initial[4].capacity - existingPrice - fee, locks[1]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  existingTx.headerDeps = [genesis.header.hash];
  existingTx.witnesses.push(existingProof.witness);
  if (process.env.TRADE_GATE2_COMPETING_BUYS === '1') {
    const quantity = 2n;
    const price = 2n * existingPrice + UNIT;
    const proof = makeProof(domain, 1, [existingOld], [{...existingNext, balance: initialQty + quantity}]);
    const competitor = tx(existingInputs, [
      cell(inventoryCell.capacity + price, market, token, hx(Buffer.concat([le(inventoryAmount - quantity, 16), b(markerIdHash)]))),
      cell(marketMarkerCell.capacity, market, marker, markerData),
      cell(custodyCell.capacity, custody, token, u128(initialQty + quantity, proof.root)),
      cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(initial[4].capacity - price - fee, locks[1]),
    ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
    competitor.headerDeps = [genesis.header.hash];
    competitor.witnesses.push(proof.witness);
    const first = sign(existingTx, existingInputs, [1]);
    const second = sign(competitor, existingInputs, [1]);
    const firstHash = ccc.Transaction.from(first).hash();
    const secondHash = ccc.Transaction.from(second).hash();
    assert.notEqual(firstHash, secondHash);
    const firstCycles = await rpc('estimate_cycles', [C.snake(first)]);
    const secondCycles = await rpc('estimate_cycles', [C.snake(second)]);
    const winner = await commit('competing_buy_winner', first);
    let rejection;
    try { await rpc('send_transaction', [C.snake(second), 'passthrough']); }
    catch (error) { rejection = JSON.parse(error.message); }
    assert.match(rejection?.message || '', /dead|resolve/i);
    await rpc('generate_block');
    const loser = await rpc('get_transaction', [secondHash]);
    assert.notEqual(loser?.tx_status?.status, 'committed');
    const predecessor = await rpc('get_live_cell', [C.snake(inventoryCell.outPoint), true]);
    assert.notEqual(predecessor.status, 'live');
    const cells = await Promise.all(winner.slice(0,4).map(output=>rpc('get_live_cell',[C.snake(output.outPoint),true])));
    assert(cells.every(item=>item.status==='live'));
    record('competition.jsonl', {firstHash,secondHash,firstCycles,secondCycles,winnerStatus:await rpc('get_transaction',[firstHash]),loser,rejection,predecessor,cells,competitor:C.snake(second)});
    console.log('Competition evidence', out);
    return;
  }
  const existingPurchase = await commit('existing_owner_additional_purchase', sign(existingTx, existingInputs, [1]));
  inventoryCell = existingPurchase[0]; marketMarkerCell = existingPurchase[1]; custodyCell = existingPurchase[2]; custodyMarkerCell = existingPurchase[3];
  inventoryAmount -= existingQty;

  // A distinct wallet enrolls against the updated root through another native curve buy.
  const q = 2n, beforeInventory = inventoryAmount, afterInventory = beforeInventory - q;
  const soldBeforeEnrollment = SUPPLY - beforeInventory;
  const price = 2n * 10n * UNIT + UNIT * (2n * soldBeforeEnrollment + 1n);
  const buyer2 = U.scriptToHash(locks[2]);
  const current = [existingNext];
  const step = makeProof(domain, 1, current, [{ owner: buyer2, balance: q, revision: 1n }]);
  const buyInputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, setup[2]];
  const buyTx = tx(buyInputs, [
    cell(inventoryCell.capacity + price, market, token, hx(Buffer.concat([le(afterInventory, 16), b(U.scriptToHash(custodyMarker))]))),
    cell(marketMarkerCell.capacity, market, marker, markerData),
    cell(custodyCell.capacity, custody, token, u128(initialQty + existingQty + q, step.root)),
    cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(setup[2].capacity - price - fee, locks[2]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  buyTx.headerDeps = [genesis.header.hash];
  buyTx.witnesses.push(step.witness);
  const enrolled = await commit('new_buyer_enrollment', sign(buyTx, buyInputs, [2]));
  const offlineOrder = await signedOrder(
    domain, U.scriptToHash(custody), 1, existingNext.revision, 3n, 70n * UNIT,
    U.scriptToHash(locks[1]), '0x' + 'a1'.repeat(32));
  record('offline-order.json', {
    message: offlineOrder.message,
    quantity: '3',
    minimum_proceeds_shannons: (70n * UNIT).toString(),
    seller_lock_hash: offlineOrder.seller,
    payout_lock_hash: U.scriptToHash(locks[1]),
    order_id: '0x' + 'a1'.repeat(32),
    signature: hx(offlineOrder.signature),
    public_key: hx(offlineOrder.publicKey),
    signed_at_root: enrolled[2].data.slice(34),
  });

  // Extend the same authenticated state past the old eight-owner ceiling.
  const ownerFunding = [setup[5]];
  const fundedCapacity = ownerFunding.reduce((sum, x) => sum + x.capacity, 0n);
  const newOwnerCount = OWNER_TARGET - 2;
  const ownerWalletCapacity = 1200n * UNIT;
  const ownerCells = Array.from({ length: newOwnerCount }, (_, i) => cell(ownerWalletCapacity, locks[i + 4]));
  ownerCells.push(cell(fundedCapacity - BigInt(newOwnerCount) * ownerWalletCapacity - fee, locks[2]));
  const fundingTx = tx(ownerFunding, ownerCells, []);
  const fundedOwners = await commit(`fund_${newOwnerCount}_owner_wallets`, sign(fundingTx, ownerFunding, [2]));
  const newOwnerCells = fundedOwners.slice(0, newOwnerCount);
  inventoryCell = enrolled[0]; marketMarkerCell = enrolled[1]; custodyCell = enrolled[2]; custodyMarkerCell = enrolled[3];
  inventoryAmount = afterInventory;
  const positions = [...current, { owner: buyer2, balance: q, revision: 1n }];
  const ownerWallets = new Map([[1, existingPurchase[4]], [2, enrolled[4]]]);
  for (let offset = 0; offset < newOwnerCells.length; offset += 16) {
    const batch = newOwnerCells.slice(offset, offset + 16), batchUpdates = [], buyerOutputs = [], metadata = [], buyerRoles = [];
    let allocated = 0n, grossTotal = 0n;
    for (let j = 0; j < batch.length; j++) {
      const ownerRole = offset + j + 4, lockHash = U.scriptToHash(locks[ownerRole]);
      const sold = SUPPLY - inventoryAmount + allocated, gross = 10n * UNIT + sold * UNIT, share = j === 0 ? fee : 0n;
      const update = { owner: lockHash, balance: 1n, revision: 1n };
      batchUpdates.push(update); buyerRoles.push(ownerRole);
      buyerOutputs.push(cell(batch[j].capacity - gross - share, locks[ownerRole]));
      metadata.push(le(1n), le(gross), le(share));
      allocated++; grossTotal += gross;
    }
    const proof = makeProof(domain, 2, positions, batchUpdates);
    const inputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, ...batch];
    const outputs = [
      cell(inventoryCell.capacity + grossTotal, market, token, hx(Buffer.concat([le(inventoryAmount - allocated, 16), b(markerIdHash)]))),
      cell(marketMarkerCell.capacity, market, marker, markerData),
      cell(custodyCell.capacity, custody, token, u128(positions.reduce((s, p) => s + p.balance, 0n) + allocated, proof.root)),
      cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
      ...buyerOutputs,
    ];
    const purchase = tx(inputs, outputs, [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
    purchase.headerDeps = [genesis.header.hash];
    purchase.witnesses.push(proof.witness, hx(Buffer.concat(metadata)));
    const result = await commit(`owners_${positions.length + batch.length}_batch_${batch.length}`, sign(purchase, inputs, buyerRoles));
    inventoryCell = result[0]; marketMarkerCell = result[1]; custodyCell = result[2]; custodyMarkerCell = result[3];
    for (let j = 0; j < batch.length; j++) ownerWallets.set(offset + j + 4, result[4 + j]);
    inventoryAmount -= allocated; positions.push(...batchUpdates);
  }

  assert.equal(positions.length, OWNER_TARGET);
  assert.equal(inventoryAmount + positions.reduce((sum, p) => sum + p.balance, 0n), SUPPLY);

  // Fill the offline seller order after all owner-batch root changes.
  const sellerPosition = positions.find(p => p.owner === offlineOrder.seller);
  const buyerPosition = positions.find(p => p.owner === buyer2);
  assert(sellerPosition && buyerPosition && sellerPosition.balance >= 3n);
  const signedAtRoot = b(enrolled[2].data).subarray(16);
  const rootBeforeFill = b(custodyCell.data).subarray(16);
  assert(!signedAtRoot.equals(rootBeforeFill), 'unrelated owner transitions did not change the authenticated root');
  const sellerAfterOrder = { owner: sellerPosition.owner, balance: sellerPosition.balance - 3n, revision: sellerPosition.revision + 1n };
  const buyerAfterOrder = { owner: buyerPosition.owner, balance: buyerPosition.balance + 3n, revision: buyerPosition.revision + 1n };
  const orderFillProof = makeProof(domain, 8, positions, [sellerAfterOrder, buyerAfterOrder], offlineOrder.extra);
  const orderPayer = ownerWallets.get(2);
  const orderMinimum = 70n * UNIT;
  const fillInputs = [custodyCell, custodyMarkerCell, orderPayer];
  const fillOutputs = [
    cell(custodyCell.capacity, custody, token, u128(positions.reduce((sum, p) => sum + p.balance, 0n), orderFillProof.root)),
    cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(orderPayer.capacity - orderMinimum - fee, locks[2]),
    cell(orderMinimum, locks[1]),
  ];
  const orderFillTx = tx(fillInputs, fillOutputs, [deps.custody_smt, deps.custody_marker, deps.xudt]);
  orderFillTx.headerDeps = [genesis.header.hash];
  orderFillTx.witnesses.push(orderFillProof.witness);
  const wrongPayout = structuredClone(orderFillTx);
  wrongPayout.outputs[3].lock = locks[3];
  await reject('offline_order_payout_redirect', sign(wrongPayout, fillInputs, [2]), 34);
  const underpaid = structuredClone(orderFillTx);
  underpaid.outputs[2].capacity = hex(orderPayer.capacity - orderMinimum + UNIT - fee);
  underpaid.outputs[3].capacity = hex(orderMinimum - UNIT);
  await reject('offline_order_minimum_underpayment', sign(underpaid, fillInputs, [2]), 34);
  const badSignature = structuredClone(orderFillTx);
  const signatureWitness = b(badSignature.witnesses[3]);
  signatureWitness[signatureWitness.length - 1] ^= 1;
  badSignature.witnesses[3] = hx(signatureWitness);
  await reject('offline_order_tampered_signature', sign(badSignature, fillInputs, [2]), 38);
  const filledOrder = await commit('offline_order_fill_after_unrelated_owner_changes', sign(orderFillTx, fillInputs, [2]));
  const sellerIndex = positions.indexOf(sellerPosition), buyerIndex = positions.indexOf(buyerPosition);
  positions[sellerIndex] = sellerAfterOrder;
  positions[buyerIndex] = buyerAfterOrder;
  custodyCell = filledOrder[0]; custodyMarkerCell = filledOrder[1]; ownerWallets.set(2, filledOrder[2]);

  // A second order is canceled by its owner; both consumed and canceled signatures are stale.
  const canceledOrder = await signedOrder(
    domain, U.scriptToHash(custody), 1, sellerAfterOrder.revision, 1n, 70n * UNIT,
    U.scriptToHash(locks[1]), '0x' + 'b2'.repeat(32));
  const sellerCanceled = { owner: sellerAfterOrder.owner, balance: sellerAfterOrder.balance, revision: sellerAfterOrder.revision + 1n };
  const cancelProof = makeProof(domain, 7, positions, [sellerCanceled]);
  const sellerWallet = ownerWallets.get(1);
  const cancelInputs = [custodyCell, custodyMarkerCell, sellerWallet];
  const cancelTx = tx(cancelInputs, [
    cell(custodyCell.capacity, custody, token, u128(positions.reduce((sum, p) => sum + p.balance, 0n), cancelProof.root)),
    cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(sellerWallet.capacity - fee, locks[1]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  cancelTx.witnesses.push(cancelProof.witness);
  const canceled = await commit('offline_order_owner_cancellation', sign(cancelTx, cancelInputs, [1]));
  positions[sellerIndex] = sellerCanceled;
  custodyCell = canceled[0]; custodyMarkerCell = canceled[1]; ownerWallets.set(1, canceled[2]);

  for (const [label, staleOrder, staleQuantity] of [
    ['offline_order_consumed_revision_replay', offlineOrder, 3n],
    ['offline_order_canceled_revision_replay', canceledOrder, 1n],
  ]) {
    const sellerNow = positions[sellerIndex], buyerNow = positions[buyerIndex];
    const staleSeller = { owner: sellerNow.owner, balance: sellerNow.balance - staleQuantity, revision: sellerNow.revision + 1n };
    const staleBuyer = { owner: buyerNow.owner, balance: buyerNow.balance + staleQuantity, revision: buyerNow.revision + 1n };
    const staleProof = makeProof(domain, 8, positions, [staleSeller, staleBuyer], staleOrder.extra);
    const payer = ownerWallets.get(2);
    const signedMinimum = BigInt('0x' + Buffer.from(staleOrder.extra.subarray(8, 16)).reverse().toString('hex'));
    const staleInputs = [custodyCell, custodyMarkerCell, payer];
    const staleTx = tx(staleInputs, [
      cell(custodyCell.capacity, custody, token, u128(positions.reduce((sum, p) => sum + p.balance, 0n), staleProof.root)),
      cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(payer.capacity - signedMinimum - fee, locks[2]), cell(signedMinimum, locks[1]),
    ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
    staleTx.headerDeps = [genesis.header.hash];
    staleTx.witnesses.push(staleProof.witness);
    await reject(label, sign(staleTx, staleInputs, [2]), 38);
  }

  // Owner-authorized withdrawal preserves all other authenticated leaves.
  const withdrawOwner = positions.find(p => p.owner === buyer2);
  assert(withdrawOwner && withdrawOwner.balance >= 1n);
  const withdrawnPosition = { owner: buyer2, balance: withdrawOwner.balance - 1n, revision: withdrawOwner.revision + 1n };
  const withdrawal = makeProof(domain, 5, positions, [withdrawnPosition]);
  const withdrawFunding = fundedOwners[newOwnerCount];
  const tokenCapacity = 142n * UNIT;
  const withdrawInputs = [custodyCell, custodyMarkerCell, withdrawFunding];
  const withdrawTx = tx(withdrawInputs, [
    cell(custodyCell.capacity, custody, token, u128(positions.reduce((sum, p) => sum + p.balance, 0n) - 1n, withdrawal.root)),
    cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(tokenCapacity, locks[2], token, hx(le(1n, 16))),
    cell(withdrawFunding.capacity - tokenCapacity - fee, locks[2]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawTx.witnesses.push(withdrawal.witness);
  const withdrawn = await commit('owner_authorized_external_withdrawal', sign(withdrawTx, withdrawInputs, [2]));
  positions[positions.indexOf(withdrawOwner)] = withdrawnPosition;
  custodyCell = withdrawn[0]; custodyMarkerCell = withdrawn[1];
  ownerWallets.set(2, withdrawn[3]);
  assert.equal(positions.reduce((sum, p) => sum + p.balance, 0n) + 1n + inventoryAmount, SUPPLY);

  const runFullSellDown = process.env.TRADE_GATE2_FULL_SELLDOWN === '1';
  let finalExternal = withdrawn[2];
  if (runFullSellDown) {
    // Redeem the real withdrawn xUDT through the same reverse curve.
    const externalQty = BigInt('0x' + Buffer.from(b(finalExternal.data).subarray(0, 16)).reverse().toString('hex'));
    assert(externalQty > 0n);
    const soldBeforeExternal = SUPPLY - inventoryAmount;
    const externalPrice = 10n * UNIT * externalQty + UNIT * (externalQty * (soldBeforeExternal - externalQty) + externalQty * (externalQty - 1n) / 2n);
    const externalWallet = ownerWallets.get(2);
    const externalInputs = [inventoryCell, marketMarkerCell, finalExternal, externalWallet];
    const externalTx = tx(externalInputs, [
      cell(inventoryCell.capacity - externalPrice, market, token, hx(Buffer.concat([le(inventoryAmount + externalQty, 16), b(markerIdHash)]))),
      cell(marketMarkerCell.capacity, market, marker, markerData),
      cell(BigInt(finalExternal.capacity), locks[2], token, hx(le(0n, 16))),
      cell(externalWallet.capacity + externalPrice - fee, locks[2]),
    ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
    externalTx.witnesses.push(hx(Buffer.concat([le(externalQty), le(externalPrice)])));
    const redeemed = await commit('external_xudt_curve_redemption', sign(externalTx, externalInputs, [2]));
    inventoryCell = redeemed[0]; marketMarkerCell = redeemed[1]; finalExternal = redeemed[2];
    ownerWallets.set(2, redeemed[3]); inventoryAmount += externalQty;
    assert.equal(BigInt('0x' + Buffer.from(b(finalExternal.data).subarray(0, 16)).reverse().toString('hex')), 0n);

    // Sell every internal balance in owner-signed curve transactions.
    for (let i = 0; i < positions.length; i++) {
      const old = positions[i];
      if (old.balance === 0n) continue;
      const role = i === 0 ? 1 : i === 1 ? 2 : i + 2;
      const sellerWallet = ownerWallets.get(role);
      assert(sellerWallet, `missing current CKB cell for holder role ${role}`);
      const sellQty = old.balance;
      const sold = SUPPLY - inventoryAmount;
      const payout = 10n * UNIT * sellQty + UNIT * (sellQty * (sold - sellQty) + sellQty * (sellQty - 1n) / 2n);
      const next = { owner: old.owner, balance: 0n, revision: old.revision + 1n };
      const proof = makeProof(domain, 4, positions, [next], Buffer.concat([le(sellQty), le(payout)]));
      const sellInputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, sellerWallet];
      const sellTx = tx(sellInputs, [
        cell(inventoryCell.capacity - payout, market, token, hx(Buffer.concat([le(inventoryAmount + sellQty, 16), b(markerIdHash)]))),
        cell(marketMarkerCell.capacity, market, marker, markerData),
        cell(custodyCell.capacity, custody, token, u128(positions.reduce((s, p) => s + p.balance, 0n) - sellQty, proof.root)),
        cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
        cell(sellerWallet.capacity + payout - fee, locks[role]),
      ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
      sellTx.witnesses.push(proof.witness);
      const soldResult = await commit(`curve_sell_owner_${i}_q${sellQty}`, sign(sellTx, sellInputs, [role]));
      inventoryCell = soldResult[0]; marketMarkerCell = soldResult[1]; custodyCell = soldResult[2]; custodyMarkerCell = soldResult[3];
      ownerWallets.set(role, soldResult[4]); positions[i] = next; inventoryAmount += sellQty;
      assert.equal(inventoryAmount + positions.reduce((s, p) => s + p.balance, 0n), SUPPLY);
    }
    assert.equal(inventoryAmount, SUPPLY);
    assert.equal(positions.reduce((s, p) => s + p.balance, 0n), 0n);
    assert.equal(BigInt('0x' + Buffer.from(b(finalExternal.data).subarray(0, 16)).reverse().toString('hex')), 0n);
    assert.equal(inventoryCell.capacity, 300n * UNIT, 'full curve sell-down restores initial reserve capacity');

    // Rebuy and sell once after full sell-down; the singleton and tombstone lineage remain live.
    const roundtripIndex = 0, roundtripOld = positions[roundtripIndex], roundtripRole = 1;
    const roundtripWallet = ownerWallets.get(roundtripRole), roundtripPrice = 10n * UNIT;
    const roundtripNext = { owner: roundtripOld.owner, balance: 1n, revision: roundtripOld.revision + 1n };
    const rebuyProof = makeProof(domain, 1, positions, [roundtripNext]);
    const rebuyInputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, roundtripWallet];
    const rebuyTx = tx(rebuyInputs, [
      cell(inventoryCell.capacity + roundtripPrice, market, token, hx(Buffer.concat([le(SUPPLY - 1n, 16), b(markerIdHash)]))),
      cell(marketMarkerCell.capacity, market, marker, markerData),
      cell(custodyCell.capacity, custody, token, u128(1n, rebuyProof.root)),
      cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(roundtripWallet.capacity - roundtripPrice - fee, locks[roundtripRole]),
    ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
    rebuyTx.witnesses.push(rebuyProof.witness);
    const rebought = await commit('post_selldown_rebuy_same_lineage', sign(rebuyTx, rebuyInputs, [roundtripRole]));
    inventoryCell = rebought[0]; marketMarkerCell = rebought[1]; custodyCell = rebought[2]; custodyMarkerCell = rebought[3]; ownerWallets.set(roundtripRole, rebought[4]);
    positions[roundtripIndex] = roundtripNext; inventoryAmount = SUPPLY - 1n;

    const roundtripSell = { owner: roundtripOld.owner, balance: 0n, revision: roundtripNext.revision + 1n };
    const roundtripSellProof = makeProof(domain, 4, positions, [roundtripSell], Buffer.concat([le(1n), le(roundtripPrice)]));
    const roundtripSellWallet = ownerWallets.get(roundtripRole);
    const roundtripSellInputs = [inventoryCell, marketMarkerCell, custodyCell, custodyMarkerCell, roundtripSellWallet];
    const roundtripSellTx = tx(roundtripSellInputs, [
      cell(inventoryCell.capacity - roundtripPrice, market, token, hx(Buffer.concat([le(SUPPLY, 16), b(markerIdHash)]))),
      cell(marketMarkerCell.capacity, market, marker, markerData),
      cell(custodyCell.capacity, custody, token, u128(0n, roundtripSellProof.root)),
      cell(custodyMarkerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(roundtripSellWallet.capacity + roundtripPrice - fee, locks[roundtripRole]),
    ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
    roundtripSellTx.witnesses.push(roundtripSellProof.witness);
    const finalRoundtrip = await commit('post_selldown_sell_again_same_lineage', sign(roundtripSellTx, roundtripSellInputs, [roundtripRole]));
    inventoryCell = finalRoundtrip[0]; marketMarkerCell = finalRoundtrip[1]; custodyCell = finalRoundtrip[2]; custodyMarkerCell = finalRoundtrip[3]; ownerWallets.set(roundtripRole, finalRoundtrip[4]); positions[roundtripIndex] = roundtripSell;
    inventoryAmount = SUPPLY;
    assert.equal(inventoryCell.capacity, 300n * UNIT);
  }

  const tip = await rpc('get_tip_header');
  const result = { out, chain, genesis: genesis.header.hash, tip: tip.hash, initializationTransactionHash, hashes, scripts: { market, marker, owner, token, custody, custodyMarker }, roots: { initial: init.root, enrolled: step.root, final: custodyCell.data.slice(34) }, owners: positions.length, supply: SUPPLY.toString(), internalEntitlements: positions.reduce((sum, p) => sum + p.balance, 0n).toString(), marketInventory: inventoryAmount.toString(), withdrawnExternal: withdrawn[2].data, externalAfterRedemption: finalExternal.data, fullSellDown: runFullSellDown, finalCustody: custodyCell.outPoint, finalMarket: inventoryCell.outPoint, finalMarketCapacity: inventoryCell.capacity.toString(), ...(recoveryOwnerLockHash ? { recoveryOwnerLockHash } : {}) };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(result, null, 2));
  console.log('Evidence ' + out);
  if (process.env.TRADE_KEEP_NATIVE_NODE === '1') {
    fs.writeFileSync(path.join(out, 'node.pid'), `${child.pid}\n`);
    const stopFile = path.join(out, 'stop-node');
    while (!fs.existsSync(stopFile)) await new Promise(resolve => setTimeout(resolve, 500));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
