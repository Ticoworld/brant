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
  async function expectCustodyReject(label, signed, expectedCode = 8, alteredCondition = label) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try {
      await rpc('estimate_cycles', [C.snake(signed)]);
    } catch (e) {
      error = e;
    }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert.match(message, new RegExp('source: Inputs\\[\\d+\\]\\.Lock, cause: ValidationFailure: see error code ' + expectedCode + '\\b'), message);
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
      fullSignedTransactionSha256,
      witnessesSha256,
      rejectingSource: 'Inputs[0].Lock',
      rejectingCode: expectedCode,
      rejectingCodeHash: hashes.custody_smt,
      alteredCondition,
      estimateCyclesError: error.message,
      sendTransactionError: broadcastError.message,
      transaction: signed,
    };
    record('smt-attacks.jsonl', recordValue);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(recordValue, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' custody_smt:' + expectedCode);
  }
  async function expectMarketReject(label, signed, expectedCode, alteredCondition) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert.match(message, new RegExp('source: Inputs\\[\\d+\\]\\.Lock, cause: ValidationFailure: see error code ' + expectedCode + '\\b'), message);
    assert(message.includes(hashes.market_smt.slice(2)), 'rejection did not identify the fresh market_smt code hash: ' + message);
    let broadcastError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { broadcastError = e; }
    assert(broadcastError, label + ' unexpectedly entered the transaction pool');
    const recordValue = {
      label, rawTransactionHash, fullSignedTransactionSha256, witnessesSha256,
      rejectingSource: 'Inputs[0].Lock', rejectingCode: expectedCode,
      rejectingCodeHash: hashes.market_smt, alteredCondition,
      estimateCyclesError: error.message, sendTransactionError: broadcastError.message, transaction: signed,
    };
    record('market-attacks.jsonl', recordValue);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(recordValue, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' market_smt:' + expectedCode);
  }
  async function expectSellerFeeCapReject(label, signed, alteredCondition) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    const marketHit = /source: Inputs\[\d+\]\.Lock, cause: ValidationFailure: see error code 28\b/.test(message) &&
      message.includes(hashes.market_smt.slice(2));
    const custodyHit = /source: Inputs\[\d+\]\.Lock, cause: ValidationFailure: see error code 6\b/.test(message) &&
      message.includes(hashes.custody_smt.slice(2));
    assert(marketHit || custodyHit, 'seller underpayment did not hit the curve payout or custody fee-cap guard: ' + message);
    let sendError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { sendError = e; }
    assert(sendError, label + ' unexpectedly entered the transaction pool');
    const rejectingCode = marketHit ? 28 : 6;
    const rejectingCodeHash = marketHit ? hashes.market_smt : hashes.custody_smt;
    const value = {
      label, rawTransactionHash, fullSignedTransactionSha256, witnessesSha256,
      rejectingSource: message.match(/source: (Inputs\[\d+\]\.Lock)/)[1], rejectingCode,
      rejectingCodeHash, alteredCondition, estimateCyclesError: error.message,
      sendTransactionError: sendError.message, transaction: signed,
    };
    record('market-attacks.jsonl', value);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(value, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' fee-cap:' + rejectingCodeHash);
  }
  async function recordAcceptedControl(label, signed, targetScript) {
    const cycles = await rpc('estimate_cycles', [C.snake(signed)]);
    const value = {
      label,
      rawTransactionHash: U.rawTransactionToHash(signed),
      fullSignedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex'),
      witnessesSha256: crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex'),
      targetScript,
      codeHash: targetScript === 'market_smt' ? hashes.market_smt : hashes.custody_smt,
      estimateCycles: cycles,
      transaction: signed,
    };
    record('positive-controls.jsonl', value);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(value, null, 2));
    return cycles;
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

  function proofBytes(proof) { return b(proof.witness); }
  function updateOffset(witness, ownerHash) {
    const count = witness[6];
    for (let i = 0; i < count; i++) {
      const start = 12 + i * 96;
      if (witness.subarray(start, start + 32).equals(b(ownerHash))) return start;
    }
    throw new Error('owner missing from TMS1 witness: ' + ownerHash);
  }
  function rawRevisionProof(owner, balance, revision) {
    const input = JSON.stringify(proofInput(domain, 1, rows, [{ owner, balance, revision }]));
    const raw = execFileSync('cargo', [
      'run', '--quiet', '--locked', '--manifest-path', path.join(__dirname, '..', 'smt-tools', 'Cargo.toml'), '--',
      'proof-adversarial-revision', '-', '-',
    ], { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(raw);
    return { root: parsed.new_root, witness: hx(b(parsed.contract_witness.hex)) };
  }

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
  await expectCustodyReject('tampered_compiled_multiproof', sign(tamperedTx, attackInputs, 5), 8,
    'one compiled multiproof opcode bit flipped; old/new roots otherwise declared from valid enrollment');

  // Claim an active old leaf for the solver even though its key is absent from
  // the committed root. The forged leaf remains canonical, so the CSMT check
  // must reject the root rather than the TMS1 parser.
  const forgedMembershipProof = structuredClone(validEnrollmentProof);
  const forgedMembershipWitness = proofBytes(forgedMembershipProof);
  const membershipStart = updateOffset(forgedMembershipWitness, solverOwner);
  forgedMembershipWitness.fill(0, membershipStart + 32, membershipStart + 64);
  forgedMembershipWitness[membershipStart + 32] = 1;
  forgedMembershipWitness[membershipStart + 48] = 1;
  forgedMembershipProof.witness = hx(forgedMembershipWitness);
  const forgedMembershipTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  forgedMembershipTx.headerDeps = [genesis.header.hash];
  forgedMembershipTx.witnesses.push(forgedMembershipProof.witness);
  await expectCustodyReject('forged_membership_claim_for_absent_solver', sign(forgedMembershipTx, attackInputs, 5), 8,
    'old leaf changed from canonical absence to active balance 1 revision 0 without changing the committed old root');

  // Conversely, claim absence for the already enrolled buyer while using a
  // real next-state proof and matching +1 custody quantity.
  const buyerAfterBuy = { owner: buyer, balance: 7n, revision: 5n };
  const validBuyerBuyProof = makeProof(domain, 1, rows, [buyerAfterBuy]);
  const forgedNonMembershipProof = structuredClone(validBuyerBuyProof);
  const forgedNonMembershipWitness = proofBytes(forgedNonMembershipProof);
  const buyerEntry = updateOffset(forgedNonMembershipWitness, buyer);
  forgedNonMembershipWitness.fill(0, buyerEntry + 32, buyerEntry + 64);
  forgedNonMembershipProof.witness = hx(forgedNonMembershipWitness);
  const buyerAttackInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const forgedNonMembershipTx = tx(buyerAttackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validBuyerBuyProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  forgedNonMembershipTx.headerDeps = [genesis.header.hash];
  forgedNonMembershipTx.witnesses.push(forgedNonMembershipProof.witness);
  await expectCustodyReject('forged_nonmembership_claim_for_enrolled_buyer', sign(forgedNonMembershipTx, buyerAttackInputs, 4), 8,
    'old leaf changed from enrolled buyer balance 6 revision 4 to canonical absence while output root and custody delta claim balance 7');

  // A canonical-shape check is distinct from a Merkle root failure.
  const invalidNewLeafProof = structuredClone(validEnrollmentProof);
  const invalidNewLeafWitness = proofBytes(invalidNewLeafProof);
  invalidNewLeafWitness[membershipStart + 64 + 16] = 3;
  invalidNewLeafProof.witness = hx(invalidNewLeafWitness);
  const invalidNewLeafTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  invalidNewLeafTx.headerDeps = [genesis.header.hash];
  invalidNewLeafTx.witnesses.push(invalidNewLeafProof.witness);
  await expectCustodyReject('invalid_new_leaf_state_tag', sign(invalidNewLeafTx, attackInputs, 5), 7,
    'new active entitlement leaf state tag changed from 1 to non-canonical value 3');

  // Build a proof with correct roots but a skipped revision. Only the test
  // proof command bypasses its host-side revision check; the native lock sees
  // the exact proposed transition and must reject it.
  const badRevision = rawRevisionProof(buyer, 7n, 99n);
  const badRevisionTx = tx(buyerAttackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, badRevision.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  badRevisionTx.headerDeps = [genesis.header.hash];
  badRevisionTx.witnesses.push(badRevision.witness);
  await expectCustodyReject('skipped_owner_revision_with_valid_old_and_new_roots', sign(badRevisionTx, buyerAttackInputs, 4), 9,
    'buyer balance increases from 6 to 7 with a cryptographically valid root but revision jumps from 4 to 99');

  // The enrollment proof and quantity are valid, but the transaction is
  // signed by a different live owner. This must fail the owner-input binding.
  const unauthorizedInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const unauthorizedTx = tx(unauthorizedInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  unauthorizedTx.headerDeps = [genesis.header.hash];
  unauthorizedTx.witnesses.push(validEnrollmentProof.witness);
  await expectCustodyReject('unauthorized_owner_input_for_solver_allocation', sign(unauthorizedTx, unauthorizedInputs, 4), 21,
    'valid solver enrollment and matching custody increase paid with buyer lock input instead of solver lock input');

  // Duplicate owner identity is tested on a valid two-owner offline transfer
  // shape. The previous committed offline fill is its native positive control.
  const duplicateOrder = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 2n, 1n, 70n * UNIT, seller,
    '0x' + 'c3'.repeat(32));
  const duplicateRowsProof = makeProof(domain, 8, rows, [
    { owner: seller, balance: 3n, revision: 3n },
    { owner: buyer, balance: 7n, revision: 5n },
  ], duplicateOrder.extra);
  const duplicateWitness = proofBytes(duplicateRowsProof);
  const firstEntry = 12, secondEntry = 12 + 96;
  duplicateWitness.copy(duplicateWitness, secondEntry, firstEntry, firstEntry + 32);
  const duplicateProof = { root: duplicateRowsProof.root, witness: hx(duplicateWitness) };
  const duplicateInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const duplicateTx = tx(duplicateInputs, [
    cell(attackCustody.capacity, custody, token, custodyData(10n, duplicateProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - 70n * UNIT - fee, locks[4]),
    cell(70n * UNIT, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  duplicateTx.headerDeps = [genesis.header.hash];
  duplicateTx.witnesses.push(duplicateProof.witness);
  await expectCustodyReject('duplicate_owner_identity_in_transition', sign(duplicateTx, duplicateInputs, 4), 7,
    'second TMS1 owner identity replaced by the first owner identity in a otherwise balanced signed offline-fill transaction');

  // The proof is valid and adds one entitlement, while the custody xUDT data
  // claims two additional units. The custody lock must reject this mismatch.
  const inflatedTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(12n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  inflatedTx.headerDeps = [genesis.header.hash];
  inflatedTx.witnesses.push(validEnrollmentProof.witness);
  await expectCustodyReject('valid_proof_inflated_unbacked_entitlement', sign(inflatedTx, attackInputs, 5), 8,
    'one unit added to actual custody data beyond the valid proof entitlement delta');

  // Produce a new native Gate 2 market purchase to control the reserve tests.
  const buyPrice = 20n * UNIT;
  const marketBuyInputs = [additionalBuyResult[0], additionalBuyResult[1], attackCustody, attackMarker, attackFunding];
  const marketBuy = tx(marketBuyInputs, [
    cell(additionalBuyResult[0].capacity + buyPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 11n, 16), b(domain.custody_marker_type_hash)]))),
    cell(additionalBuyResult[1].capacity, market, marker, marketMarkerData),
    cell(attackCustody.capacity, custody, token, custodyData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - buyPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  marketBuy.headerDeps = [genesis.header.hash];
  marketBuy.witnesses.push(validEnrollmentProof.witness);
  const marketBuySigned = sign(marketBuy, marketBuyInputs, 5);
  await recordAcceptedControl('valid_gate2_market_buy_control', marketBuySigned, 'market_smt');

  const forgedCustodyRoot = structuredClone(marketBuySigned);
  const forgedCustodyData = b(forgedCustodyRoot.outputsData[2]);
  forgedCustodyData[16] ^= 1;
  forgedCustodyRoot.outputsData[2] = hx(forgedCustodyData);
  await expectCustodyReject('gate2_custody_output_root_substitution',
    sign(forgedCustodyRoot, marketBuyInputs, 5), 8,
    'correct owner updates and custody amount are retained while one byte of the declared new root is changed');

  const forgedMarketSuccessor = structuredClone(marketBuySigned);
  const forgedMarketArgs = b(forgedMarketSuccessor.outputs[0].lock.args);
  forgedMarketArgs[0] ^= 1;
  forgedMarketSuccessor.outputs[0].lock.args = hx(forgedMarketArgs);
  await expectMarketReject('gate2_forged_market_singleton_successor',
    sign(forgedMarketSuccessor, marketBuyInputs, 5), 21,
    'otherwise valid purchase changes the market singleton lock arguments instead of preserving the canonical lineage');

  const reserveExtraction = structuredClone(marketBuySigned);
  reserveExtraction.outputs[0].capacity = hex(BigInt(reserveExtraction.outputs[0].capacity) - UNIT);
  reserveExtraction.outputs[4].capacity = hex(BigInt(reserveExtraction.outputs[4].capacity) + UNIT);
  await expectMarketReject('gate2_market_reserve_extraction_one_ckb', sign(reserveExtraction, marketBuyInputs, 5), 28,
    'market inventory and custody transition are valid; one CKB is diverted from the required curve reserve to buyer change');
  const marketBuyResult = await commit('valid_gate2_market_buy_positive_control', marketBuySigned);
  rows.push(solverEnrollment);

  // Sell the sole solver unit. This is the zero-balance tombstone control for
  // subsequent lineage rebuy, with a matching reversible-curve reserve payout.
  const sellPrice = 20n * UNIT;
  const soldSolver = { owner: solverOwner, balance: 0n, revision: 2n };
  const sellProof = makeProof(domain, 4, rows, [soldSolver], Buffer.concat([le(1n), le(sellPrice)]));
  const sellInputs = [marketBuyResult[0], marketBuyResult[1], marketBuyResult[2], marketBuyResult[3], marketBuyResult[4]];
  const sellTx = tx(sellInputs, [
    cell(marketBuyResult[0].capacity - sellPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 10n, 16), b(domain.custody_marker_type_hash)]))),
    cell(marketBuyResult[1].capacity, market, marker, marketMarkerData),
    cell(marketBuyResult[2].capacity, custody, token, custodyData(10n, sellProof.root)),
    cell(marketBuyResult[3].capacity, custody, custodyMarker, custodyMarkerData),
    cell(marketBuyResult[4].capacity + sellPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  sellTx.headerDeps = [genesis.header.hash];
  sellTx.witnesses.push(sellProof.witness);
  const sellSigned = sign(sellTx, sellInputs, 5);
  await recordAcceptedControl('valid_gate2_curve_sell_control', sellSigned, 'market_smt');

  const divertedPayout = structuredClone(sellSigned);
  divertedPayout.outputs[4].lock = locks[4];
  await expectMarketReject('gate2_curve_seller_payout_redirect', sign(divertedPayout, sellInputs, 5), 25,
    'curve sell payout output redirected from the owner lock to a different valid standard lock');

  const excessiveSellerFee = structuredClone(sellSigned);
  excessiveSellerFee.outputs[4].capacity = hex(BigInt(excessiveSellerFee.outputs[4].capacity) - UNIT);
  await expectSellerFeeCapReject('gate2_curve_seller_underpayment_exceeds_fee_limit', sign(excessiveSellerFee, sellInputs, 5),
    'seller receives one CKB less than the already fee-adjusted valid payout, making total transaction fee exceed the custody script limit');

  const inflatedPayout = structuredClone(sellSigned);
  inflatedPayout.outputs[4].capacity = hex(BigInt(inflatedPayout.outputs[4].capacity) + UNIT);
  inflatedPayout.outputs[0].capacity = hex(BigInt(inflatedPayout.outputs[0].capacity) - UNIT);
  await expectMarketReject('gate2_curve_payout_inflation_from_reserve', sign(inflatedPayout, sellInputs, 5), 28,
    'seller is paid one CKB above the curve payout by extracting one additional CKB from the market reserve');

  const soldSolverCells = await commit('valid_gate2_curve_sell_to_tombstone', sellSigned);
  rows[rows.findIndex(row => row.owner === solverOwner)] = soldSolver;
  const rebuySolver = { owner: solverOwner, balance: 1n, revision: 3n };
  const rebuyProof = makeProof(domain, 1, rows, [rebuySolver]);
  const rebuyInputs = [soldSolverCells[0], soldSolverCells[1], soldSolverCells[2], soldSolverCells[3], soldSolverCells[4]];
  const rebuyTx = tx(rebuyInputs, [
    cell(soldSolverCells[0].capacity + buyPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 11n, 16), b(domain.custody_marker_type_hash)]))),
    cell(soldSolverCells[1].capacity, market, marker, marketMarkerData),
    cell(soldSolverCells[2].capacity, custody, token, custodyData(11n, rebuyProof.root)),
    cell(soldSolverCells[3].capacity, custody, custodyMarker, custodyMarkerData),
    cell(soldSolverCells[4].capacity - buyPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  rebuyTx.headerDeps = [genesis.header.hash];
  rebuyTx.witnesses.push(rebuyProof.witness);
  const rebuyCells = await commit('valid_gate2_same_lineage_rebuy_after_tombstone', sign(rebuyTx, rebuyInputs, 5));
  rows[rows.findIndex(row => row.owner === solverOwner)] = rebuySolver;
  custodyCell = rebuyCells[2];
  markerCell = rebuyCells[3];

  // Build a second, genuinely independent Gate 2 lineage from another anchor.
  const anchorB = wallets[1];
  const anchorBBytes = Buffer.concat([b(anchorB.outPoint.txHash), le(BigInt(anchorB.outPoint.index), 4)]);
  const markerB = { codeHash: hashes.marker_candidate, hashType: 'data1', args: hash(Buffer.concat([le(0), anchorBBytes, le(1)])) };
  const marketB = { codeHash: hashes.market_smt, hashType: 'data1', args: hx(Buffer.concat([
    b(hash(anchorBBytes)), le(10n * UNIT), le(UNIT), le(SUPPLY), b(U.scriptToHash(markerB)),
  ])) };
  const ownerB = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([
    anchorBBytes, b(hashes.xudt), b(U.scriptToHash(marketB)), le(SUPPLY, 16),
  ])) };
  const tokenB = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(ownerB) };
  const marketMarkerDataB = hx(Buffer.concat([b(U.scriptToHash(marketB)), b(U.scriptToHash(tokenB))]));
  const custodyMarkerB = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(marketB) };
  const custodyB = { codeHash: hashes.custody_smt, hashType: 'data1', args: hx(Buffer.concat([
    b(U.scriptToHash(marketB)), b(U.scriptToHash(tokenB)), b(genesis.header.hash), b(U.scriptToHash(custodyMarkerB)),
  ])) };
  const custodyMarkerDataB = hx(Buffer.concat([b(U.scriptToHash(custodyB)), b(U.scriptToHash(tokenB))]));
  const domainB = {
    genesis_hash: genesis.header.hash,
    market_script_hash: U.scriptToHash(marketB),
    xudt_type_script_hash: U.scriptToHash(tokenB),
    custody_marker_type_hash: U.scriptToHash(custodyMarkerB),
  };
  assert.notEqual(domainB.market_script_hash, domain.market_script_hash);
  assert.notEqual(domainB.xudt_type_script_hash, domain.xudt_type_script_hash);
  assert.notEqual(U.scriptToHash(custodyB), U.scriptToHash(custody));
  fs.writeFileSync(path.join(smtAttackDirectory, 'two-market-identities.json'), JSON.stringify({
    marketA: { anchor: anchor.outPoint, market: U.scriptToHash(market), token: U.scriptToHash(token), custody: U.scriptToHash(custody), marker: U.scriptToHash(marker) },
    marketB: { anchor: anchorB.outPoint, market: domainB.market_script_hash, token: domainB.xudt_type_script_hash, custody: U.scriptToHash(custodyB), marker: U.scriptToHash(markerB) },
    distinct_market_token_custody_and_marker_lineages: true,
  }, null, 2));

  const ownerBSeedTx = tx([setup[5]], [
    cell(200n * UNIT, ownerB),
    cell(setup[5].capacity - 200n * UNIT - fee, locks[2]),
  ]);
  const ownerBSeed = await commit('fund_market_B_owner_lineage_cell', sign(ownerBSeedTx, [setup[5]], 2));
  const issueBInputs = [anchorB, ownerBSeed[0]];
  const issueBTx = tx(issueBInputs, [
    cell(300n * UNIT, marketB, tokenB, hx(le(SUPPLY, 16))),
    cell(300n * UNIT, marketB, markerB, marketMarkerDataB),
    cell(anchorB.capacity + ownerBSeed[0].capacity - 600n * UNIT - fee, locks[1]),
  ], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
  const issueBSigned = sign(issueBTx, issueBInputs, 1);
  const issuedB = await commit('issue_market_B_from_independent_anchor', issueBSigned);
  const fundBInputs = [issuedB[2]];
  const fundBTx = tx(fundBInputs, [
    cell(3000n * UNIT, locks[3]), cell(3000n * UNIT, locks[4]), cell(3000n * UNIT, locks[3]),
    cell(issuedB[2].capacity - 9000n * UNIT - fee, locks[1]),
  ]);
  const fundedB = await commit('fund_market_B_owner_wallets', sign(fundBTx, fundBInputs, 1));
  const sellerB = U.scriptToHash(locks[3]), buyerB = U.scriptToHash(locks[4]);
  const initialBProof = makeProof(domainB, 0, [], [{ owner: sellerB, balance: 7n, revision: 0n }], le(91n * UNIT));
  const initialBTx = tx([issuedB[0], issuedB[1], fundedB[0]], [
    cell(issuedB[0].capacity + 91n * UNIT, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 7n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(issuedB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(350n * UNIT, custodyB, tokenB, custodyData(7n, initialBProof.root)),
    cell(350n * UNIT, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(fundedB[0].capacity - 791n * UNIT - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  initialBTx.headerDeps = [genesis.header.hash];
  initialBTx.witnesses.push(initialBProof.witness);
  const initializedB = await commit('initialize_market_B_positive_control', sign(initialBTx, [issuedB[0], issuedB[1], fundedB[0]], 3));
  let rowsB = [{ owner: sellerB, balance: 7n, revision: 0n }];
  const enrollBProof = makeProof(domainB, 1, rowsB, [{ owner: buyerB, balance: 2n, revision: 1n }]);
  const enrollBInputs = [initializedB[0], initializedB[1], initializedB[2], initializedB[3], fundedB[1]];
  const enrollBTx = tx(enrollBInputs, [
    cell(initializedB[0].capacity + 35n * UNIT, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 9n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(initializedB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(initializedB[2].capacity, custodyB, tokenB, custodyData(9n, enrollBProof.root)),
    cell(initializedB[3].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(fundedB[1].capacity - 35n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  enrollBTx.headerDeps = [genesis.header.hash];
  enrollBTx.witnesses.push(enrollBProof.witness);
  const enrolledB = await commit('market_B_buyer_enrollment_positive_control', sign(enrollBTx, enrollBInputs, 4));
  rowsB = [...rowsB, { owner: buyerB, balance: 2n, revision: 1n }];

  const sellerBAfterFill = { owner: sellerB, balance: 4n, revision: 1n };
  const buyerBAfterFill = { owner: buyerB, balance: 5n, revision: 2n };
  const crossMarketOrderProof = makeProof(domainB, 8, rowsB, [sellerBAfterFill, buyerBAfterFill], order.extra);
  const makeBOrderFill = proof => {
    const inputs = [enrolledB[2], enrolledB[3], enrolledB[4]];
    const value = tx(inputs, [
      cell(enrolledB[2].capacity, custodyB, tokenB, custodyData(9n, proof.root)),
      cell(enrolledB[3].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
      cell(enrolledB[4].capacity - minProceeds - fee, locks[4]), cell(minProceeds, locks[3]),
    ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
    value.headerDeps = [genesis.header.hash];
    value.witnesses.push(proof.witness);
    return { inputs, tx: value };
  };
  const replayAOrderOnB = makeBOrderFill(crossMarketOrderProof);
  await expectCustodyReject('cross_market_A_offline_order_replay_on_B',
    sign(replayAOrderOnB.tx, replayAOrderOnB.inputs, 4), 38,
    'Market A seller signature is replayed against Market B custody and otherwise valid Market B owner revisions');
  const orderB = await signedOrder(domainB, U.scriptToHash(custodyB), 3, sellerB, 0n, 3n,
    minProceeds, sellerB, '0x' + 'b2'.repeat(32));
  const validBOrderProof = makeProof(domainB, 8, rowsB, [sellerBAfterFill, buyerBAfterFill], orderB.extra);
  const validBOrder = makeBOrderFill(validBOrderProof);
  const filledB = await commit('market_B_valid_offline_order_positive_control',
    sign(validBOrder.tx, validBOrder.inputs, 4));
  rowsB = [sellerBAfterFill, buyerBAfterFill];

  const buyerBAfterWithdrawal = { owner: buyerB, balance: 4n, revision: 3n };
  const withdrawBProof = makeProof(domainB, 5, rowsB, [buyerBAfterWithdrawal]);
  const withdrawBInputs = [filledB[0], filledB[1], filledB[2]];
  const withdrawBTx = tx(withdrawBInputs, [
    cell(filledB[0].capacity, custodyB, tokenB, custodyData(8n, withdrawBProof.root)),
    cell(filledB[1].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(142n * UNIT, locks[4], tokenB, hx(le(1n, 16))),
    cell(filledB[2].capacity - 142n * UNIT - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawBTx.witnesses.push(withdrawBProof.witness);
  const withdrawnB = await commit('market_B_external_withdrawal_positive_control', sign(withdrawBTx, withdrawBInputs, 4));
  rowsB = [sellerBAfterFill, buyerBAfterWithdrawal];
  const marketBSellPrice = 18n * UNIT;
  const marketBSellInputs = [enrolledB[0], enrolledB[1], withdrawnB[2], withdrawnB[3]];
  const marketBSellTx = tx(marketBSellInputs, [
    cell(enrolledB[0].capacity - marketBSellPrice, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 8n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(enrolledB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnB[2].capacity, locks[4], tokenB, hx(le(0n, 16))),
    cell(withdrawnB[3].capacity + marketBSellPrice - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  marketBSellTx.witnesses.push(hx(le(1n, 16)));
  const soldExternalB = await commit('market_B_external_redemption_positive_control', sign(marketBSellTx, marketBSellInputs, 4));

  const sellerAAfterWithdrawal = { owner: seller, balance: 3n, revision: 3n };
  const withdrawAProof = makeProof(domain, 5, rows, [sellerAAfterWithdrawal]);
  const withdrawAInputs = [custodyCell, markerCell, fundedB[2]];
  const withdrawATx = tx(withdrawAInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(10n, withdrawAProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(142n * UNIT, locks[3], token, hx(le(1n, 16))),
    cell(fundedB[2].capacity - 142n * UNIT - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawATx.headerDeps = [genesis.header.hash];
  withdrawATx.witnesses.push(withdrawAProof.witness);
  const withdrawnA = await commit('market_A_external_withdrawal_for_substitution_controls', sign(withdrawATx, withdrawAInputs, 3));
  rows[rows.findIndex(row => row.owner === seller)] = sellerAAfterWithdrawal;
  custodyCell = withdrawnA[0];
  markerCell = withdrawnA[1];

  const crossMarketAssetInputs = [soldExternalB[0], soldExternalB[1], withdrawnA[2], withdrawnA[3]];
  const crossMarketAssetTx = tx(crossMarketAssetInputs, [
    cell(soldExternalB[0].capacity, marketB, tokenB, soldExternalB[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnA[2].capacity, locks[3], token, withdrawnA[2].data),
    cell(withdrawnA[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  await expectMarketReject('cross_market_A_xudt_substituted_for_B_external_sale',
    sign(crossMarketAssetTx, crossMarketAssetInputs, 3), 41,
    'genuine Market A xUDT is supplied as the external sell asset to a valid Market B inventory and marker pair');

  const sellerACanceled = { owner: seller, balance: 3n, revision: 4n };
  const cancelAForBProof = makeProof(domain, 7, rows, [sellerACanceled]);
  const crossMarketCustodyInputs = [soldExternalB[0], soldExternalB[1], custodyCell, markerCell, withdrawnA[3]];
  const crossMarketCustodyTx = tx(crossMarketCustodyInputs, [
    cell(soldExternalB[0].capacity, marketB, tokenB, soldExternalB[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(custodyCell.capacity, custody, token, custodyData(10n, cancelAForBProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(withdrawnA[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  crossMarketCustodyTx.headerDeps = [genesis.header.hash];
  crossMarketCustodyTx.witnesses.push(cancelAForBProof.witness);
  await expectMarketReject('cross_market_A_custody_substituted_into_B_transition',
    sign(crossMarketCustodyTx, crossMarketCustodyInputs, 3), 22,
    'a cryptographically valid Market A custody cancellation is paired with Market B market inventory and marker singletons');

  const fakeMarketBAssetInputs = [withdrawnA[2], withdrawnA[3]];
  const fakeMarketBAssetTx = tx(fakeMarketBAssetInputs, [
    cell(300n * UNIT, marketB, token, withdrawnA[2].data),
    cell(withdrawnA[2].capacity + withdrawnA[3].capacity - 300n * UNIT - fee, locks[3]),
  ], [deps.xudt]);
  const fakeMarketBAsset = await commit('prepare_A_asset_locked_by_B_market_script', sign(fakeMarketBAssetTx, fakeMarketBAssetInputs, 3));
  const sellerBAfterCancel = { owner: sellerB, balance: 4n, revision: 2n };
  const cancelBForInventoryProof = makeProof(domainB, 7, rowsB, [sellerBAfterCancel]);
  const crossInventoryInputs = [fakeMarketBAsset[0], soldExternalB[1], withdrawnB[0], withdrawnB[1], filledB[3]];
  const crossInventoryTx = tx(crossInventoryInputs, [
    cell(fakeMarketBAsset[0].capacity, marketB, token, fakeMarketBAsset[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnB[0].capacity, custodyB, tokenB, custodyData(8n, cancelBForInventoryProof.root)),
    cell(withdrawnB[1].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(filledB[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  crossInventoryTx.headerDeps = [genesis.header.hash];
  crossInventoryTx.witnesses.push(cancelBForInventoryProof.witness);
  await expectMarketReject('cross_market_A_asset_used_as_B_inventory_singleton',
    sign(crossInventoryTx, crossInventoryInputs, 3), 22,
    'a real Market A xUDT holder transfers one token to the Market B lock, then attempts a valid B custody transition using it as B inventory');
`;

replaceOnce(
  "  const tip = await rpc('get_tip_header');",
  attackCode + "\n  const tip = await rpc('get_tip_header');",
  'post-order attack insertion',
);

const digest = crypto.createHash('sha256').update(original).digest('hex');
const buildDir = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, '..', 'build');
const binaryNames = ['marker_candidate', 'market_smt', 'custody_smt', 'custody_marker'];
source = `const crypto = require('node:crypto');\nglobalThis.__smtAttackDirectory = ${JSON.stringify(evidence)};\n` + source;
const derivedFixture = path.join(ordersDir, `.smt-attacks-${Date.now()}.cjs`);
fs.writeFileSync(derivedFixture, source);
fs.writeFileSync(path.join(evidence, 'derived-fixture.cjs'), source);
fs.writeFileSync(path.join(evidence, 'fixture-provenance.json'), JSON.stringify({
  sourceFixture: path.relative(path.join(__dirname, '..', '..', '..', '..'), fixture),
  sourceFixtureSha256: digest,
  securityRunnerSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
  derivedFixtureSha256: crypto.createHash('sha256').update(source).digest('hex'),
  freshGate2ElfSha256: Object.fromEntries(binaryNames.map(name => [
    name, crypto.createHash('sha256').update(fs.readFileSync(path.join(buildDir, name))).digest('hex'),
  ])),
  rpcPort: 19234,
  p2pPort: 19235,
  attacks: [
    'tampered_compiled_multiproof',
    'forged_membership_claim_for_absent_solver',
    'forged_nonmembership_claim_for_enrolled_buyer',
    'invalid_new_leaf_state_tag',
    'skipped_owner_revision_with_valid_old_and_new_roots',
    'unauthorized_owner_input_for_solver_allocation',
    'duplicate_owner_identity_in_transition',
    'valid_proof_inflated_unbacked_entitlement',
    'gate2_custody_output_root_substitution',
    'gate2_forged_market_singleton_successor',
    'gate2_market_reserve_extraction_one_ckb',
    'gate2_curve_seller_payout_redirect',
    'gate2_curve_seller_underpayment_exceeds_fee_limit',
    'gate2_curve_payout_inflation_from_reserve',
    'cross_market_A_offline_order_replay_on_B',
    'cross_market_A_xudt_substituted_for_B_external_sale',
    'cross_market_A_custody_substituted_into_B_transition',
    'cross_market_A_asset_used_as_B_inventory_singleton',
  ],
}, null, 2));

const result = spawnSync(process.execPath, [derivedFixture], {
  cwd: ordersDir,
  env: { ...process.env, TRADE_ORDER_RPC_PORT: '19234' },
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
fs.unlinkSync(derivedFixture);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status || 1;
