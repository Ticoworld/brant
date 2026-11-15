// Disposable browser bootstrap derived from Gate 2 runner. Fixture keys are isolated devnet only.
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
  child = spawn(ckbBin, ['run', '-C', chain, '--ba-advanced'], { stdio: ['ignore', fs.openSync(path.join(out, 'node.log'), 'w'), 'ignore'] });
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

  const state = {genesis: genesis.header.hash, hashes, deps, wallets, rpc: 'http://127.0.0.1:19224'};
  fs.writeFileSync(path.join(out, 'initialization-bootstrap.json'), JSON.stringify(state, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2));
  console.log('Initialization bootstrap ' + out);
  const stopFile = path.join(out, 'stop-node');
  while (!fs.existsSync(stopFile)) await new Promise(resolve => setTimeout(resolve, 500));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
