const C = require(process.env.TRADE_NATIVE_ROOT + '/src/lib.cjs');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { ccc } = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@ckb-ccc/core');
const signGroup = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const { fs, UNIT, fee, hex, hx, b, le, hash, locks, keys, U } = C;

const out = path.join(__dirname, 'evidence', 'native-' + Date.now());
const build = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, '..', 'build');
const ckbBin = process.env.CKB_BIN || path.join(C.ROOT, 'tools/ckb');
const rpcPort = Number(process.env.TRADE_ORDER_RPC_PORT || 19224);
const template = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trade-gate2-order-template-')), 'chain');
const chain = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trade-gate2-order-chain-')), 'chain');
const SUPPLY = 2000n;
const ORDER_EXTRA_BYTES = 210;
fs.mkdirSync(out, { recursive: true });

function disposableKey() {
  for (;;) {
    const key = '0x' + require('node:crypto').randomBytes(32).toString('hex');
    try { U.privateKeyToPublicKey(key); return key; } catch {}
  }
}
for (let i = 0; i < 3; i++) {
  const key = disposableKey();
  keys.push(key);
  locks.push({ codeHash: locks[0].codeHash, hashType: 'type', args: '0x' + U.blake160(U.privateKeyToPublicKey(key), 'hex') });
}

let child, secp, rpcId = 0;
function record(file, value) {
  fs.appendFileSync(path.join(out, file), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v) + '\n');
}
async function rpc(method, params = []) {
  const response = await fetch(`http://127.0.0.1:${rpcPort}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const json = await response.json();
  record('rpc.jsonl', { method, params, response: json });
  if (json.error) throw Error(JSON.stringify(json.error));
  return json.result;
}
const cell = (capacity, lock, type, data = '0x') => ({ capacity: BigInt(capacity), lock, type, data });
function tx(inputs, outputs, deps = []) {
  return {
    version: '0x0', cellDeps: [secp, ...deps], headerDeps: [],
    inputs: inputs.map(x => ({ previousOutput: x.outPoint, since: '0x0' })),
    outputs: outputs.map(x => ({ capacity: hex(x.capacity), lock: x.lock, ...(x.type ? { type: x.type } : {}) })),
    outputsData: outputs.map(x => x.data), witnesses: inputs.map(() => '0x'),
  };
}
function sign(t, inputs, role) {
  t = structuredClone(t);
  const indices = inputs.map((x, i) => U.scriptToHash(x.lock) === U.scriptToHash(locks[role]) ? i : -1).filter(i => i >= 0);
  assert(indices.length, `missing test signer ${role}`);
  const first = indices[0], group = [{ lock: '', inputType: '', outputType: '' }, ...indices.slice(1).map(i => t.witnesses[i]), ...t.witnesses.slice(inputs.length)];
  t.witnesses[first] = signGroup(keys[role], U.rawTransactionToHash(t), group)[0];
  return t;
}
async function commit(label, signed) {
  const cycles = await rpc('estimate_cycles', [C.snake(signed)]);
  const txHash = await rpc('send_transaction', [C.snake(signed), 'passthrough']);
  let result;
  for (let i = 0; i < 60; i++) {
    result = await rpc('get_transaction', [txHash]);
    if (result.tx_status.status === 'committed') break;
    await rpc('generate_block');
  }
  assert.equal(result.tx_status.status, 'committed', `${label} not committed`);
  record('events.jsonl', { label, hash: txHash, cycles, tx: signed, committed: result });
  console.log(`${label} ${txHash} cycles=${cycles.cycles}`);
  return signed.outputs.map((x, i) => ({ ...x, capacity: BigInt(x.capacity), data: signed.outputsData[i], outPoint: { txHash, index: hex(i) } }));
}
async function reject(label, signed, expectedCode) {
  let error;
  try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
  assert(error, `${label} was accepted`);
  const json = JSON.parse(error.message);
  assert.match(json.message, new RegExp(`ValidationFailure: see error code ${expectedCode}\\b`), json.message);
  record('rejections.jsonl', { label, expectedCode, error: error.message, tx: signed });
  console.log(`rejected ${label} code=${expectedCode}`);
}
function proofInput(domain, op, owners, updates) {
  const row = x => ({ owner_lock_hash: x.owner, balance: String(x.balance), revision: String(x.revision), active: x.balance > 0n });
  return { domain, op, owners: owners.map(row), updates: updates.map(row) };
}
function makeProof(domain, op, owners, updates, extra = Buffer.alloc(0)) {
  const data = JSON.stringify(proofInput(domain, op, owners, updates));
  const result = execFileSync('cargo', [
    'run', '--quiet', '--locked', '--manifest-path', path.join(__dirname, '..', 'smt-tools', 'Cargo.toml'), '--', 'proof', '-', '-',
  ], { input: data, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(result);
  return { root: parsed.new_root, witness: hx(Buffer.concat([b(parsed.contract_witness.hex), extra])) };
}
function custodyData(amount, root) { return hx(Buffer.concat([le(amount, 16), b(root)])); }
function orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId) {
  return `TRADE V2 MERKLE TOKEN SALE v1\nGenesis: ${domain.genesis_hash}\nMarket: ${domain.market_script_hash}\nAsset: ${domain.xudt_type_script_hash}\nCustody: ${custodyHash}\nSeller: ${seller}\nRevision: ${revision}\nQuantity: ${quantity}\nMinimum shannons: ${minimum}\nPayout: ${payout}\nOrder id: ${orderId}\nBuyer: any\nExpiry: none`;
}
async function signedOrder(domain, custodyHash, sellerRole, seller, revision, quantity, minimum, payout, orderId) {
  const message = orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId);
  const signer = new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), keys[sellerRole]);
  const signature = b(await signer.signMessageRaw(message));
  const publicKey = b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message), hx(signature)));
  assert.equal(signature.length, 65);
  assert.equal(publicKey.length, 33);
  const extra = Buffer.concat([le(quantity), le(minimum), b(orderId), b(seller), b(payout), publicKey, signature]);
  assert.equal(extra.length, ORDER_EXTRA_BYTES);
  return { extra, signature, publicKey };
}
const ZERO32 = Buffer.alloc(32);
const cloneRows = rows => rows.map(x => ({ ...x }));

async function main() {
  execFileSync(process.execPath, [path.join(C.ROOT, 'src/setup.cjs'), template], { stdio: 'inherit' });
  const spec = fs.readFileSync(path.join(template, 'specs/dev.toml'), 'utf8');
  const names = ['marker_candidate', 'market_smt', 'owner_lineage_candidate', 'custody_smt', 'custody_marker'];
  fs.writeFileSync(path.join(out, 'dev.toml'), spec);
  fs.mkdirSync(chain, { recursive: true });
  for (const name of ['limit_order', 'xudt', 'ickb_logic', 'owned_owner']) {
    fs.copyFileSync(path.join(template, name), path.join(chain, name));
  }
  execFileSync(ckbBin, ['init', '-C', chain, '--chain', 'dev', '--force', '--import-spec', path.join(template, 'specs/dev.toml'),
    '--rpc-port', String(rpcPort), '--p2p-port', String(rpcPort + 1)], { stdio: 'inherit' });
  fs.copyFileSync(path.join(template, 'ckb.toml'), path.join(chain, 'ckb.toml'));
  const ckbConfig = fs.readFileSync(path.join(chain, 'ckb.toml'), 'utf8')
    .replace(/127\.0\.0\.1:19224/g, `127.0.0.1:${rpcPort}`)
    .replace(/\/ip4\/127\.0\.0\.1\/tcp\/19225/g, `/ip4/127.0.0.1/tcp/${rpcPort + 1}`);
  fs.writeFileSync(path.join(chain, 'ckb.toml'), ckbConfig);
  fs.copyFileSync(path.join(template, 'specs/dev.toml'), path.join(chain, 'specs/dev.toml'));
  child = spawn(ckbBin, ['run', '-C', chain, '--ba-advanced'], {
    stdio: ['ignore', fs.openSync(path.join(out, 'node.log'), 'w'), 'ignore'],
  });
  let ready = false;
  for (let i = 0; i < 180; i++) {
    try { await rpc('get_tip_header'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert(ready, 'CKB 0.210.0 dev chain did not start');

  const genesis = await rpc('get_block_by_number', ['0x0']);
  secp = { outPoint: { txHash: genesis.transactions[1].hash, index: '0x0' }, depType: 'depGroup' };
  const hashes = Object.fromEntries(names.map(name => [name, hash(fs.readFileSync(path.join(build, name)))]));
  hashes.xudt = hash(fs.readFileSync(path.join(C.ROOT, 'vendor/ickb/build/release/xudt')));
  const deps = {}, wallets = [];
  for (const blockTx of genesis.transactions) for (let i = 0; i < blockTx.outputs.length; i++) {
    const dataHash = hash(b(blockTx.outputs_data[i]));
    if (dataHash === hashes.xudt) deps.xudt = { outPoint: { txHash: blockTx.hash, index: hex(i) }, depType: 'code' };
    for (let role = 0; role < 3; role++) if (blockTx.outputs[i].lock.args === locks[role].args) {
      wallets[role] = { ...C.camel(blockTx.outputs[i]), capacity: BigInt(blockTx.outputs[i].capacity), data: blockTx.outputs_data[i], outPoint: { txHash: blockTx.hash, index: hex(i) } };
    }
  }
  assert(deps.xudt, `missing xUDT code cell ${hashes.xudt}`);
  for (let i = 0; i < 12; i++) await rpc('generate_block');

  const codeCapacity = 100_000n * UNIT;
  const codeCells = names.map(name => cell(codeCapacity, locks[2], undefined, hx(fs.readFileSync(path.join(build, name)))));
  const deployInputs = [wallets[2]];
  const deployTx = tx(deployInputs, [
    ...codeCells, cell(wallets[2].capacity - BigInt(names.length) * codeCapacity - fee, locks[2]),
  ]);
  const deployed = await commit('deploy_fresh_gate2_elf_code_cells', sign(deployTx, deployInputs, 2));
  for (let i = 0; i < names.length; i++) deps[names[i]] = { outPoint: deployed[i].outPoint, depType: 'code' };
  const setupFunding = deployed[names.length];

  const anchor = wallets[0], anchorBytes = Buffer.concat([b(anchor.outPoint.txHash), le(BigInt(anchor.outPoint.index), 4)]);
  const marker = { codeHash: hashes.marker_candidate, hashType: 'data1', args: hash(Buffer.concat([le(0), anchorBytes, le(1)])) };
  const market = { codeHash: hashes.market_smt, hashType: 'data1', args: hx(Buffer.concat([b(hash(anchorBytes)), le(10n * UNIT), le(UNIT), le(SUPPLY), b(U.scriptToHash(marker))])) };
  const owner = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([anchorBytes, b(hashes.xudt), b(U.scriptToHash(market)), le(SUPPLY, 16)])) };
  const token = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(owner) };
  const marketMarkerData = hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token))]));
  const custodyMarker = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(market) };
  const custody = { codeHash: hashes.custody_smt, hashType: 'data1', args: hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token)), b(genesis.header.hash), b(U.scriptToHash(custodyMarker))])) };
  const custodyMarkerData = hx(Buffer.concat([b(U.scriptToHash(custody)), b(U.scriptToHash(token))]));
  const domain = { genesis_hash: genesis.header.hash, market_script_hash: U.scriptToHash(market), xudt_type_script_hash: U.scriptToHash(token), custody_marker_type_hash: U.scriptToHash(custodyMarker) };

  const setupTx = tx([setupFunding], [
    cell(200n * UNIT, owner), cell(2000n * UNIT, locks[3]), cell(2000n * UNIT, locks[4]), cell(1000n * UNIT, locks[5]), cell(200n * UNIT, owner),
    cell(setupFunding.capacity - 5400n * UNIT - fee, locks[2]),
  ]);
  const setup = await commit('fund_offline_seller_buyer_and_solver', sign(setupTx, [setupFunding], 2));
  const issueTx = tx([anchor, setup[0]], [
    cell(300n * UNIT, market, token, hx(le(SUPPLY, 16))), cell(300n * UNIT, market, marker, marketMarkerData),
    cell(anchor.capacity + setup[0].capacity - 600n * UNIT - fee, locks[0]),
  ], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
  const issued = await commit('issue_fixed_supply', sign(issueTx, [anchor, setup[0]], 0));

  const seller = U.scriptToHash(locks[3]), buyer = U.scriptToHash(locks[4]);
  const initial = makeProof(domain, 0, [], [{ owner: seller, balance: 7n, revision: 0n }], le(91n * UNIT));
  const initialTx = tx([issued[0], issued[1], setup[1]], [
    cell(issued[0].capacity + 91n * UNIT, market, token, hx(Buffer.concat([le(SUPPLY - 7n, 16), b(domain.custody_marker_type_hash)]))),
    cell(issued[1].capacity, market, marker, marketMarkerData), cell(350n * UNIT, custody, token, custodyData(7n, initial.root)),
    cell(350n * UNIT, custody, custodyMarker, custodyMarkerData), cell(setup[1].capacity - 91n * UNIT - 700n * UNIT - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  initialTx.headerDeps = [genesis.header.hash];
  initialTx.witnesses.push(initial.witness);
  const bought = await commit('offline_seller_initial_purchase', sign(initialTx, [issued[0], issued[1], setup[1]], 3));

  const rows0 = [{ owner: seller, balance: 7n, revision: 0n }];
  const enrollment = makeProof(domain, 1, rows0, [{ owner: buyer, balance: 2n, revision: 1n }]);
  const enrollTx = tx([bought[0], bought[1], bought[2], bought[3], setup[2]], [
    cell(bought[0].capacity + 35n * UNIT, market, token, hx(Buffer.concat([le(SUPPLY - 9n, 16), b(domain.custody_marker_type_hash)]))),
    cell(bought[1].capacity, market, marker, marketMarkerData), cell(bought[2].capacity, custody, token, custodyData(9n, enrollment.root)),
    cell(bought[3].capacity, custody, custodyMarker, custodyMarkerData), cell(setup[2].capacity - 35n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  enrollTx.headerDeps = [genesis.header.hash];
  enrollTx.witnesses.push(enrollment.witness);
  const enrolled = await commit('new_buyer_enrollment', sign(enrollTx, [bought[0], bought[1], bought[2], bought[3], setup[2]], 4));
  let rows = [...rows0, { owner: buyer, balance: 2n, revision: 1n }];
  let custodyCell = enrolled[2], markerCell = enrolled[3], buyerWallet = enrolled[4];

  const buyerCanceled = { owner: buyer, balance: 2n, revision: 2n };
  const cancelBuyer = makeProof(domain, 7, rows, [buyerCanceled]);
  const cancelBuyerInputs = [custodyCell, markerCell, buyerWallet];
  const cancelBuyerTx = tx(cancelBuyerInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(9n, cancelBuyer.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData), cell(buyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  cancelBuyerTx.witnesses.push(cancelBuyer.witness);
  const buyerCanceledCells = await commit('unrelated_buyer_revision_change', sign(cancelBuyerTx, cancelBuyerInputs, 4));
  rows[1] = buyerCanceled;
  custodyCell = buyerCanceledCells[0]; markerCell = buyerCanceledCells[1]; buyerWallet = buyerCanceledCells[2];

  const minProceeds = 70n * UNIT, quantity = 3n, orderId = '0x' + 'a1'.repeat(32), payout = seller;
  const order = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 0n, quantity, minProceeds, payout, orderId);
  const sellerAfter = { owner: seller, balance: 4n, revision: 1n };
  const buyerAfter = { owner: buyer, balance: 5n, revision: 3n };
  const transferRows = makeProof(domain, 8, rows, [sellerAfter, buyerAfter], order.extra);
  function fillTransaction(proof, payer = buyerWallet, sellerOutputLock = locks[3], payoutCapacity = minProceeds,
                           payerChange = payer.capacity - minProceeds - fee) {
    const inputs = [custodyCell, markerCell, payer];
    const fill = tx(inputs, [
      cell(custodyCell.capacity, custody, token, custodyData(9n, proof.root)),
      cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(payerChange, locks[4]), cell(payoutCapacity, sellerOutputLock),
    ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
    fill.headerDeps = [genesis.header.hash];
    fill.witnesses.push(proof.witness);
    return { inputs, fill };
  }
  const good = fillTransaction(transferRows);
  const badPayout = fillTransaction(transferRows, buyerWallet, locks[5]);
  await reject('signed_payout_lock_redirect', sign(badPayout.fill, badPayout.inputs, 4), 34);
  const shortBy = UNIT;
  const badMinimum = fillTransaction(transferRows, buyerWallet, locks[3], minProceeds - shortBy,
    buyerWallet.capacity - minProceeds + shortBy - fee);
  await reject('minimum_proceeds_underpayment', sign(badMinimum.fill, badMinimum.inputs, 4), 34);
  const badSignature = structuredClone(good.fill);
  const orderWitness = b(badSignature.witnesses[3]);
  orderWitness[orderWitness.length - 1] ^= 1;
  badSignature.witnesses[3] = hx(orderWitness);
  await reject('tampered_offline_signature', sign(badSignature, good.inputs, 4), 38);

  const filled = await commit('offline_order_fill_after_unrelated_root_change', sign(good.fill, good.inputs, 4));
  rows = [sellerAfter, buyerAfter];
  custodyCell = filled[0]; markerCell = filled[1];
  const solverRemainder = filled[2];

  const replaySeller = { owner: seller, balance: 1n, revision: 2n };
  const replayBuyer = { owner: buyer, balance: 8n, revision: 4n };
  const replayProof = makeProof(domain, 8, rows, [replaySeller, replayBuyer], order.extra);
  const originalOrderReplay = fillTransaction(replayProof, solverRemainder);
  const replaySigned = sign(originalOrderReplay.fill, originalOrderReplay.inputs, 4);
  await reject('consumed_order_revision_replay', replaySigned, 38);

  const secondOrder = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 1n, 1n, minProceeds, payout, '0x' + 'b2'.repeat(32));
  const canceledSeller = { owner: seller, balance: 4n, revision: 2n };
  const cancelSellerProof = makeProof(domain, 7, rows, [canceledSeller]);
  const sellerWallet = bought[4];
  const cancelSellerInputs = [custodyCell, markerCell, sellerWallet];
  const cancelSellerTx = tx(cancelSellerInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(9n, cancelSellerProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData), cell(sellerWallet.capacity - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  cancelSellerTx.witnesses.push(cancelSellerProof.witness);
  const canceledSellerCells = await commit('seller_owner_cancels_next_revision', sign(cancelSellerTx, cancelSellerInputs, 3));
  rows = [canceledSeller, buyerAfter]; custodyCell = canceledSellerCells[0]; markerCell = canceledSellerCells[1];
  const canceledRows = makeProof(domain, 8, rows, [
    { owner: seller, balance: 3n, revision: 3n }, { owner: buyer, balance: 6n, revision: 4n },
  ], secondOrder.extra);
  const canceledReplay = tx([custodyCell, markerCell, solverRemainder], [
    cell(custodyCell.capacity, custody, token, custodyData(9n, canceledRows.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(solverRemainder.capacity - minProceeds - fee, locks[4]), cell(minProceeds, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  canceledReplay.headerDeps = [genesis.header.hash]; canceledReplay.witnesses.push(canceledRows.witness);
  await reject('canceled_order_revision_replay', sign(canceledReplay, [custodyCell, markerCell, solverRemainder], 4), 38);

  const tip = await rpc('get_tip_header');
  const summary = {
    evidence: out, chain: chain, ckbVersion: '0.210.0', genesis: genesis.header.hash, tip: tip.hash,
    hashes, ownersBefore: 2, ownersAfter: 2, orderQuantity: quantity.toString(), minimumProceeds: minProceeds.toString(),
    signedPayoutLockHash: payout, custodyAmountBeforeAndAfter: '9', offlineSellerInputPresent: false,
    rootChangedBeforeFill: true, orderFillCommitted: true, expiry: 'none; order does not expire',
  };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('Evidence ' + out);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
