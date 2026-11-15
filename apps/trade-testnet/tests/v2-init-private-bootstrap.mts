// Fresh local CKB node fixture. This runner never connects to a public network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync, spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const appRoot = path.resolve(import.meta.dirname, '..');
const nativeRoot = process.env.TRADE_NATIVE_ROOT;
const binaries = process.env.ROVEKO_GATE2_BINARIES;
const ckbBin = process.env.CKB_BIN;
assert(nativeRoot && binaries && ckbBin, 'Set TRADE_NATIVE_ROOT, ROVEKO_GATE2_BINARIES, and CKB_BIN');
const C = createRequire(import.meta.url)(path.join(nativeRoot, 'src/lib.cjs'));
const portBusy = await new Promise<boolean>((resolve) => {
  const socket = net.createConnection({host: '127.0.0.1', port: 19224});
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
assert(!portBusy, 'Private CKB RPC port 19224 is already in use');

const evidence = path.join(appRoot, 'evidence', `v2-init-private-bootstrap-${Date.now()}`);
const chain = path.join(evidence, 'chain');
fs.mkdirSync(evidence, {recursive: true});
execFileSync(process.execPath, [path.join(nativeRoot, 'src/setup.cjs'), chain], {
  stdio: 'inherit',
  env: {...process.env, CKB_BIN: ckbBin},
});

const log = fs.openSync(path.join(evidence, 'ckb.log'), 'w');
const child = spawn(ckbBin, ['run', '-C', chain, '--ba-advanced'], {
  stdio: ['ignore', log, log],
});
let rpcId = 0;
const rpc = async (method: string, params: unknown[] = []) => {
  const response = await fetch('http://127.0.0.1:19224', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: ++rpcId, method, params}),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw Error(JSON.stringify(body.error || body));
  return body.result;
};

try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null) throw Error(`Private CKB node exited with ${child.exitCode}`);
    try {
      await rpc('get_tip_header');
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  assert(ready, 'Private CKB node did not become ready');
  const info = await rpc('get_blockchain_info') as {chain?: string};
  assert.equal(info.chain, 'ckb_dev');
  const block = await rpc('get_block_by_number', ['0x0']) as {
    header: {hash: string};
    transactions: {hash: string; outputs: {capacity: string; lock: unknown}[]; outputs_data: string[]}[];
  };
  const genesis = block.header.hash;
  assert.equal(await rpc('get_block_hash', ['0x0']), genesis);

  const names = ['custody_smt', 'market_smt', 'custody_marker', 'marker_candidate', 'owner_lineage_candidate'];
  const hashes: Record<string, string> = Object.fromEntries(names.map((name) => [name, C.hash(fs.readFileSync(path.join(binaries, name)))]));
  const xudt = path.join(nativeRoot, 'vendor/ickb/build/release/xudt');
  hashes.xudt = C.hash(fs.readFileSync(xudt));

  let xudtPoint: {txHash: string; index: string} | undefined;
  const wallets: unknown[] = [];
  for (const transaction of block.transactions) {
    for (let index = 0; index < transaction.outputs.length; index++) {
      if (C.hash(C.b(transaction.outputs_data[index])) === hashes.xudt) {
        xudtPoint = {txHash: transaction.hash, index: C.hex(index)};
      }
      const outputLock = transaction.outputs[index].lock as {args: string};
      for (let role = 0; role < C.locks.length; role++) {
        const genesisLock = C.locks[role] as {args: string};
        if (outputLock.args.toLowerCase() !== genesisLock.args.toLowerCase()) continue;
        const point = {txHash: transaction.hash, index: C.hex(index)};
        const live = await rpc('get_live_cell', [C.snake(point), true]) as {status?: string};
        if (live.status === 'live') {
          wallets[role] = {
            outPoint: point,
            capacity: BigInt(transaction.outputs[index].capacity).toString(),
            lock: C.camel(outputLock),
            data: transaction.outputs_data[index],
          };
        }
      }
    }
  }
  assert(xudtPoint, 'Pinned xUDT code cell is missing from private genesis');
  assert.equal(wallets.length, 3, 'Expected three disposable genesis owners');
  assert.equal(wallets.filter(Boolean).length, 3, 'A disposable genesis wallet is missing');
  const bootstrap = {
    genesis,
    hashes,
    deps: {xudt: {outPoint: xudtPoint, depType: 'code'}},
    wallets,
  };
  const bootstrapPath = path.join(evidence, 'initialization-bootstrap.json');
  fs.writeFileSync(bootstrapPath, JSON.stringify(bootstrap, null, 2));
  fs.writeFileSync(path.join(evidence, 'environment.json'), JSON.stringify({
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    ckb: execFileSync(ckbBin, ['--version'], {encoding: 'utf8'}).trim(),
    chain: info.chain,
    genesis,
    bootstrap: bootstrapPath,
  }, null, 2));

  const stopFile = path.join(evidence, 'stop-node');
  console.log(`PRIVATE_CHAIN_READY evidence=${evidence} bootstrap=${bootstrapPath} genesis=${genesis}`);
  while (!fs.existsSync(stopFile) && child.exitCode === null) await delay(250);
} finally {
  child.kill('SIGTERM');
  await delay(250);
  if (child.exitCode === null) child.kill('SIGKILL');
  fs.closeSync(log);
}
