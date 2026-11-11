#!/usr/bin/env node
'use strict';

// Reuses the standalone Gate 2 order fixture's native setup without editing it.
// The extra attacks are inserted in-memory after its valid order and revision tests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const fixture = path.join(__dirname, '..', 'orders', 'fixture.cjs');
const ordersDir = path.dirname(fixture);
const evidence = path.join(__dirname, 'evidence', `native-smt-${Date.now()}`);
fs.mkdirSync(evidence, { recursive: true });
const original = fs.readFileSync(fixture, 'utf8');
let source = original;

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  assert(first >= 0, `orders fixture anchor missing: ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `orders fixture anchor is ambiguous: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
  "const out = path.join(__dirname, 'evidence', 'native-' + Date.now());",
  `const out = ${JSON.stringify(evidence)};`,
  'evidence path',
);
source = source.replaceAll('http://127.0.0.1:19224', 'http://127.0.0.1:19234');
replaceOnce(
  "  fs.copyFileSync(path.join(template, 'ckb.toml'), path.join(chain, 'ckb.toml'));",
  "  const runConfig = fs.readFileSync(path.join(template, 'ckb.toml'), 'utf8').replaceAll('19224', '19234').replaceAll('19225', '19235');\n  fs.writeFileSync(path.join(chain, 'ckb.toml'), runConfig);",
  'isolated CKB RPC and P2P ports',
);

const attackCode = String.raw`
  const smtAttackDirectory = globalThis.__smtAttackDirectory;
  function smtAttackCellData(amount, root) {
    return hx(Buffer.concat([le(amount, 16), b(root)]));
  }
  async function expectCustodyReject(label, signed) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    let error;
    try {
      await rpc('estimate_cycles', [C.snake(signed)]);
    } catch (e) {
      error = e;
    }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert.match(message, /source: Inputs\[0\]\.Lock, cause: ValidationFailure: see error code 8\b/, message);
    assert(message.includes(hashes.custody_smt.slice(2)), 'rejection did not identify the fresh custody_smt code hash: ' + message);
    let broadcastError;
    try {
      await rpc('send_transaction', [C.snake(signed), 'passthrough']);
    } catch (e) {
      broadcastError = e;
    }
    assert(broadcastError, label + ' unexpectedly entered the transaction pool');
    const recordValue = {
      label,
      rawTransactionHash,
      rejectingSource: 'Inputs[0].Lock',
      rejectingCode: 8,
      rejectingCodeHash: hashes.custody_smt,
      estimateCyclesError: error.message,
      sendTransactionError: broadcastError.message,
      transaction: signed,
    };
    record('smt-attacks.jsonl', recordValue);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(recordValue, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' custody_smt:8');
  }

  // A real operation-1 purchase is the positive control and leaves a live,
  // freshly authenticated owner state for both rejected mutations below.
  const buyerAfterAdditionalBuy = { owner: buyer, balance: 6n, revision: 4n };
  const positiveBuyProof = makeProof(domain, 1, rows, [buyerAfterAdditionalBuy]);
  const purchaseInputs = [enrolled[0], enrolled[1], custodyCell, markerCell, solverRemainder];
  const additionalBuy = tx(purchaseInputs, [
    cell(enrolled[0].capacity + 19n * UNIT, market, token,
      hx(Buffer.concat([le(SUPPLY - 10n, 16), b(domain.custody_marker_type_hash)]))),
    cell(enrolled[1].capacity, market, marker, marketMarkerData),
    cell(custodyCell.capacity, custody, token, custodyData(10n, positiveBuyProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(solverRemainder.capacity - 19n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  additionalBuy.headerDeps = [genesis.header.hash];
  additionalBuy.witnesses.push(positiveBuyProof.witness);
  const additionalBuyResult = await commit('smt_attack_positive_control_additional_purchase', sign(additionalBuy, purchaseInputs, 4));
  rows[1] = buyerAfterAdditionalBuy;
  const attackCustody = additionalBuyResult[2], attackMarker = additionalBuyResult[3], attackBuyerWallet = additionalBuyResult[4];

  const solverOwner = U.scriptToHash(locks[5]);
  const solverEnrollment = { owner: solverOwner, balance: 1n, revision: 1n };
  const validEnrollmentProof = makeProof(domain, 1, rows, [solverEnrollment]);
  const attackFunding = setup[3];
  const attackInputs = [attackCustody, attackMarker, attackFunding];

  // Keep the authenticated leaf update and declared xUDT quantity consistent,
  // but corrupt a byte inside the compiled proof.
  const tamperedProof = structuredClone(validEnrollmentProof);
  const tamperedWitness = b(tamperedProof.witness);
  const updateCount = tamperedWitness[6] | (tamperedWitness[7] << 8);
  const proofStart = 12 + updateCount * 96;
  assert(proofStart < tamperedWitness.length, 'compiled multiproof unexpectedly empty');
  tamperedWitness[proofStart] ^= 1;
  tamperedProof.witness = hx(tamperedWitness);
  const tamperedTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  tamperedTx.headerDeps = [genesis.header.hash];
  tamperedTx.witnesses.push(tamperedProof.witness);
  await expectCustodyReject('tampered_compiled_multiproof', sign(tamperedTx, attackInputs, 5));

  // The proof is valid and adds one entitlement, while the custody xUDT data
  // claims two additional units. The custody lock must reject this mismatch.
  const inflatedTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(12n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  inflatedTx.headerDeps = [genesis.header.hash];
  inflatedTx.witnesses.push(validEnrollmentProof.witness);
  await expectCustodyReject('valid_proof_inflated_unbacked_entitlement', sign(inflatedTx, attackInputs, 5));
`;

replaceOnce(
  "  const tip = await rpc('get_tip_header');",
  attackCode + "\n  const tip = await rpc('get_tip_header');",
  'post-order attack insertion',
);

const digest = crypto.createHash('sha256').update(original).digest('hex');
source = `globalThis.__smtAttackDirectory = ${JSON.stringify(evidence)};\n` + source;
fs.writeFileSync(path.join(evidence, 'fixture-provenance.json'), JSON.stringify({
  sourceFixture: path.relative(path.join(__dirname, '..', '..', '..', '..'), fixture),
  sourceFixtureSha256: digest,
  derivedFixtureSha256: crypto.createHash('sha256').update(source).digest('hex'),
  rpcPort: 19234,
  p2pPort: 19235,
  attacks: ['tampered_compiled_multiproof', 'valid_proof_inflated_unbacked_entitlement'],
}, null, 2));

const result = spawnSync(process.execPath, ['-e', source], {
  cwd: ordersDir,
  env: { ...process.env, TRADE_ORDER_RPC_PORT: '19234' },
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status || 1;
