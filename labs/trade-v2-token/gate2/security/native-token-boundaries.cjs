#!/usr/bin/env node
'use strict';

// Targeted native xUDT authority and market-layout cases. The base fixture is
// rewritten in memory only so historical fixture and evidence remain intact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');

const fixture = path.join(__dirname, '..', 'orders', 'fixture.cjs');
const out = path.join(__dirname, 'evidence', 'native-token-boundaries-' + Date.now());
const buildDir = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, '..', 'build');
const sourceHashes = {
  market_smt_c: 'fa0f0db4f1eb545468deacc2d81e0ebc9a56983e616e3e0727ba6591700b4cfa',
  custody_smt_c: 'cac3356341e5197809a03909a7684e9971796fe1e7305c51572cfe5e07734eea',
  owner_lineage_candidate_c: 'a10fb1968054c3ad96b5ed4475fb008b27b51a60547394e1f980585c4891cb3e',
};
fs.mkdirSync(out, { recursive: true });

let source = fs.readFileSync(fixture, 'utf8');
source = source.replace('const SUPPLY = 2000n;', 'const SUPPLY = 0xffffffffn;');
assert(source.includes('const SUPPLY = 0xffffffffn;'), 'maximum-supply fixture parameter was not applied');
function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  assert(first >= 0, 'fixture anchor missing: ' + label);
  assert.equal(source.indexOf(needle, first + needle.length), -1, 'fixture anchor ambiguous: ' + label);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
  "const out = path.join(__dirname, 'evidence', 'native-' + Date.now());",
  'const out = ' + JSON.stringify(out) + ';',
  'evidence directory',
);
source = source.replaceAll('http://127.0.0.1:19224', 'http://127.0.0.1:19244');
replaceOnce(
  'const rpcPort = Number(process.env.TRADE_ORDER_RPC_PORT || 19224);',
  'const rpcPort = 19244;',
  'fixture RPC client port',
);
replaceOnce(
  "  fs.copyFileSync(path.join(template, 'ckb.toml'), path.join(chain, 'ckb.toml'));",
  "  const runConfig = fs.readFileSync(path.join(template, 'ckb.toml'), 'utf8').replaceAll('19224', '19244').replaceAll('19225', '19245');\n  fs.writeFileSync(path.join(chain, 'ckb.toml'), runConfig);",
  'isolated RPC ports',
);

const injected = String.raw`
  const crypto = require('node:crypto');
  const targetEvidence = ${JSON.stringify(out)};
  const sourceHashes = ${JSON.stringify(sourceHashes)};
  function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  async function expectTargetReject(label, signed, scriptName, expectedCode, alteredCondition, positiveControlRef = null) {
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    const codeHash = hashes[scriptName];
    const sourceMatch = message.match(/source: ([^,]+), cause:/);
    assert(sourceMatch, 'CKB-VM error omitted the failing source: ' + message);
    assert.match(message, new RegExp('source: Inputs\\[\\d+\\]\\.Lock, cause: ValidationFailure: see error code ' + expectedCode + '\\b'), message);
    assert(message.includes(codeHash.slice(2)), label + ' failed in a different script group: ' + message);
    let sendError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { sendError = e; }
    assert(sendError, label + ' unexpectedly entered the transaction pool');
    const value = {
      label,
      classification: 'VERIFIED_NATIVE_REJECTION',
      exploitHypothesis: label,
      positiveControl: scriptName === 'owner_lineage_candidate'
        ? (() => {
            const rows = fs.readFileSync(path.join(out, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
            const event = rows.find(row => row.label === 'issue_fixed_supply');
            return { label: 'issue_fixed_supply', transactionHash: event.hash, cycles: event.cycles.cycles, committed: true };
          })()
        : positiveControlRef || { label: 'offline_seller_initial_purchase', transactionHash: U.rawTransactionToHash(initialTx), committedAfterRejection: true },
      rawTransactionHash: U.rawTransactionToHash(signed),
      fullSignedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex'),
      witnessesSha256: crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex'),
      alteredCondition,
      rejectingSource: sourceMatch[1],
      rejectingScript: scriptName,
      rejectingCodeHash: codeHash,
      rejectingCode: expectedCode,
      estimateCyclesError: error.message,
      sendTransactionError: sendError.message,
      transaction: signed,
      sourceHashes,
      binarySha256: Object.fromEntries(['market_smt', 'owner_lineage_candidate', 'xudt'].map(n => [
        n,
        sha256File(n === 'xudt' ? path.join(C.ROOT, 'vendor/ickb/build/release/xudt') : path.join(build, n)),
      ])),
    };
    fs.writeFileSync(path.join(targetEvidence, label + '.json'), JSON.stringify(value, null, 2));
    record('boundary-attacks.jsonl', value);
    console.log('rejected ' + label + ' tx=' + value.rawTransactionHash + ' ' + scriptName + ':' + expectedCode);
  }
  async function expectXudtTypeReject(label, signed, alteredCondition, positiveControlHash) {
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert(message.includes('source: Inputs[0].Type, cause: ValidationFailure: see error code '), message);
    assert(message.includes(hashes.xudt.slice(2)), 'rejection did not identify the committed xUDT type script: ' + message);
    let sendError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { sendError = e; }
    assert(sendError, label + ' unexpectedly entered the transaction pool');
    const value = {
      label,
      classification: 'VERIFIED_NATIVE_REJECTION',
      exploitHypothesis: label,
      positiveControl: { label: 'positive_genuine_xudt_quantity_preserving_transfer', transactionHash: positiveControlHash, committedAfterRejection: true },
      rawTransactionHash: U.rawTransactionToHash(signed),
      fullSignedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex'),
      witnessesSha256: crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex'),
      alteredCondition,
      rejectingSource: message.split('source: ')[1].split(', cause:')[0],
      rejectingScript: 'xudt Type Script',
      rejectingCodeHash: hashes.xudt,
      rejectingCode: Number(message.split('see error code ')[1].split(' ')[0]),
      estimateCyclesError: error.message,
      sendTransactionError: sendError.message,
      transaction: signed,
      sourceHashes,
      binarySha256: sha256File(path.join(C.ROOT, 'vendor/ickb/build/release/xudt')),
    };
    fs.writeFileSync(path.join(targetEvidence, label + '.json'), JSON.stringify(value, null, 2));
    record('boundary-attacks.jsonl', value);
    console.log('rejected ' + label + ' tx=' + value.rawTransactionHash + ' xudt:' + value.rejectingCode);
  }

  // A valid one-shot issue has already committed. This second owner-locked
  // cell references that consumed anchor and cannot authorize a second issue.
  const unauthorizedMint = tx([setup[4], setup[5]], [
    cell(200n * UNIT, locks[3], token, hx(le(1n, 16))),
    cell(setup[4].capacity + setup[5].capacity - 200n * UNIT - fee, locks[2]),
  ], [deps.xudt, deps.owner_lineage_candidate]);
  const unauthorizedMintSigned = sign(unauthorizedMint, [setup[4], setup[5]], 2);
  await expectTargetReject(
    'owner-mode-reissue-with-consumed-anchor', unauthorizedMintSigned,
    'owner_lineage_candidate', 4,
    'attempt to create one additional genuine xUDT unit using a second owner-locked cell after the sole configured anchor was consumed',
  );
`;
replaceOnce(
  "  const seller = U.scriptToHash(locks[3]), buyer = U.scriptToHash(locks[4]);",
  injected + "\n  const seller = U.scriptToHash(locks[3]), buyer = U.scriptToHash(locks[4]);",
  'unauthorized mint attack after valid one-shot issuance',
);

const boundaryAnchor = "  const bought = await commit('offline_seller_initial_purchase', sign(initialTx, [issued[0], issued[1], setup[1]], 3));";
const attackAndControl = String.raw`
  // A well-formed alternate xUDT Type Script identity cannot replace the
  // asset committed into this market's marker and singleton lineage.
  const counterfeitToken = { ...token, args: U.scriptToHash(locks[5]) };
  const counterfeitInventoryTx = structuredClone(initialTx);
  counterfeitInventoryTx.outputs[0].type = counterfeitToken;
  const counterfeitInventorySigned = sign(counterfeitInventoryTx, [issued[0], issued[1], setup[1]], 3);
  await expectTargetReject(
    'alternate-xudt-type-substituted-for-market-inventory', counterfeitInventorySigned,
    'market_smt', 6,
    'replaced the market inventory successor type with a syntactically valid xUDT Type Script sharing the pinned code but carrying a different owner-script hash',
  );

  // A zero-quantity output preserves the genuine xUDT total. Capacity is
  // shifted from the funded seller change output to make this transaction valid.
  const extraTokenOutputTx = structuredClone(initialTx);
  const extraOutputCapacity = 200n * UNIT;
  const sellerRemainderIndex = 4;
  const sellerRemainder = BigInt(extraTokenOutputTx.outputs[sellerRemainderIndex].capacity);
  extraTokenOutputTx.outputs[sellerRemainderIndex].capacity = hex(sellerRemainder - extraOutputCapacity);
  extraTokenOutputTx.outputs.push({ capacity: hex(extraOutputCapacity), lock: locks[5], type: token });
  extraTokenOutputTx.outputsData.push(hx(le(0n, 16)));
  const extraTokenOutputSigned = sign(extraTokenOutputTx, [issued[0], issued[1], setup[1]], 3);
  await expectTargetReject(
    'unexpected-additional-xudt-output', extraTokenOutputSigned,
    'market_smt', 4,
    'appended a standard-lock zero-quantity output under the genuine xUDT type; total token quantity and capacity remain conserved, but the market initialization layout gains an extra output',
  );
`;
const followOn = String.raw`
  const rowSeller7 = [{ owner: seller, balance: 7n, revision: 0n }];
  const rowSeller4 = [{ owner: seller, balance: 4n, revision: 1n }];
  const withdrawThreeProof = makeProof(domain, 5, rowSeller7, rowSeller4);
  const withdrawThreeInputs = [bought[2], bought[3], bought[4]];
  const withdrawThreeTx = tx(withdrawThreeInputs, [
    cell(bought[2].capacity, custody, token, custodyData(4n, withdrawThreeProof.root)),
    cell(bought[3].capacity, custody, custodyMarker, custodyMarkerData),
    cell(142n * UNIT, locks[3], token, hx(le(3n, 16))),
    cell(bought[4].capacity - 142n * UNIT - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawThreeTx.witnesses.push(withdrawThreeProof.witness);
  const withdrewThree = await commit('positive_partial_external_withdrawal_three_units', sign(withdrawThreeTx, withdrawThreeInputs, 3));

  const rowSeller0 = [{ owner: seller, balance: 0n, revision: 2n }];
  const withdrawFourProof = makeProof(domain, 5, rowSeller4, rowSeller0);
  const withdrawFourInputs = [withdrewThree[0], withdrewThree[1], withdrewThree[3]];
  const withdrawFourTx = tx(withdrawFourInputs, [
    cell(withdrewThree[0].capacity, custody, token, custodyData(0n, withdrawFourProof.root)),
    cell(withdrewThree[1].capacity, custody, custodyMarker, custodyMarkerData),
    cell(142n * UNIT, locks[3], token, hx(le(4n, 16))),
    cell(withdrewThree[3].capacity - 142n * UNIT - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawFourTx.witnesses.push(withdrawFourProof.witness);
  const withdrewFour = await commit('positive_remaining_external_withdrawal_four_units', sign(withdrawFourTx, withdrawFourInputs, 3));

  // Reach the genuine xUDT Type Script with a fully balanced token transfer.
  // The attack changes only the output quantity from three to four.
  const validTokenTransferTx = tx([withdrewThree[2], withdrewFour[3]], [
    cell(withdrewThree[2].capacity, locks[3], token, hx(le(3n, 16))),
    cell(withdrewThree[2].capacity + withdrewFour[3].capacity - withdrewThree[2].capacity - fee, locks[3]),
  ], [deps.xudt]);
  const quantityInflationTx = tx([withdrewThree[2], withdrewFour[3]], [
    cell(withdrewThree[2].capacity, locks[3], token, hx(le(4n, 16))),
    cell(withdrewThree[2].capacity + withdrewFour[3].capacity - withdrewThree[2].capacity - fee, locks[3]),
  ], [deps.xudt]);
  const quantityInflationSigned = sign(quantityInflationTx, [withdrewThree[2], withdrewFour[3]], 3);
  await expectXudtTypeReject(
    'genuine-xudt-quantity-inflation-on-external-transfer', quantityInflationSigned,
    'attempted to increase the genuine xUDT amount from 3 to 4 without owner-mode input or a matching authorized issuance',
    U.rawTransactionToHash(validTokenTransferTx),
  );

  const validTokenTransfer = await commit('positive_genuine_xudt_quantity_preserving_transfer',
    sign(validTokenTransferTx, [withdrewThree[2], withdrewFour[3]], 3));

  // Add another valid same-owner xUDT input to an otherwise valid external
  // curve sale, preserving all input token quantity into two owner outputs.
  const soldBeforeExternal = 7n;
  const redemptionPrice = (10n + soldBeforeExternal - 1n) * UNIT;
  const nextInventory = SUPPLY - 7n;
  const extraTokenInputTx = tx(
    [bought[0], bought[1], validTokenTransfer[0], withdrewFour[2], validTokenTransfer[1]],
    [
      cell(bought[0].capacity - redemptionPrice, market, token,
        hx(Buffer.concat([le(nextInventory + 1n, 16), b(domain.custody_marker_type_hash)]))),
      cell(bought[1].capacity, market, marker, marketMarkerData),
      cell(validTokenTransfer[0].capacity, locks[3], token, hx(le(6n, 16))),
      cell(withdrewFour[2].capacity, locks[3], token, hx(le(0n, 16))),
      cell(validTokenTransfer[1].capacity + redemptionPrice - fee, locks[3]),
    ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  const extraTokenInputSigned = sign(extraTokenInputTx,
    [bought[0], bought[1], validTokenTransfer[0], withdrewFour[2], validTokenTransfer[1]], 3);
  const validExternalSaleTx = tx([bought[0], bought[1], validTokenTransfer[0], validTokenTransfer[1]], [
    cell(bought[0].capacity - redemptionPrice, market, token,
      hx(Buffer.concat([le(nextInventory + 1n, 16), b(domain.custody_marker_type_hash)]))),
    cell(bought[1].capacity, market, marker, marketMarkerData),
    cell(validTokenTransfer[0].capacity, locks[3], token, hx(le(2n, 16))),
    cell(validTokenTransfer[1].capacity + redemptionPrice - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  validExternalSaleTx.witnesses.push(hx(Buffer.concat([le(1n, 8), le(0n, 8)])));
  await expectTargetReject(
    'unexpected-additional-xudt-input-to-external-sale', extraTokenInputSigned,
    'market_smt', 23,
    'included a second genuine external xUDT input, preserved both input quantities into two outputs and kept transaction capacity balanced; the current market branch sees an unexpected external token cell where it requires the custody singleton',
    { label: 'positive_canonical_external_curve_sale_one_unit', transactionHash: U.rawTransactionToHash(validExternalSaleTx), committedAfterRejection: true },
  );
  // The market sell must leave the amount field at 2 following redemption.
  const validExternalSale = await commit('positive_canonical_external_curve_sale_one_unit',
    sign(validExternalSaleTx, [bought[0], bought[1], withdrewThree[2], validTokenTransfer[1]], 3));

  const committedEvents = fs.readFileSync(path.join(out, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const positiveControls = committedEvents
    .filter(event => event.label === 'issue_fixed_supply' || event.label === 'offline_seller_initial_purchase' ||
      event.label.startsWith('positive_'))
    .map(event => ({
      label: event.label,
      transactionHash: event.hash,
      cycles: event.cycles.cycles,
      inputCount: event.tx.inputs.length,
      outputCount: event.tx.outputs.length,
      signedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(event.tx)).digest('hex'),
    }));
  fs.writeFileSync(path.join(out, 'target-completion.json'), JSON.stringify({
    classification: 'VERIFIED_NATIVE_TARGETED_RUN',
    ckbVersion: '0.210.0',
    supply: SUPPLY.toString(),
    genesis: genesis.header.hash,
    committedPositiveControls: positiveControls,
    maximumSupplyIssueTransaction: positiveControls.find(event => event.label === 'issue_fixed_supply'),
    rejectedAttackCount: 5,
    finalMarketInventory: validExternalSale[0].data,
    finalExternalSellerAmount: validExternalSale[2].data,
  }, null, 2));
  return;
`;
replaceOnce(
  boundaryAnchor,
  attackAndControl + '\n' + boundaryAnchor + '\n' + followOn,
  'targeted token attacks, positive controls, and focused stop',
);

const binaryHashes = Object.fromEntries(['market_smt', 'owner_lineage_candidate'].map(name => {
  const file = path.join(buildDir, name);
  assert(fs.existsSync(file), 'missing fresh binary: ' + file);
  return [name, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
}));
const xudtBinary = path.join(process.env.TRADE_NATIVE_ROOT || '', 'vendor/ickb/build/release/xudt');
assert(fs.existsSync(xudtBinary), 'missing pinned native xUDT binary: ' + xudtBinary);
binaryHashes.xudt = crypto.createHash('sha256').update(fs.readFileSync(xudtBinary)).digest('hex');
fs.writeFileSync(path.join(out, 'provenance.json'), JSON.stringify({
  classification: 'VERIFIED_NATIVE_FIXTURE_PROVENANCE',
  ckbVersion: '0.210.0',
  sourceHashes,
  binaryHashes,
  generatedAt: new Date().toISOString(),
  runner: path.relative(process.cwd(), __filename),
  fixture: path.relative(process.cwd(), fixture),
  privateDisposableChain: true,
}, null, 2));

const moduleInstance = new Module(fixture, module);
moduleInstance.filename = fixture;
moduleInstance.paths = Module._nodeModulePaths(path.dirname(fixture));
moduleInstance._compile(source, fixture);
