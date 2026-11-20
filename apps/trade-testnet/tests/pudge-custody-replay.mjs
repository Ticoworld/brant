import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const binary = process.env.ROVEKO_PROOF_BINARY || fileURLToPath(new URL('../../../labs/trade-v2-token/gate2/recovery/target/release/trade-v2-recovery.exe', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'brant-custody-'));
const load = name => JSON.parse(readFileSync(new URL('./fixtures/pudge-custody-' + name + '.json', import.meta.url), 'utf8'));
function replay(bundle, expected) {
  const input = join(directory, 'input.json');
  const output = join(directory, 'output.json');
  writeFileSync(input, JSON.stringify(bundle));
  const result = spawnSync(binary, ['replay', input, output], {encoding: 'utf8', timeout: 10000});
  assert.ifError(result.error);
  if (!expected) {
    assert.equal(result.status, 2, result.stderr);
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(report.entitlement_total, expected.total);
  assert.equal(report.owner.balance, expected.balance);
}
try {
  replay(load('before'), {total: '13', balance: '6'});
  const after = load('after');
  replay(after, {total: '12', balance: '5'});
  const missingTransition = structuredClone(after);
  missingTransition.history.splice(-2, 1);
  replay(missingTransition);
  const malformedWitness = structuredClone(after);
  malformedWitness.history.at(-1).transaction.witnesses[5] = '0x';
  replay(malformedWitness);
  const staleRoot = structuredClone(after);
  staleRoot.live.data = load('before').live.data.replace(/^0x.{32}/, after.live.data.slice(0, 34));
  replay(staleRoot);
  console.log('Pudge custody ownership replay and three rejection checks passed.');
} finally {
  rmSync(directory, {recursive: true});
}
