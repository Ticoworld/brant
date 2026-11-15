// Real CKB 0.210.0 replay of published cp1-cp4 fixtures using a permissionless anchor lock.
const { C, Engine, cell, assert } = require('./engine.cjs');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const signGroup = require(path.join(path.dirname(require.resolve('@nervosnetwork/ckb-sdk-core', { paths: [C.ROOT] })), 'signWitnessGroup.js')).default;
const source = process.env.LIQUID_CELLS_SOURCE;
const contractBin = process.env.LIQUID_CELLS_ANCHOR_BIN;
if (!source || !contractBin) throw new Error('Set LIQUID_CELLS_SOURCE and LIQUID_CELLS_ANCHOR_BIN');
const pin = '47492b51673c94635ab23de2c55477625e94ccbf';
assert.equal(cp.execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
assert.equal(cp.execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'upstream source must be clean');
const fixtures = path.join(source, 'fixtures');
const ownerPubkey = C.U.privateKeyToPublicKey(C.keys[0]);
const smallOwnerPubkey = C.U.privateKeyToPublicKey(C.keys[1]);
function hx(b) { return `0x${b.toString('hex')}`; }
function u64(b, i) { return b.readBigUInt64BE(i); }
function u128(b, i) { return BigInt(`0x${b.subarray(i, i + 16).toString('hex')}`); }
function absEpoch(e) { return `0x${((0x20n << 56n) | BigInt(e)).toString(16)}`; }
function anchorData(root, seq, total, fee, epoch) {
  const s = Buffer.alloc(8); s.writeBigUInt64BE(BigInt(seq));
  const t = Buffer.alloc(16); t.writeBigUInt64BE(BigInt(total), 8);
  const f = Buffer.alloc(16); f.writeBigUInt64BE(BigInt(fee), 8);
  const e = Buffer.alloc(8); e.writeBigUInt64BE(BigInt(epoch));
  return hx(Buffer.concat([root, s, t, f, e]));
}
function signingWitnessGroup(tx, inputs, roles) {
  const h = C.U.rawTransactionToHash(tx);
  for (const role of roles) {
    const lockHash = C.U.scriptToHash(C.locks[role]);
    const indices = inputs.flatMap((item, i) => C.U.scriptToHash(item.lock) === lockHash ? [i] : []);
    assert(indices.length, `no input for signing role ${role}`);
    const first = indices[0];
    const current = tx.witnesses[first];
    const firstArgs = typeof current === 'object' ? current : { lock: '', inputType: '', outputType: '' };
    const group = [firstArgs, ...indices.slice(1).map(i => tx.witnesses[i]), ...tx.witnesses.slice(inputs.length)];
    tx.witnesses[first] = signGroup(C.keys[role], h, group)[0];
  }
  tx.witnesses = tx.witnesses.map(w => typeof w === 'string' ? w : C.U.serializeWitnessArgs(w));
  return tx;
}
function makeWitness(proof, pv, da) { return { lock: '', inputType: hx(Buffer.concat([proof, pv])), outputType: hx(da) }; }
function reconstruct(historyHashes, baseHash, outDir) {
  const script = path.join(__dirname, 'reconstruct-liquid-cells-history-from-rpc.cjs');
  return JSON.parse(cp.execFileSync(process.execPath, [script, baseHash, JSON.stringify(historyHashes), JSON.stringify([ownerPubkey, smallOwnerPubkey]), outDir], {
    encoding: 'utf8', env: process.env, maxBuffer: 8 * 1024 * 1024,
  }).trim());
}

(async () => {
  const e = new Engine('liquid-cells-multicheckpoint-operatorless-recovery');
  let evidenceDir;
  try {
    await e.start(); evidenceDir = e.out;
    const anchorCode = await e.deploy('anchor', contractBin);
    const lockCode = await e.deploy('permissionless_anchor_lock', path.resolve(__dirname, '../../wo04-partial/config/always_success'));
    const lock = lockCode.script;
    const type = anchorCode.script;
    const genesisDir = path.join(fixtures, 'genesis');
    const genesisPv = fs.readFileSync(path.join(genesisDir, 'public_values.bin'));
    const deposit = fs.readFileSync(path.join(genesisDir, 'deposit.bin'));
    const depositAmount = BigInt(`0x${deposit.subarray(32).toString('hex')}`);
    const genesisRoot = genesisPv.subarray(40, 72);
    const initialAnchorData = anchorData(genesisRoot, 0, 0, 0, 0);
    const anchorCapacity = 500n * C.UNIT;
    const wallet = e.wallets[0];
    const create = e.sign(e.tx([wallet], [
      cell(anchorCapacity, lock, type, initialAnchorData),
      cell(depositAmount, C.locks[0], null, hx(deposit.subarray(0, 32))),
      cell(wallet.capacity - anchorCapacity - depositAmount - C.fee, C.locks[0]),
    ], [e.dep('anchor')]), [wallet], [0]);
    const genesisCells = await e.send('create_permissionless_anchor_and_user_deposit', create);
    e.wallets[0] = genesisCells[2];
    let currentAnchor = genesisCells[0];
    const genesisTransactionHash = e.events.at(-1).hash;

    async function commitFixture(name, depositCell = null) {
      const dir = path.join(fixtures, name);
      const proof = fs.readFileSync(path.join(dir, 'groth16_proof.bin'));
      const pv = fs.readFileSync(path.join(dir, 'public_values.bin'));
      const da = fs.readFileSync(path.join(dir, 'da_blob.bin'));
      const epoch = u64(pv, 232);
      const feeWd = u128(pv, 240);
      const totalIn = currentAnchor.capacity + (depositCell ? depositCell.capacity : 0n);
      const newCapacity = totalIn - feeWd;
      const feeOut = u128(currentAnchor.data ? Buffer.from(currentAnchor.data.slice(2), 'hex') : Buffer.alloc(80), 56) + u128(pv, 216) - feeWd;
      const nextData = anchorData(pv.subarray(80, 112), u64(pv, 112), u128(pv, 200), feeOut, epoch);
      const fixtureNextPath = path.join(dir, 'new_anchor.bin');
      if (fs.existsSync(fixtureNextPath)) assert(Buffer.from(fs.readFileSync(fixtureNextPath)).equals(Buffer.from(nextData.slice(2), 'hex')), `${name} fixture anchor bytes mismatch`);
      const inputs = [{ ...currentAnchor, since: absEpoch(epoch) }, ...(depositCell ? [depositCell] : [])];
      const outputs = [cell(newCapacity, currentAnchor.lock, currentAnchor.type, nextData)];
      const witnesses = [makeWitness(proof, pv, da), ...(depositCell ? ['0x'] : [])];
      const tx = e.tx(inputs, outputs, [e.dep('anchor'), e.dep('permissionless_anchor_lock')], witnesses);
      const signed = depositCell ? signingWitnessGroup(tx, inputs, [0]) : (tx.witnesses = tx.witnesses.map(w => typeof w === 'string' ? w : C.U.serializeWitnessArgs(w)), tx);
      const result = await e.send(`commit_${name}_published_checkpoint`, signed);
      currentAnchor = result[0];
      return e.events.at(-1).hash;
    }

    const genesisCpHash = await commitFixture('genesis', genesisCells[1]);
    const checkpointHashes = [genesisCpHash];
    for (const name of ['seq/cp2', 'seq/cp3', 'seq/cp4']) {
      await e.mine(10);
      checkpointHashes.push(await commitFixture(name));
    }

    const historyDir = path.join(evidenceDir, 'history-reconstruction');
    const history = reconstruct(checkpointHashes, genesisTransactionHash, historyDir);
    assert.equal(history.checkpoint_count, 4);
    assert.equal(history.latest_anchor.sequence, '4');
    const ownerProof = history.proofs[0];
    const smallProof = history.proofs[1];
    assert.equal(smallProof.balance_shannons, '1000');
    assert.equal(ownerProof.root, history.latest_anchor.root);
    assert.equal(smallProof.root, history.latest_anchor.root);

    // Reconstruct a deliberately stale cp1 proof from live RPC, then challenge the latest root.
    const staleDir = path.join(evidenceDir, 'stale-proof');
    const stale = JSON.parse(cp.execFileSync(process.execPath, [
      path.join(__dirname, 'reconstruct-liquid-cells-proof-from-rpc.cjs'), genesisCpHash, ownerPubkey, staleDir,
    ], { encoding: 'utf8', env: process.env, maxBuffer: 2 * 1024 * 1024 }).trim());

    const latestData = Buffer.from(currentAnchor.data.slice(2), 'hex');
    const latestTotal = u128(latestData, 40);
    const latestLastEpoch = u64(latestData, 72);
    async function exitTx(proofInfo, amount, totalAfter, payoutCapacity = amount) {
      const feeWallet = e.wallets[1];
      const change = feeWallet.capacity - C.fee - (payoutCapacity > amount ? payoutCapacity - amount : 0n);
      const nextData = anchorData(Buffer.from(proofInfo.nullified_root.slice(2), 'hex'), u64(latestData, 32), totalAfter, u128(latestData, 56), latestLastEpoch);
      const unsigned = e.tx(
        [{ ...currentAnchor, since: absEpoch(latestLastEpoch + 180n) }, feeWallet],
        [cell(currentAnchor.capacity - amount, currentAnchor.lock, currentAnchor.type, nextData), cell(payoutCapacity, C.locks[proofInfo === smallProof ? 1 : 0]), cell(change, C.locks[1])],
        [e.dep('anchor'), e.dep('permissionless_anchor_lock')],
        [{ lock: '', inputType: proofInfo.witness_hex, outputType: '' }, '0x'],
      );
      return signingWitnessGroup(unsigned, [currentAnchor, feeWallet], [1]);
    }

    const staleTx = await exitTx(stale, BigInt(stale.balance_shannons), 0n);
    await e.reject('stale_cp1_proof_rejected_against_cp4_live_anchor', staleTx, /ValidationFailure|ScriptFailure|script/i);

    const finalEpoch = latestLastEpoch + 180n;
    let mined = 0;
    while (true) {
      const epoch = await e.rpc('get_current_epoch');
      if (BigInt(epoch.number) >= finalEpoch) break;
      await e.mine(100); mined += 100;
    }

    // The current contract demands a 1,000-shannon standalone owner output, which cannot clear
    // CKB's occupied-capacity floor. Preserve the real-node result and separately try a sponsored
    // >floor payout to the same owner; the upstream type script requires exact capacity.
    const smallAmount = BigInt(smallProof.balance_shannons);
    const tinyTx = await exitTx(smallProof, smallAmount, latestTotal - smallAmount);
    await e.reject('1000_shannon_owner_exit_rejected_by_real_node_or_contract', tinyTx, /capacity|Capacity|occupied|Occupied|ValidationFailure|ScriptFailure|script|verify/i, 'send_transaction');
    const sponsoredCapacity = 61n * C.UNIT;
    const sponsoredTx = await exitTx(smallProof, smallAmount, latestTotal - smallAmount, sponsoredCapacity);
    await e.reject('sponsored_standard_cell_rejected_by_exact_balance_payout_rule', sponsoredTx, /ValidationFailure|ScriptFailure|script/i);

    const validOwnerExit = await exitTx(ownerProof, BigInt(ownerProof.balance_shannons), latestTotal - BigInt(ownerProof.balance_shannons));
    const exited = await e.send('independent_user_exits_after_four_checkpoint_history', validOwnerExit);
    e.wallets[1] = exited[2];
    const duplicate = await exitTx(ownerProof, BigInt(ownerProof.balance_shannons), latestTotal - BigInt(ownerProof.balance_shannons));
    await e.reject('second_exit_conflicts_on_already_spent_shared_anchor', duplicate, /spent|DeadCell|dead cell|resolve|OutPoint|live cell/i, 'send_transaction');

    e.save();
    C.write(evidenceDir + '/history-lifecycle.json', {
      classification: 'ACTUAL_PRIVATE_DEVNET_MULTI_CHECKPOINT_AND_EXIT',
      upstream_repository: 'LusoCryptoLabs/Liquid-Cells', upstream_commit: pin,
      anchor_binary_sha256: C.crypto.createHash('sha256').update(fs.readFileSync(contractBin)).digest('hex'),
      genesis_transaction: genesisTransactionHash,
      checkpoints: checkpointHashes,
      latest_anchor: history.latest_anchor,
      claimant_balances_shannons: history.proofs.map(p => p.balance_shannons),
      owner_exit: { hash: e.events.at(-1).hash, payout_shannons: ownerProof.balance_shannons, maturity_epoch: finalEpoch.toString(), mined_blocks_after_latest_checkpoint: mined },
      non_operator_authorization: 'permissionless anchor lock; user role 1 signed only its fee input; account proof fixes payout to the owner key',
      successor_anchor_capacity_shannons: exited[0].capacity.toString(),
      residual_accounted_total_shannons: (latestTotal - BigInt(ownerProof.balance_shannons)).toString(),
      notes: [
        'Four sequential published Groth16 checkpoints (genesis, cp2, cp3, cp4) committed on CKB 0.210.0 with contiguous anchor outpoints.',
        'A fresh child replayed each committed checkpoint DA from live RPC and rebuilt both owner proofs against the latest anchor root without fixtures, indexer, or sequencer state.',
        'The cp1 owner proof was rejected against cp4 state; the replayed cp4 proof committed after the last_epoch timeout.',
        'The fixture contains a 1,000-shannon claimant. Direct and sponsored payout trials were rejected; the exit design remains above the standalone cell floor for small claims.',
        'A second proof-based transaction against the spent cp4 anchor was rejected as a shared-outpoint conflict.',
        'The key preimage for the 1,000-shannon fixture record is derived from the published sequence fixture owner `key_for(2)`; no claim is made for arbitrary unknown owners.',
      ],
    });
    e.close();
  } catch (error) {
    e.close(error);
    console.error(error);
    process.exitCode = 1;
  }
})();
