// Independently verify that the pinned upstream genesis deposit fits CKB's real
// occupied-capacity floor and can be committed on the disposable private devnet.
const { C, Engine, cell, assert } = require('./engine.cjs');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const source = process.env.LIQUID_CELLS_SOURCE;
if (!source) throw new Error('Set LIQUID_CELLS_SOURCE to the clean pinned Liquid-Cells checkout');
const pin = '47492b51673c94635ab23de2c55477625e94ccbf';
const head = cp.execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(head, pin, 'upstream fixture source pin mismatch');
const fixturePath = path.join(source, 'fixtures/genesis/deposit.bin');
const fixture = fs.readFileSync(fixturePath);
assert.equal(fixture.length, 48, 'unexpected pinned deposit fixture format');
const amount = fixture.readBigUInt64BE(40);
const key = `0x${fixture.subarray(0, 32).toString('hex')}`;

(async () => {
  const e = new Engine('liquid-cells-genesis-fixture-occupied-capacity');
  try {
    await e.start();
    const wallet = e.wallets[0];
    const depositCell = cell(amount, C.locks[0], null, key);
    const occupied = C.occupied(depositCell);
    assert(amount >= occupied, 'pinned fixture deposit is below occupied capacity');
    const attempt = e.sign(
      e.tx(
        [wallet],
        [
          depositCell,
          cell(wallet.capacity - amount - C.fee, C.locks[0]),
        ],
      ),
      [wallet],
      [0],
    );
    const outputs = await e.send('commit_pinned_fixture_deposit_cell', attempt);
    const result = {
      classification: 'ACTUAL_PRIVATE_DEVNET_TRANSACTION',
      boundary: 'deposit-cell creation only; the separate complete lifecycle is in the companion evidence',
      upstream_repository: 'LusoCryptoLabs/Liquid-Cells',
      upstream_commit: pin,
      fixture: 'fixtures/genesis/deposit.bin',
      deposit_amount_shannons: amount.toString(),
      deposit_data_bytes: fixture.length - 16,
      occupied_capacity_shannons: occupied.toString(),
      ckb_node_version: (await e.rpc('local_node_info')).version,
      transaction: e.events.at(-1).hash,
      deposit_outpoint: outputs[0].outPoint,
      evidence_directory: e.out,
    };
    C.write(e.out + '/fixture-floor-result.json', result);
    e.close();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    e.close(error);
    console.error(error);
    process.exitCode = 1;
  }
})();
