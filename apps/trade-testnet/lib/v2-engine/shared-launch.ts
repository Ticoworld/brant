import {ccc} from '@ckb-ccc/core';
import {buildFirstPurchase, buildInitializationSetup, buildIssuance, deriveMarketIdentity} from './initialization.ts';
import {verifyInitializationLive, verifyInitializationDependencies} from './initialization-live.ts';
import {verifyInitializationStage} from './initialization-lifecycle.ts';
import {verifyInitializationSignature} from './initialization-signature.ts';
import {quote} from './curve.ts';
import {PUDGE_GATE2_ANCHOR, PUDGE_GATE2_CODES, PUDGE_GATE2_GENESIS, PUDGE_GATE2_STAGE_TXS, PUDGE_GATE2_XUDT_DEP} from './pudge-public-registry.ts';

type Rpc = Parameters<typeof verifyInitializationLive>[0];
type Cell = Parameters<typeof verifyInitializationLive>[2][number];
type Point = Cell['outPoint'];
type Dependency = Parameters<typeof verifyInitializationLive>[3][number];
const unit = 100_000_000n;
const curve = {base: 10n * unit, step: unit, supply: 2000n, inventory: 2000n};
const slots = ['custody', 'market', 'custodyMarker', 'marker', 'ownerLock'] as const;
type Code = typeof slots[number] | 'xudt' | 'secp';
type Dependencies = Record<Code, Dependency>;
const pointKey = (point: Point) => `${point.txHash.toLowerCase()}:${BigInt(point.index)}`;
export const sharedLaunchStages = ['setup', 'issuance', 'purchase'] as const;
type Stage = typeof sharedLaunchStages[number];
const hash = /^0x[0-9a-f]{64}$/i;

function pudgeDependencies(): Dependencies {
  const code = Object.fromEntries(slots.map((name, index) => [name, {
    outPoint: {txHash: PUDGE_GATE2_STAGE_TXS.code, index: ccc.numToHex(index)},
    dataHash: PUDGE_GATE2_CODES[name],
  }])) as Record<typeof slots[number], Dependency>;
  return {
    ...code,
    xudt: {...PUDGE_GATE2_XUDT_DEP, dataHash: PUDGE_GATE2_CODES.xudt},
    secp: {
      outPoint: {txHash: '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37', index: '0x0'},
      dataHash: '0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236',
    },
  };
}

export function sharedLaunchDependencies(genesis: string, fixture?: Dependencies): Dependencies {
  if (!hash.test(genesis)) throw Error('Invalid launch genesis');
  const pudge = pudgeDependencies();
  if (genesis.toLowerCase() === PUDGE_GATE2_GENESIS) {
    if (fixture) throw Error('Pudge dependencies are pinned');
    return pudge;
  }
  const names = [...slots, 'xudt', 'secp'] as const;
  const publicPoints = new Set(Object.values(pudge).map(dep => pointKey(dep.outPoint)));
  if (!fixture || names.some(name => !fixture[name] || publicPoints.has(pointKey(fixture[name].outPoint))) ||
      new Set(names.map(name => pointKey(fixture[name].outPoint))).size !== names.length) {
    throw Error('Distinct fixture dependencies required');
  }
  return structuredClone(fixture);
}

type Proof = {owner: string; witness: string; newRoot: string};
type Launch = {
  genesis: string;
  creator: ccc.ScriptLike;
  anchor: Cell;
  funding: Cell[];
  reservedAnchors: Point[];
  fixture?: Dependencies;
  quantity: bigint;
  feeRate: bigint;
  resumeJournal?: string;
  verifyProof: (owner: string, quantity: bigint, price: bigint) => Promise<Proof>;
  timing?: (name: string, ms: number) => void;
};

function successor(transaction: ccc.Transaction, index: number): Cell {
  return {
    ...transaction.outputs[index],
    outPoint: {txHash: transaction.hash(), index: ccc.numToHex(index)},
    data: transaction.outputsData[index],
  };
}

/** Project unsigned stage transactions. Call prepareStage before presenting any
 * projected transaction for approval. The proof callback authenticates the
 * empty-tree transition for the supplied owner and terms. */
export async function planSharedLaunch(rpc: Rpc, request: Launch) {
  request = {
    ...request,
    creator: ccc.Script.from(request.creator).clone(),
    anchor: copyCell(request.anchor),
    funding: request.funding.map(copyCell),
    reservedAnchors: structuredClone(request.reservedAnchors),
  };
  const {genesis, anchor, funding, quantity, feeRate} = request;
  const creator = ccc.Script.from(request.creator);
  const owner = creator.hash();
  const allInputs = [anchor, ...funding];
  const reservations = new Set([...request.reservedAnchors,
    ...(genesis.toLowerCase() === PUDGE_GATE2_GENESIS ? [PUDGE_GATE2_ANCHOR] : [])].map(pointKey));
  if (reservations.has(pointKey(anchor.outPoint)) ||
      funding.some(cell => reservations.has(pointKey(cell.outPoint)))) throw Error('Reserved launch anchor');
  if (allInputs.some(cell => cell.type || cell.data !== '0x' || !creator.eq(cell.lock))) {
    throw Error('Launch inputs must be plain Cells owned by the creator');
  }
  if (feeRate <= 0n) throw Error('Positive fee rate required');
  const dependencies = sharedLaunchDependencies(genesis, request.fixture);
  if (Object.values(dependencies).some(dep => allInputs.some(cell => pointKey(cell.outPoint) === pointKey(dep.outPoint)))) {
    throw Error('Launch inputs cannot consume shared dependencies');
  }
  const allDeps = Object.values(dependencies);
  if (request.resumeJournal) await verifyInitializationDependencies(rpc, genesis, allDeps);
  else await verifyInitializationLive(rpc, genesis, allInputs, allDeps, request.timing);
  const identity = deriveMarketIdentity({
    ...curve, genesis, anchor: anchor.outPoint,
    codes: {
      market: dependencies.market.dataHash, marker: dependencies.marker.dataHash, owner: dependencies.ownerLock.dataHash,
      custody: dependencies.custody.dataHash, custodyMarker: dependencies.custodyMarker.dataHash, xudt: dependencies.xudt.dataHash,
    },
  });
  const price = quote(curve, 'buy', quantity);
  const proof = {...await request.verifyProof(owner, quantity, price)};
  if (proof.owner !== owner) throw Error('Initial proof belongs to another creator');
  const dep = (name: Code) => ({
    outPoint: dependencies[name].outPoint,
    depType: name === 'secp' ? 'depGroup' as const : 'code' as const,
  });
  // Preserve the supported initialization capacities. Buyer funding uses the
  // exact purchase outputs, occupied change and fee instead of the RVK budget.
  const allocation = {inventoryCapacity: 300n * unit, markerCapacity: 300n * unit,
    custodyCapacity: 350n * unit, custodyMarkerCapacity: 350n * unit};
  const occupiedChange = BigInt(ccc.CellOutput.from({lock: creator}).occupiedSize) * unit;
  const purchaseDeps = ['secp', 'market', 'marker', 'custody', 'custodyMarker', 'xudt'] as const;
  const issuanceDeps = ['secp', 'ownerLock', 'xudt', 'marker'] as const;
  const secpDep = dep('secp');
  const priced = (build: (fee: bigint) => ccc.Transaction, signerIndex: number) => {
    const estimate = build(0n);
    estimate.setWitnessArgs(signerIndex, ccc.WitnessArgs.from({lock: '0x' + '00'.repeat(65)}));
    const fee = estimate.estimateFee(feeRate);
    return {transaction: build(fee), fee};
  };
  const purchase = (inventory: Cell, marker: Cell, buyer: Cell, fee: bigint) =>
    buildFirstPurchase({...allocation, identity, inventory, marker, buyer, supply: curve.supply,
      genesis, quantity, price, fee, newRoot: proof.newRoot, witness: proof.witness, deps: purchaseDeps.map(dep)});
  const buyerFloor = price + allocation.custodyCapacity + allocation.custodyMarkerCapacity + occupiedChange;
  // Serialization uses fixed-width outpoints and capacities. Size the purchase
  // with the reviewed anchor outpoint before the predecessor hashes exist.
  const sizingCell = {...anchor, capacity: buyerFloor};
  const sizingInventory = {...anchor, capacity: allocation.inventoryCapacity, lock: identity.market,
    type: identity.token, data: '0xd007' + '00'.repeat(14)};
  const sizingMarker = {...anchor, capacity: allocation.markerCapacity, lock: identity.market,
    type: identity.marker, data: identity.markerData};
  const sizedPurchase = purchase(sizingInventory, sizingMarker, sizingCell, 0n);
  sizedPurchase.setWitnessArgs(2, ccc.WitnessArgs.from({lock: '0x' + '00'.repeat(65)}));
  const buyerCapacity = buyerFloor + sizedPurchase.estimateFee(feeRate);
  const setup = priced(fee => buildInitializationSetup({identity, anchor: anchor.outPoint, inputs: funding,
    ownerCapacity: 200n * unit, buyerCapacity, fee, secpDep}), 0);
  const lineage = successor(setup.transaction, 0);
  const buyer = successor(setup.transaction, 1);
  const issuance = priced(fee => buildIssuance({...allocation, identity, anchor, ownerCell: lineage,
    supply: curve.supply, fee, deps: issuanceDeps.map(dep)}), 0);
  const inventory = successor(issuance.transaction, 0);
  const marker = successor(issuance.transaction, 1);
  const firstPurchase = priced(fee => purchase(inventory, marker, buyer, fee), 2);
  const plans = {setup, issuance, purchase: firstPurchase};
  const stageInputs = {setup: funding, issuance: [anchor, lineage], purchase: [inventory, marker, buyer]};
  const scope = {genesis, owner, anchor: anchor.outPoint, market: identity.market.hash()};
  const fees = Object.values(plans).reduce((sum, plan) => sum + plan.fee, 0n);
  const change = setup.transaction.outputs[2].capacity + issuance.transaction.outputs[2].capacity +
    firstPurchase.transaction.outputs[4].capacity;
  const locked = firstPurchase.transaction.outputs.slice(0, 4).reduce((sum, output) => sum + output.capacity, 0n);
  const eligibleFunding = allInputs.reduce((sum, input) => sum + input.capacity, 0n);
  if (eligibleFunding !== change + locked + fees) throw Error('Launch capacity does not reconcile');
  const stageHashes = Object.fromEntries(sharedLaunchStages.map(stage => [stage, plans[stage].transaction.hash()])) as Record<Stage, string>;
  if (request.resumeJournal) readSharedLaunchJournal(request.resumeJournal, scope, stageHashes);
  return {
    dependencies:structuredClone(dependencies),
    identity, scope: structuredClone(scope), stageHashes: {...stageHashes},
    accounting: {eligibleFunding, locked, change, curveReserve: price, fees,
      stageFees: {setup: setup.fee, issuance: issuance.fee, purchase: firstPurchase.fee}},
    projected: Object.fromEntries(sharedLaunchStages.map(stage => [stage, plans[stage].transaction.clone()])) as Record<Stage, ccc.Transaction>,
    verifySignature(stage: Stage, signed: ccc.Transaction) {
      verifyInitializationSignature(plans[stage].transaction, signed, stageInputs[stage],
        stage === 'purchase' ? 2 : 0, owner);
    },
    verifyReceipt(stage: Stage, requireLive = true) {
      return verifyInitializationStage(rpc, genesis, stage, plans[stage].transaction,
        stageInputs[stage].map(cell => cell.outPoint), stage === 'purchase' ? [0, 1, 2, 3] : [0, 1], requireLive);
    },
    async prepareStage(stage: Stage, rawJournal: string) {
      const journal = readSharedLaunchJournal(rawJournal, scope, stageHashes);
      const index = sharedLaunchStages.indexOf(stage);
      if (index !== journal.entries.length || journal.entries.some(entry => entry.state !== 'confirmed')) {
        throw Error('Launch stage requires reconciliation');
      }
      // Setup's lineage output is spent by issuance. The buyer output must
      // remain live until purchase and is checked with that stage's inputs.
      if (stage !== 'setup') {
        const entry = journal.entries[index - 1];
        const previous = entry.stage;
        const receipt = await verifyInitializationStage(rpc, genesis, previous, plans[previous].transaction,
          stageInputs[previous].map(cell => cell.outPoint), [0, 1]);
        if (receipt.blockHash !== entry.blockHash) throw Error('Launch receipt changed');
      }
      await verifyInitializationLive(rpc, genesis, stage === 'setup' ? allInputs : stageInputs[stage], allDeps);
      return plans[stage].transaction.clone();
    },
  };
}

function copyCell(cell: Cell): Cell {
  return {...cell, outPoint: {...cell.outPoint}, lock: ccc.Script.from(cell.lock).clone(),
    type: cell.type ? ccc.Script.from(cell.type).clone() : undefined};
}

type Scope = {genesis: string; owner: string; anchor: Point; market: string};
type Entry = {stage: Stage; txHash: string; state: 'submitted' | 'confirmed'; blockHash?: string};
export const sharedLaunchJournalKey = (scope: Scope) => `brant-launch-v2:${scope.genesis}:${scope.market}`;

/** Journal entries are recovery hints. Use prepareStage to verify receipts
 * against the immutable plan and current RPC state. */
export function readSharedLaunchJournal(raw: string, scope: Scope, hashes: Record<Stage, string>) {
  if (raw.length > 16_384) throw Error('Launch journal is too large');
  const journal = JSON.parse(raw) as Scope & {version: 2; entries: Entry[]};
  if (!journal || journal.version !== 2 || journal.genesis !== scope.genesis || journal.owner !== scope.owner ||
      journal.market !== scope.market || !journal.anchor || pointKey(journal.anchor) !== pointKey(scope.anchor) ||
      !Array.isArray(journal.entries) || journal.entries.length > 3) throw Error('Launch journal identity mismatch');
  const seen = new Set<string>();
  journal.entries.forEach((entry, index) => {
    if (!entry || entry.stage !== sharedLaunchStages[index] || entry.txHash !== hashes[entry.stage] ||
        seen.has(entry.txHash) || !['submitted', 'confirmed'].includes(entry.state) ||
        (entry.state === 'confirmed' ? !hash.test(entry.blockHash ?? '') : entry.blockHash !== undefined) ||
        (index < journal.entries.length - 1 && entry.state !== 'confirmed')) throw Error('Invalid launch journal stage');
    seen.add(entry.txHash);
  });
  return journal;
}
