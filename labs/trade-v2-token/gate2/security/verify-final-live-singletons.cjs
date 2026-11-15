#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

if (process.argv.length !== 5) {
  throw new Error('Usage: node verify-final-live-singletons.cjs <native-run-dir> <node-rpc-url> <output.json>');
}

const runDir = path.resolve(process.argv[2]);
const rpcUrl = process.argv[3];
const outputPath = path.resolve(process.argv[4]);
const C = require(path.resolve(__dirname, '../../../rebuild/native/src/lib.cjs'));
const summary = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
const events = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const finalEvent = events.find(event => event.hash.toLowerCase() === summary.finalMarket.txHash.toLowerCase());
assert(finalEvent, 'final singleton transaction is absent from the native run event log');
assert.equal(C.U.rawTransactionToHash(finalEvent.tx).toLowerCase(), summary.finalMarket.txHash.toLowerCase());
assert.equal(summary.finalCustody.txHash.toLowerCase(), summary.finalMarket.txHash.toLowerCase());

let rpcId = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const body = await response.json();
  assert(response.ok && !body.error, `${method} failed: ${JSON.stringify(body.error || body)}`);
  return { method, params, response: body };
}

function scriptHash(script) {
  return script ? C.U.scriptToHash(C.camel(script)).toLowerCase() : null;
}

function dataHex(cell) {
  return cell.data.content.toLowerCase();
}

async function main() {
  const tip = await rpc('get_tip_header');
  assert.equal(tip.response.result.hash.toLowerCase(), summary.tip.toLowerCase(),
    'canonical tip changed after the recorded replay');
  const targets = [
    { name: 'market_inventory', point: summary.finalMarket, index: 0, expectedLock: summary.scripts.market, expectedType: summary.scripts.token },
    { name: 'market_marker', point: { txHash: summary.finalMarket.txHash, index: '0x1' }, index: 1, expectedLock: summary.scripts.market, expectedType: summary.scripts.marker },
    { name: 'custody_xudt', point: summary.finalCustody, index: 2, expectedLock: summary.scripts.custody, expectedType: summary.scripts.token },
    { name: 'custody_marker', point: { txHash: summary.finalCustody.txHash, index: '0x3' }, index: 3, expectedLock: summary.scripts.custody, expectedType: summary.scripts.custodyMarker },
  ];
  const live = [];
  for (const target of targets) {
    const query = await rpc('get_live_cell', [
      { tx_hash: target.point.txHash, index: target.point.index },
      true,
    ]);
    assert.equal(query.response.result.status, 'live', `${target.name} final singleton is not live`);
    const actual = query.response.result.cell;
    const actualOutput = actual.output;
    const expected = finalEvent.tx.outputs[target.index];
    const expectedData = finalEvent.tx.outputsData[target.index].toLowerCase();
    assert.equal(BigInt(actualOutput.capacity), BigInt(expected.capacity), `${target.name} capacity differs from its committed output`);
    assert.equal(scriptHash(actualOutput.lock), scriptHash(target.expectedLock), `${target.name} lock identity differs`);
    assert.equal(scriptHash(actualOutput.type), scriptHash(target.expectedType), `${target.name} type identity differs`);
    assert.equal(dataHex(actual), expectedData, `${target.name} data differs from its committed output`);
    live.push({
      name: target.name,
      out_point: { tx_hash: target.point.txHash, index: target.point.index },
      status: query.response.result.status,
      capacity: actualOutput.capacity,
      lock_hash: scriptHash(actualOutput.lock),
      type_hash: scriptHash(actualOutput.type),
      data: dataHex(actual),
      matches_committed_transaction_output: true,
      rpc: query,
    });
  }
  assert.equal(BigInt(`0x${live[0].data.slice(2, 34).match(/../g).reverse().join('') || '0'}`), BigInt(summary.marketInventory));
  const custodyAmount = BigInt(`0x${live[2].data.slice(2, 34).match(/../g).reverse().join('')}`);
  assert.equal(custodyAmount, BigInt(summary.internalEntitlements));
  const result = {
    format: 'trade-v2-final-live-singleton-rpc-v1',
    network: 'private CKB 0.210.0 disposable chain',
    genesis: summary.genesis,
    canonical_tip: tip.response.result,
    source_transaction: finalEvent.hash,
    live_singletons: live,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: 'PASS', output: outputPath, tip: result.canonical_tip.hash,
    live: live.map(cell => cell.name) }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
