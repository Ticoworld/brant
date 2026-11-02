// Execute the pinned upstream genesis checkpoint and a real, epoch-mature force exit
// on Trade's disposable local CKB devnet. All signing keys are the existing public
// disposable fixtures. This is a research reproduction, not a production security claim.
const { C, Engine, cell, assert } = require('./engine.cjs');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const source = process.env.LIQUID_CELLS_SOURCE;
const contractBin = process.env.LIQUID_CELLS_ANCHOR_BIN;
const permissionlessAnchor = process.env.LIQUID_CELLS_PERMISSIONLESS_ANCHOR === '1';
const operatorControlledAnchor = process.env.LIQUID_CELLS_OPERATOR_ANCHOR === '1';
if (permissionlessAnchor && operatorControlledAnchor) throw new Error('Choose one anchor-lock mode');
if (!source || !contractBin) throw new Error('Set LIQUID_CELLS_SOURCE and LIQUID_CELLS_ANCHOR_BIN');
const pin = '47492b51673c94635ab23de2c55477625e94ccbf';
assert.equal(cp.execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
assert.equal(cp.execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'upstream source must be clean');
const fixtureDir = path.join(source, 'fixtures/genesis');
const proof = fs.readFileSync(path.join(fixtureDir, 'groth16_proof.bin'));
const pv = fs.readFileSync(path.join(fixtureDir, 'public_values.bin'));
const da = fs.readFileSync(path.join(fixtureDir, 'da_blob.bin'));
const deposit = fs.readFileSync(path.join(fixtureDir, 'deposit.bin'));
assert.equal(proof.length, 356);
assert.equal(pv.length, 288);
assert.equal(da.length % 56, 0);
assert.equal(deposit.length, 48);
const depositAmount = BigInt('0x' + deposit.subarray(32).toString('hex'));
const pubkey = C.U.privateKeyToPublicKey(C.keys[0]);

function readU64(offset, bytes = pv) { return bytes.readBigUInt64BE(offset); }
function readU128(offset, bytes = pv) { return BigInt('0x' + bytes.subarray(offset, offset + 16).toString('hex')); }
function hx(bytes) { return '0x' + bytes.toString('hex'); }
function absEpoch(epoch) { return '0x' + ((0x20n << 56n) | BigInt(epoch)).toString(16); }
function anchor(root, seq, total, fee, epoch) {
  const seqBytes = Buffer.alloc(8); seqBytes.writeBigUInt64BE(BigInt(seq));
  const totalBytes = Buffer.alloc(16); totalBytes.writeBigUInt64BE(BigInt(total), 8);
  const feeBytes = Buffer.alloc(16); feeBytes.writeBigUInt64BE(BigInt(fee), 8);
  const epochBytes = Buffer.alloc(8); epochBytes.writeBigUInt64BE(BigInt(epoch));
  return hx(Buffer.concat([root, seqBytes, totalBytes, feeBytes, epochBytes]));
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
    // signWitnessGroup already serializes the replacement WitnessArgs for a single-sig lock.
    tx.witnesses[first] = signGroup(C.keys[role], h, group)[0];
  }
  tx.witnesses = tx.witnesses.map(w => typeof w === 'string' ? w : C.U.serializeWitnessArgs(w));
  return tx;
}
const signGroup = require(path.join(path.dirname(require.resolve('@nervosnetwork/ckb-sdk-core', { paths: [C.ROOT] })), 'signWitnessGroup.js')).default;
function buildCheckpoint(e, anchorIn, depositIn, code, permissionlessLockDep, tamperDa = false) {
  const prevRoot = pv.subarray(40, 72);
  const newRoot = pv.subarray(80, 112);
  const prevSeq = readU64(72), newSeq = readU64(112);
  const prevTotal = readU128(184), newTotal = readU128(200);
  const feeDelta = readU128(216), feeWithdraw = readU128(240);
  const currentEpoch = readU64(232);
  const prevData = anchor(prevRoot, prevSeq, prevTotal, 0, 0);
  const nextData = anchor(newRoot, newSeq, newTotal, feeDelta - feeWithdraw, currentEpoch);
  const nextCapacity = anchorIn.capacity + depositIn.capacity - feeWithdraw;
  const checkpointInputs = [{ ...anchorIn, since: absEpoch(currentEpoch) }, depositIn];
  const checkpointOutputs = [cell(nextCapacity, anchorIn.lock, anchorIn.type, nextData)];
  const witnessDa = Buffer.from(da);
  if (tamperDa) witnessDa[0] ^= 1;
  const witnesses = [{ lock: '', inputType: hx(Buffer.concat([proof, pv])), outputType: hx(witnessDa) }, '0x'];
  const tx = e.tx(
    checkpointInputs,
    checkpointOutputs,
    [e.dep('anchor'), ...(permissionlessLockDep ? [permissionlessLockDep] : [])],
    witnesses,
  );
  assert.equal(anchorIn.data, prevData, 'fixture predecessor anchor state mismatch');
  return signingWitnessGroup(tx, checkpointInputs, [0, ...(operatorControlledAnchor ? [2] : [])]);
}
function reconstructProofFromRpc(checkpointHash, evidenceDir) {
  const outDir = path.join(evidenceDir, 'rpc-reconstruction');
  const stdout = cp.execFileSync(process.execPath, [
    path.join(__dirname, 'reconstruct-liquid-cells-proof-from-rpc.cjs'), checkpointHash, pubkey, outDir,
  ], { encoding: 'utf8', env: process.env, maxBuffer: 2 * 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

(async () => {
  const e = new Engine('liquid-cells-pinned-genesis-checkpoint-force-exit');
  let evidenceDir;
  try {
    await e.start();
    evidenceDir = e.out;
    const wallet = e.wallets[0];
    const codeBytes = fs.readFileSync(contractBin);
    const codeCapacity = BigInt(codeBytes.length + 61) * C.UNIT;
    const deploy = e.sign(e.tx(
      [e.wallets[2]],
      [cell(codeCapacity, C.locks[2], null, hx(codeBytes)), cell(e.wallets[2].capacity - codeCapacity - C.fee, C.locks[2])],
    ), [e.wallets[2]], [2]);
    const deployed = await e.send('deploy_pinned_upstream_anchor_binary', deploy);
    e.wallets[2] = deployed[1];
    e.codes.anchor = {
      hash: C.hash(codeBytes), outPoint: deployed[0].outPoint,
      script: { codeHash: C.hash(codeBytes), hashType: 'data1', args: '0x' },
    };

    if (permissionlessAnchor) {
      await e.deploy('permissionless_anchor_lock', path.resolve(__dirname, '../../wo04-partial/config/always_success'));
    }

    const type = e.codes.anchor.script;
    const anchorLock = permissionlessAnchor ? e.codes.permissionless_anchor_lock.script : operatorControlledAnchor ? C.locks[2] : C.locks[0];
    const anchorLockDep = permissionlessAnchor ? e.dep('permissionless_anchor_lock') : null;
    const emptyRoot = pv.subarray(40, 72);
    const genesisData = anchor(emptyRoot, 0, 0, 0, 0);
    const anchorCapacity = 500n * C.UNIT;
    const genesisOutputs = [
      cell(anchorCapacity, anchorLock, type, genesisData),
      cell(depositAmount, C.locks[0], null, hx(deposit.subarray(0, 32))),
      cell(wallet.capacity - anchorCapacity - depositAmount - C.fee, C.locks[0]),
    ];
    const genesisTx = e.sign(e.tx([wallet], genesisOutputs, [e.dep('anchor')]), [wallet], [0]);
    const genesisCells = await e.send('create_canonical_empty_anchor_and_pinned_genesis_deposit', genesisTx);
    const anchor0 = genesisCells[0];
    const deposit0 = genesisCells[1];

    const badCheckpoint = buildCheckpoint(e, anchor0, deposit0, e.codes.anchor, anchorLockDep, true);
    await e.reject('tampered_published_da_rejected_by_real_anchor_script', badCheckpoint, /ValidationFailure|ScriptFailure|script/i);
    const checkpointTx = buildCheckpoint(e, anchor0, deposit0, e.codes.anchor, anchorLockDep, false);
    const checkpointCells = await e.send('commit_pinned_sp1_genesis_checkpoint_with_published_da', checkpointTx);
    const anchor1 = checkpointCells[0];
    e.wallets[2] = checkpointCells[1];

    const checkpointHash = e.events.at(-1).hash;
    const proofData = reconstructProofFromRpc(checkpointHash, evidenceDir);
    assert.equal(proofData.balance_shannons, '9999899000');
    assert.equal(proofData.witness_hex.length, 2 + 8249 * 2);
    const payout = BigInt(proofData.balance_shannons);
    const nextTotal = readU128(200) - payout;
    const nullRoot = Buffer.from(proofData.nullified_root.slice(2), 'hex');
    const nextAnchor = anchor(nullRoot, readU64(112), nextTotal, readU128(216) - readU128(240), readU64(232));
    async function forceExit(sinceEpoch, payoutAmount = payout, authorizeOperator = operatorControlledAnchor) {
      const feeRole = permissionlessAnchor || operatorControlledAnchor ? 1 : 2;
      const feeWallet = e.wallets[feeRole];
      const change = feeWallet.capacity - C.fee - (payoutAmount === payout ? 0n : 1n);
      const witness = { lock: '', inputType: proofData.witness_hex, outputType: '' };
      const unsigned = e.tx(
        [{ ...anchor1, since: absEpoch(sinceEpoch) }, feeWallet],
        [
          cell(anchor1.capacity - payout, anchor1.lock, anchor1.type, nextAnchor),
          cell(payoutAmount, C.locks[0]),
          cell(change, C.locks[2]),
        ],
        [e.dep('anchor'), ...(anchorLockDep ? [anchorLockDep] : [])],
        [witness, '0x'],
      );
      const roles = permissionlessAnchor ? [feeRole] : operatorControlledAnchor ? [...(authorizeOperator ? [2] : []), feeRole] : [0, feeRole];
      return signingWitnessGroup(unsigned, [anchor1, feeWallet], roles);
    }
    await e.reject('force_exit_before_operator_silence_epoch_rejected', await forceExit(179), /ValidationFailure|ScriptFailure|script|Immature|since/i);

    let mined = 0;
    while (true) {
      const epoch = await e.rpc('get_current_epoch');
      if (BigInt(epoch.number) >= 180n) break;
      await e.mine(100);
      mined += 100;
      if (mined % 500 === 0) console.log(`maturity progress: mined ${mined} blocks`);
    }
    const matureEpoch = await e.rpc('get_current_epoch');
    const invalidPayout = await forceExit(180, payout - 1n, true);
    await e.reject('force_exit_wrong_payout_amount_rejected_at_mature_epoch', invalidPayout, /ValidationFailure|ScriptFailure|script/i);
    if (operatorControlledAnchor) {
      const noOperatorSignature = await forceExit(180, payout, false);
      await e.reject('mature_force_exit_blocked_by_operator_anchor_lock_without_operator_signature', noOperatorSignature, /Inputs\[0\]\.Lock|error code -2|ValidationFailure|ScriptFailure/i);
    }
    const exitTx = await forceExit(180);
    const exitCells = await e.send('mature_owner_force_exit_after_180_private_chain_epochs', exitTx);
    e.events.at(-1).properties = {
      payout_shannons: payout.toString(),
      owner_lock_hash: C.U.scriptToHash(C.locks[0]),
      current_epoch: matureEpoch.number,
      mined_after_checkpoint: mined,
    };
    e.save();
    C.write(e.out + '/lifecycle.json', {
      classification: 'ACTUAL_PRIVATE_DEVNET_TRANSACTIONS',
      upstream_repository: 'LusoCryptoLabs/Liquid-Cells', upstream_commit: pin,
      fixture: 'fixtures/genesis', anchor_binary_sha256: C.crypto.createHash('sha256').update(codeBytes).digest('hex'),
      transactions: e.events.map(({ label, hash, cycles, bytes }) => ({ label, hash, cycles, bytes })),
      rejections: e.cases,
      force_exit: { owner_key: proofData.owner_key, payout_shannons: payout.toString(), maturity_epoch: matureEpoch.number, blocks_mined_after_checkpoint: mined },
      resulting_owner_payout: exitCells[1].outPoint,
      anchor_lock_design: permissionlessAnchor ? 'deployed CKB-VM always-success lock; user/operator signatures do not authorize anchor spends; the Liquid Cells type script validates state transitions and payout proofs' : operatorControlledAnchor ? 'operator secp lock; anchor lock continuity preserves operator control and requires its signature even after timeout' : 'owner secp lock (baseline mode)',
      owner_payout_lock_script: C.locks[0],
      checkpoint_authorization: permissionlessAnchor ? 'user key role 0 authorizes the input deposit; no signature is required by the permissionless anchor lock; a valid committed Groth16 proof authorizes the state transition' : operatorControlledAnchor ? 'user key role 0 authorizes the deposit and operator key role 2 authorizes spending its anchor lock; the valid Groth16 proof authorizes the state transition' : 'owner key role 0',
      anchor_lock_script: anchorLock,
      operator_lock_hash: C.U.scriptToHash(C.locks[2]),
      force_exit_fee_signer: permissionlessAnchor || operatorControlledAnchor ? 'independent user key role 1' : 'operator key role 2',
      operator_signature_required_for_mature_exit: operatorControlledAnchor,
      successor_anchor: {
        out_point: exitCells[0].outPoint,
        capacity_shannons: exitCells[0].capacity.toString(),
        root: hx(Buffer.from(exitTx.outputsData[0].slice(2), 'hex').subarray(0, 32)),
        total_shannons: readU128(40, Buffer.from(exitTx.outputsData[0].slice(2), 'hex')).toString(),
        last_epoch: readU64(72, Buffer.from(exitTx.outputsData[0].slice(2), 'hex')).toString(),
        slack_shannons: (exitCells[0].capacity - readU128(40, Buffer.from(exitTx.outputsData[0].slice(2), 'hex'))).toString(),
      },
      notes: [
        permissionlessAnchor ? 'The code-deployer/operator uses its key only for deployment, not for the checkpoint or exit transaction. The checkpoint consumes a user-authorized deposit cell and a valid Groth16 proof; the permissionless lock itself requires no signature. After timeout, an independent user pays and signs the exit transaction. The exiter pubkey is authenticated by the committed account proof and determines the only accepted payout lock; the exiter does not sign that transaction.' : operatorControlledAnchor ? 'The operator signs the checkpoint but disappears before the mature exit. A user-only mature exit is rejected by the operator secp lock; the same proof, timer, and payout succeed only after the operator signature is restored. This is an authorization boundary, not a timeout failure.' : 'The anchor uses the owner secp lock in this isolated reproduction; this does not establish permissionless sequencing or arbitrary operator recovery.',
        'A separate child process fetched the committed checkpoint transaction through CKB RPC and reconstructed the force-exit proof from its published DA; no fixture/sequencer files were input to that reconstruction.',
      ],
    });
    e.close();
  } catch (error) {
    e.close(error);
    console.error(error);
    process.exitCode = 1;
  }
})();
