// Native CKB check of ordinary secp outputs below occupied capacity; not a Liquid Cells claim proof.
const { C, Engine, cell } = require('./engine.cjs');

(async () => {
  const e = new Engine('ckb-small-cell-floor');
  try {
    await e.start();
    const payer = e.wallets[1];
    for (const amount of [C.UNIT / 10n, C.UNIT]) {
      const name = amount === C.UNIT / 10n ? '0_1_ckb' : '1_ckb';
      const change = payer.capacity - amount - C.fee;
      const tx = e.sign(e.tx(
        [payer],
        [cell(amount, C.locks[0]), cell(change, C.locks[1])],
        [],
        ['0x'],
      ), [payer], [1]);
      await e.reject(`${name}_ordinary_secp_output_rejected_by_live_ckb_occupied_capacity`, tx,
        /InsufficientCellCapacity/, 'send_transaction');
    }
    e.save();
    e.close();
    console.log(`COMPLETE ${e.out}`);
  } catch (error) {
    e.close(error);
    console.error(error);
    process.exitCode = 1;
  }
})();
