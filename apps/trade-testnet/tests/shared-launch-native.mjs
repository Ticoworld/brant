import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planSharedLaunch, sharedLaunchStages} from '../lib/v2-engine/shared-launch.ts';
import {launchMetadataMessage} from '../lib/v2-engine/launch-metadata.ts';
import {recoverSharedLaunch} from '../lib/v2-engine/shared-launch-controller.ts';
import {launchOperations} from '../lib/v2-engine/launch-operations-server.ts';
import {openSharedLaunchStore} from '../lib/v2-engine/shared-launch-store.ts';
import {buildTransition} from '../lib/v2-engine/transaction.ts';
import {startSharedMarketApp} from './shared-market-app-runner.mjs';
import {prepareLocalReview} from '../lib/v2-engine/local-review.ts';
import {prepareWithdrawal} from '../lib/v2-engine/withdrawal-review.ts';
import {buildWithdrawal} from '../lib/v2-engine/withdrawal.ts';
import {quote,decodeCurve} from '../lib/v2-engine/curve.ts';
import {discoverCustodyPair, recoverMarketHistory,recoverMarketSuccessors} from '../lib/v2-engine/lineage.ts';

async function canonicalReceipt(rpc, hash) {
  const {transaction, tx_status: status} = await rpc('get_transaction', [hash]);
  assert.equal(status.status, 'committed');
  assert.equal(transaction.hash, hash);
  const block = await rpc('get_block_by_number', [status.block_number]);
  assert.equal(block.header.hash, status.block_hash);
  assert(block.transactions.some(transaction => transaction.hash === hash));
  return {hash, blockHash: status.block_hash, blockNumber: status.block_number};
}

async function waitForIndexer(rpc) {
  const tip = await rpc('get_tip_header', [], AbortSignal.timeout(1000));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const indexed = await rpc('get_indexer_tip', [], AbortSignal.timeout(1000));
    if (indexed?.block_hash === tip.hash) return;
    await delay(100);
  }
  throw Error(`Indexer did not reach canonical tip ${tip.hash}`);
}

export async function runSharedLaunch({rpc, genesis, hashes, deps, secp, wallets, locks, cell, tx, sign, commit, makeProof, le, out, camel, restartNode, signMetadata, connectBrowserWallet}) {
  const unit = 100_000_000n;
  const fundingFee = 100_000n;
  const funded = await commit('wo3b-fund-creators', sign(tx([wallets[2]], [
    cell(500n * unit, locks[0]), cell(1500n * unit, locks[0]),
    cell(500n * unit, locks[1]), cell(1500n * unit, locks[1]),
    cell(wallets[2].capacity - 4000n * unit - fundingFee, locks[2]),
  ]), [wallets[2]], [2]));
  const names = {market:'market_smt', marker:'marker_candidate', ownerLock:'owner_lineage_candidate',
    custody:'custody_smt', custodyMarker:'custody_marker', xudt:'xudt'};
  const fixture = Object.fromEntries(Object.entries(names).map(([name, source]) =>
    [name, {...deps[source], dataHash:hashes[source]}]));
  const point = ({txHash,index}) => ({tx_hash:txHash,index});
  const legacy = transaction => {
    const converted = camel(cccA.JsonRpcTransformers.transactionFrom(transaction));
    for (const dep of converted.cellDeps) {
      if (dep.depType === 'dep_group') dep.depType = 'depGroup';
    }
    return converted;
  };
  const secpRow = await rpc('get_live_cell', [point(secp.outPoint), true]);
  fixture.secp = {...secp, dataHash:ccc.hashCkb(secpRow.cell.data.content)};
  const dbPath = join(out, 'launch.sqlite');
  let store = openSharedLaunchStore(dbPath);
  const results = [];
  const runtimeMarkets=[];
  let application;const originalFetch=globalThis.fetch;
  const restart = {errors: []};
  try {
    for (const role of [0,1]) {
      const creator = ccc.Script.from(locks[role]);
      const anchor = funded[2*role];
      const identity = (await import('../lib/v2-engine/initialization.ts')).deriveMarketIdentity({
        anchor:anchor.outPoint, genesis, base:10n*unit, step:unit, supply:2000n,
        codes:{market:fixture.market.dataHash, marker:fixture.marker.dataHash, owner:fixture.ownerLock.dataHash,
          custody:fixture.custody.dataHash, custodyMarker:fixture.custodyMarker.dataHash, xudt:fixture.xudt.dataHash},
      });
      const domain = {genesis_hash:genesis, market_script_hash:identity.market.hash(),
        xudt_type_script_hash:identity.token.hash(), custody_marker_type_hash:identity.custodyMarker.hash()};
      const leaf = {owner:creator.hash(), balance:7n, revision:0n};
      const config = {genesis, fixture, creator, anchor, funding:[funded[2*role+1]], reservedAnchors:[], quantity:7n,
        feeRate:2000n, verifyProof:async (owner, quantity, price) => {
          assert.equal(owner, leaf.owner);
          assert.equal(quantity, leaf.balance);
          assert.equal(price, 91n*unit);
          const proof = makeProof(domain, 0, [], [leaf], le(price));
          return {owner, witness:proof.witness, newRoot:proof.root};
        }};
      let plan = await planSharedLaunch(rpc, config);
      const {scope, stageHashes} = plan;
      let setup, issuance, purchase;
      for (const stage of sharedLaunchStages) {
        const review = stage === 'setup' ? plan.projected.setup : await plan.prepareStage(stage, store.read(scope, stageHashes));
        const inputs = stage === 'setup' ? config.funding : stage === 'issuance' ? [anchor, setup[0]] : [...issuance.slice(0,2), setup[1]];
        const unsigned = legacy(review);
        const signed = ccc.Transaction.from(sign(unsigned, inputs, [role]));
        let outputs;
        const restartHere = role === 1 && stage === 'purchase';
        let beforeNode=role===0&&stage==='setup';
        const send = async candidate => {
          if(beforeNode){beforeNode=false;throw Error('Simulated loss before node');}
          outputs = await commit(`wo3b-creator-${role}-${stage}`, legacy(candidate));
          if (restartHere) throw Error('Simulated lost acknowledgement');
          return outputs[0].outPoint.txHash;
        };
        const operate = launchOperations({rpc, genesis, fixture, quantity:7n,
          proof: (_, owner) => config.verifyProof(owner, 7n, 91n*unit),
          openStore: () => openSharedLaunchStore(dbPath), send});
        const descriptor = {creator, anchor:anchor.outPoint, funding:config.funding.map(cell => cell.outPoint),
          feeRate:String(config.feeRate), market:scope.market, hashes:stageHashes};
        const sessionId = {owner:scope.owner, market:scope.market};
        const submitTransaction = transaction => operate('submit', {...sessionId, stage, descriptor,
          signed:cccA.JsonRpcTransformers.transactionFrom(transaction)});
        if (stage === 'setup') {
          await assert.rejects(submitTransaction(review), /signature witness/);
          assert.throws(() => store.read(scope, stageHashes), /reservation/);
        } else {
          const next = await operate('next-stage', sessionId);
          assert.equal(next.stage, stage);
          assert.deepEqual(next.transaction, cccA.JsonRpcTransformers.transactionFrom(review));
        }
        const submit = () => submitTransaction(signed);
        if(role===0&&stage==='setup'){
          await assert.rejects(submit(),/loss before node/);
          const renewed=await operate('pending-review',sessionId);
          assert.equal(ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(renewed.transaction)).hash(),signed.hash());
          await operate('resubmit',{...sessionId,stage,signed:cccA.JsonRpcTransformers.transactionFrom(signed)});
          restart.beforeNode={stage,immutableHash:signed.hash(),renewedIdenticalReview:true,unrelatedReplacement:false};
        } else if (restartHere) await assert.rejects(submit(), /lost acknowledgement/);
        else await submit();
        store.close();
        store = openSharedLaunchStore(dbPath);
        assert.throws(() => store.recordSubmission(scope, stageHashes, stage), /requires reconciliation/);
        if (restartHere) {
          const purchaseHash = outputs[0].outPoint.txHash;
          restart.transactionsBefore = await Promise.all([results[0].trade, purchaseHash].map(hash => canonicalReceipt(rpc, hash)));
          const pending = store.read(scope, stageHashes);
          await restartNode(restart);
          assert.equal(restart.after.genesis, genesis);
          restart.transactionsAfter = await Promise.all([results[0].trade, purchaseHash].map(hash => canonicalReceipt(rpc, hash)));
          assert.deepEqual(restart.transactionsAfter, restart.transactionsBefore);
          assert.equal(store.read(scope, stageHashes), pending);
          const application=await startSharedMarketApp({genesis,fixture,out,dbPath});
          try{
            const before=await application.request('/api/v2/launch/session',sessionId);
            await application.restart();
            const after=await application.request('/api/v2/launch/session',sessionId);
            assert.deepEqual(after,before);
            assert.equal(after.entries.at(-1).state,'submitted');
            restart.application={pendingPreserved:true,processes:application.processes,timings:application.timings};
          }finally{await application.stop();}
          restart.pending = JSON.parse(pending).entries.at(-1);
          assert.deepEqual(restart.pending, {stage, txHash: purchaseHash, state: 'submitted'});
          assert.throws(() => store.reserve(scope, stageHashes), /already reserved/);
          assert.throws(() => store.recordSubmission(scope, stageHashes, stage), /requires reconciliation/);
        }
        plan = await recoverSharedLaunch(rpc, store, scope, stageHashes);
        const receipt = await operate('reconcile', sessionId);
        if (restartHere) {
          restart.confirmed = JSON.parse(store.read(scope, stageHashes)).entries.at(-1);
          assert.equal(restart.confirmed.state, 'confirmed');
          assert.equal(restart.confirmed.txHash, restart.pending.txHash);
          assert.equal(restart.confirmed.blockHash, restart.transactionsAfter[1].blockHash);
          assert.throws(() => store.confirm(scope, stageHashes, receipt), /pending launch stage/);
          restart.duplicateConfirmationRejected = true;
        }
        if (stage === 'setup') {
          setup = outputs;
        } else if (stage === 'issuance') issuance = outputs;
        else purchase = outputs;
      }
      const metadata={name:`Native Token ${role}`,ticker:`NT${role}`,description:'Isolated native acceptance',link:''};
      const signature=await signMetadata(role,launchMetadataMessage(scope,metadata));
      const publish=launchOperations({rpc,genesis,fixture,quantity:7n,proof:()=>{throw Error('Publication must not regenerate proof');},openStore:()=>openSharedLaunchStore(dbPath)});
      await publish('publish',{owner:scope.owner,market:scope.market,metadata,signature});
      assert(store.isPublished(scope,stageHashes));
      const continuation = makeProof(domain, 1, [leaf], [{...leaf, balance:8n, revision:1n}]);
      const inputs = [...purchase.slice(0,4), setup[2]];
      const {amount, ...trade} = buildTransition({curve:decodeCurve(identity.market.args,purchase[0].data), cells:inputs,
        custodyAmount:7n, newRoot:continuation.root, witness:continuation.witness, fee:fundingFee, side:'buy', quantity:1n});
      const next = await commit(`wo3b-creator-${role}-buy`, sign({
        ...trade, version:'0x0', cellDeps:legacy(plan.projected.purchase).cellDeps, headerDeps:[genesis],
      }, inputs, [role]));
      assert.equal(next[0].capacity - purchase[0].capacity, amount);
      const initial = [issuance[0].outPoint, issuance[1].outPoint].map(point);
      runtimeMarkets.push({plan,identity,domain,leaf:{...leaf,balance:8n,revision:1n},cells:next});
      results.push({scope, stageHashes, initial, trade:next[0].outPoint.txHash, root:continuation.root,
        custodyLock:identity.custody.hash(), token:identity.token.hash(), accounting:plan.accounting});
      await waitForIndexer(rpc);
      const recoveredMarkets = [];
      for (const result of results) {
        const recovered = await recoverMarketHistory(rpc, result.initial, {maxIndexedDepth:16});
        assert(recovered.pair.every(output => output.tx_hash === result.trade));
        assert.equal(recovered.lineage.length, 3);
        const final = recovered.lineage.at(-1).transaction;
        assert.equal(final.hash, result.trade);
        assert.equal(ccc.Script.from(camel(final.outputs[0].lock)).hash(), result.scope.market);
        const custody = await discoverCustodyPair(rpc, {tx_hash: result.trade, index: '0x2'});
        assert.deepEqual(custody, ['0x2', '0x3'].map(index => ({tx_hash: result.trade, index})));
        const live = await rpc('get_live_cell', [custody[0], true]);
        assert.equal(live.status, 'live');
        assert.equal(live.cell.data.content, final.outputs_data[2]);
        assert.equal(ccc.Script.from(camel(live.cell.output.lock)).hash(), result.custodyLock);
        assert.equal(ccc.Script.from(camel(live.cell.output.type)).hash(), result.token);
        const root = '0x' + live.cell.data.content.slice(34);
        assert.equal(root, result.root);
        recoveredMarkets.push({market: result.scope.market, trade: result.trade, pair: recovered.pair, custody, root});
      }
      if (role === 1) restart.recoveredMarkets = recoveredMarkets;
    }
    application=await startSharedMarketApp({genesis,fixture,out,dbPath});
    const catalog=await application.request('/api/markets/catalog');
    assert.equal(catalog.markets.length,2);
    await application.legacyLaunchAcceptance(catalog.markets,{rpc});
    const browser=await application.browserAcceptance(catalog.markets);
    writeFileSync(join(out,'browser-acceptance.json'),JSON.stringify(browser,null,2));
    globalThis.fetch=async(url,options)=>{
      if(typeof url!=='string'||!url.startsWith('/'))return originalFetch(url,options);
      const headers=new Headers(options?.headers);headers.set('origin',application.base);headers.set('host','127.0.0.1:3143');headers.set('sec-fetch-site','same-origin');
      const start=performance.now();
      const response=await originalFetch(application.base+url,{...options,headers});
      application.timings.push({path:url,status:response.status,ms:Math.round(performance.now()-start)});
      return response;
    };
    // One independent disposable trader crosses both native markets.
    let funding=funded[4];
    const trader=ccc.Script.from(locks[2]).hash();
    const lifecycle=[];
    for(const [index,market] of runtimeMarkets.entries()){
      const {plan,domain,leaf}=market;
      let cells=market.cells;
      const warmReadStarted=performance.now();
      const marketData=await application.request('/api/markets/'+plan.scope.market);
      application.timings.push({phase:'warm-read',market:plan.scope.market,ms:Math.round(performance.now()-warmReadStarted)});
      assert.equal(marketData.historyState,'verified');
      const wallet=ccc.Script.from(locks[2]);
      const hint=()=>({txHash:funding.outPoint.txHash,index:funding.outPoint.index,owner:trader,genesis});
      let holder={owner:trader,balance:2n,revision:1n};
      const buy=makeProof(domain,1,[leaf],[holder]);
      let inputs=[...cells.slice(0,4),funding];
      let curve=decodeCurve(market.identity.market.args,cells[0].data);
      const {amount:buyAmount,...buyTx}=buildTransition({curve,cells:inputs,custodyAmount:8n,newRoot:buy.root,witness:buy.witness,fee:fundingFee,side:'buy',quantity:2n});
      const coldProofStarted=performance.now();
      const [buyReview,competingReview]=await Promise.all([
        prepareLocalReview(rpc,marketData.manifest,trader,'buy',2n,wallet,undefined,hint(),buyAmount),
        prepareLocalReview(rpc,marketData.manifest,trader,'buy',1n,wallet,undefined,hint(),quote(curve,'buy',1n)),
      ]);
      application.timings.push({phase:'cold-concurrent-proof',market:plan.scope.market,requests:2,ms:Math.round(performance.now()-coldProofStarted)});
      const warmProofStarted=performance.now();
      const warmProof=await application.request('/api/v2/pudge-proof',{manifest:marketData.manifest,owner:trader,side:'buy',quantity:'2'});
      assert.equal(warmProof.proof.old_root,buyReview.live.custodyRoot);
      application.timings.push({phase:'warm-proof',market:plan.scope.market,ms:Math.round(performance.now()-warmProofStarted)});
      assert.equal(buyReview.transaction.outputsData[2].slice(34),buy.root.slice(2));
      cells=await commit(`integrated-trader-${index}-buy`,sign(legacy(buyReview.transaction),buyReview.inputs,[2]));
      const competingSigned=ccc.Transaction.from(sign(legacy(competingReview.transaction),competingReview.inputs,[2]));
      await assert.rejects(()=>rpc('estimate_cycles',[cccA.JsonRpcTransformers.transactionFrom(competingSigned)]));
      const buyHash=cells[0].outPoint.txHash;
      funding=cells[4];curve=decodeCurve(market.identity.market.args,cells[0].data);
      const payout=quote(curve,'sell',1n),remaining={...holder,balance:1n,revision:2n};
      const sell=makeProof(domain,4,[leaf,holder],[remaining],Buffer.concat([le(1n),le(payout)]));
      inputs=[...cells.slice(0,4),funding];
      const {amount:sellAmount,...sellTx}=buildTransition({curve,cells:inputs,custodyAmount:10n,newRoot:sell.root,witness:sell.witness,fee:fundingFee,side:'sell',quantity:1n});
      const sellReview=await prepareLocalReview(rpc,marketData.manifest,trader,'sell',1n,wallet,undefined,hint(),sellAmount);
      assert.equal(sellReview.transaction.outputsData[2].slice(34),sell.root.slice(2));
      const conflictingPayout=sellReview.transaction.clone();
      conflictingPayout.outputs[0].capacity-=1n;conflictingPayout.outputs[4].capacity+=1n;
      const conflictingSigned=ccc.Transaction.from(sign(legacy(conflictingPayout),sellReview.inputs,[2]));
      await assert.rejects(()=>rpc('estimate_cycles',[cccA.JsonRpcTransformers.transactionFrom(conflictingSigned)]));
      cells=await commit(`integrated-trader-${index}-sell`,sign(legacy(sellReview.transaction),sellReview.inputs,[2]));
      funding=cells[4];
      const marketPoints=cells.slice(0,2).map(cell=>point(cell.outPoint));
      const withdrawn={...remaining,balance:0n,revision:3n};
      const withdrawal=makeProof(domain,5,[leaf,remaining],[withdrawn]);
      const withdrawalInputs=[cells[2],cells[3],funding];
      const reviewed=await prepareWithdrawal(rpc,marketData.manifest,trader,1n,wallet,hint());
      assert.equal(reviewed.transaction.outputsData[0].slice(34),withdrawal.root.slice(2));
      const outside=await commit(`integrated-trader-${index}-withdrawal`,sign(legacy(reviewed.transaction),reviewed.inputs,[2]));
      funding=outside[3];
      await waitForIndexer(rpc);
      const recovered=await recoverMarketHistory(rpc,marketPoints,{maxIndexedDepth:32});
      assert.deepEqual(recovered.pair,marketPoints);
      const custody=(await recoverMarketSuccessors(rpc,cells.slice(2,4).map(cell=>point(cell.outPoint)),{maxIndexedDepth:32})).pair;
      assert.deepEqual(custody,['0x0','0x1'].map(index=>({tx_hash:outside[0].outPoint.txHash,index})));
      assert.equal(outside[0].data.slice(34),withdrawal.root.slice(2));
      assert.equal(cells[0].capacity-plan.projected.issuance.outputs[0].capacity,quote({base:10n*unit,step:unit,supply:2000n,inventory:2000n},'buy',9n));
      const finalData=await application.request('/api/markets/'+plan.scope.market);
      assert.equal(finalData.custody,'8');assert.equal(finalData.inventory,'1991');assert.equal(finalData.historyState,'verified');
      const balance=await application.request('/api/v2/pudge-proof',{manifest:finalData.manifest,owner:trader,side:'balance'});
      assert.equal(balance.balance,'0');assert.equal(balance.root,withdrawal.root);
      lifecycle.push({market:plan.scope.market,buy:await canonicalReceipt(rpc,buyHash),sell:await canonicalReceipt(rpc,cells[0].outPoint.txHash),withdrawal:await canonicalReceipt(rpc,outside[0].outPoint.txHash),marketPoints,custody,buyAmount:String(buyAmount),sellAmount:String(sellAmount)});
    }
    writeFileSync(join(out,'isolated-app-config.json'),JSON.stringify({genesis,fixture,endpoint:'http://127.0.0.1:19224/'}));
    const security=await application.securityAcceptance(catalog.markets);
    writeFileSync(join(out,'security-acceptance.json'),JSON.stringify(security,null,2));
    const beforeRestart=await application.request('/api/markets/catalog');
    await application.restart();
    assert.deepEqual(await application.request('/api/markets/catalog'),beforeRestart);
    for(const market of runtimeMarkets)assert.equal((await application.request('/api/markets/'+market.plan.scope.market)).historyState,'verified');
    const orphanedReceipt=lifecycle[1].withdrawal;
    const orphanHeader=await rpc('get_header',[orphanedReceipt.blockHash]);
    await rpc('truncate',[orphanHeader.parent_hash]);
    // Produce a genuine replacement branch, excluding the detached transaction.
    for(let block=0;block<2;block++){
      const template=await rpc('get_block_template',[]);
      template.transactions=[];template.proposals=[];template.uncles=[];
      const minimum=BigInt(orphanHeader.timestamp)+BigInt(block+1);
      if(BigInt(template.current_time)<minimum)template.current_time='0x'+minimum.toString(16);
      await rpc('generate_block_with_template',[template]);
    }
    await waitForIndexer(rpc);
    await assert.rejects(()=>canonicalReceipt(rpc,orphanedReceipt.hash));
    const reorgMarket=await application.request('/api/markets/'+runtimeMarkets[1].plan.scope.market);
    assert.equal(reorgMarket.custody,'9');
    const reorgBalance=await application.request('/api/v2/pudge-proof',{manifest:reorgMarket.manifest,owner:trader,side:'balance'});
    assert.equal(reorgBalance.balance,'1');assert.equal(reorgBalance.root,reorgMarket.custodyRoot);
    const renewed=await prepareWithdrawal(rpc,reorgMarket.manifest,trader,1n,ccc.Script.from(locks[2]));
    assert.equal(renewed.transaction.hash(),orphanedReceipt.hash);
    const detachedStatus=(await rpc('get_transaction',[orphanedReceipt.hash]))?.tx_status?.status;
    if(['pending','proposed'].includes(detachedStatus)){
      for(let block=0;block<20;block++){if((await rpc('get_transaction',[orphanedReceipt.hash])).tx_status.status==='committed')break;await rpc('generate_block');}
    }else await commit('reorg-reapproved-identical-withdrawal',sign(legacy(renewed.transaction),renewed.inputs,[2]));
    await waitForIndexer(rpc);
    lifecycle[1].withdrawal=await canonicalReceipt(rpc,renewed.transaction.hash());
    assert.equal((await application.request('/api/markets/'+runtimeMarkets[1].plan.scope.market)).custody,'8');
    writeFileSync(join(out,'reorg-acceptance.json'),JSON.stringify({orphanedReceipt,reconciledBalance:reorgBalance.balance,renewedIdenticalHash:renewed.transaction.hash(),restoredReceipt:lifecycle[1].withdrawal},null,2));
    const walletUI=await application.walletAcceptance([...catalog.markets].sort((a,b)=>a.metadata.ticker.localeCompare(b.metadata.ticker)),{connect:connectBrowserWallet,rpc,receipt:canonicalReceipt,indexed:waitForIndexer,owner:trader});
    writeFileSync(join(out,'browser-wallet-acceptance.json'),JSON.stringify(walletUI,null,2));
    const concurrentStates=await Promise.all(runtimeMarkets.map(market=>application.request('/api/markets/'+market.plan.scope.market)));
    const concurrentStarted=performance.now();
    const concurrentProofs=await Promise.all(concurrentStates.map(state=>application.request('/api/v2/pudge-proof',{manifest:state.manifest,owner:trader,side:'buy',quantity:'1'})));
    for(const [index,proof]of concurrentProofs.entries()){
      assert.equal(proof.market,concurrentStates[index].identity);assert.equal(proof.token,concurrentStates[index].token.typeHash);assert.equal(proof.proof.old_root,concurrentStates[index].custodyRoot);
    }
    writeFileSync(join(out,'concurrent-market-proofs.json'),JSON.stringify({ms:Math.round(performance.now()-concurrentStarted),markets:concurrentProofs.map(proof=>({market:proof.market,token:proof.token,root:proof.proof.old_root,points:proof.points}))},null,2));
    // Separate independent exit: stop the application and reconstruct from L1 only.
    await application.stop();
    const independent=runtimeMarkets[0],owner=independent.plan.scope.owner;
    const collector=fileURLToPath(new URL('../lib/v2-engine/pudge-recover.cjs',import.meta.url));
    const verifier=fileURLToPath(new URL('../../../labs/trade-v2-token/gate2/browser-proof/target/debug/trade-v2-recovery',import.meta.url));
    const custodyScript=join(out,'independent-custody.json'),tokenScript=join(out,'independent-token.json'),bundleFile=join(out,'independent-bundle.json');
    writeFileSync(custodyScript,JSON.stringify(cccA.JsonRpcTransformers.scriptFrom(independent.identity.custody)));
    writeFileSync(tokenScript,JSON.stringify(cccA.JsonRpcTransformers.scriptFrom(independent.identity.token)));
    execFileSync(process.execPath,[collector,'collect','--node','http://127.0.0.1:19224/','--indexer','http://127.0.0.1:19224/','--init',independent.plan.stageHashes.purchase,'--owner',owner,'--custody-lock',custodyScript,'--xudt-type',tokenScript,'--max-pages','32','--max-transactions','512','--out',bundleFile],{timeout:60_000,env:{...process.env,ROVEKO_PROOF_BINARY:verifier},maxBuffer:8*1024*1024});
    const independentProof=JSON.parse(execFileSync(verifier,['transition',bundleFile,'withdraw','1'],{encoding:'utf8',timeout:40_000,maxBuffer:8*1024*1024}));
    const currentCustody=(await recoverMarketSuccessors(rpc,lifecycle[0].custody,{maxIndexedDepth:32})).pair;
    const liveInputs=await Promise.all([...currentCustody,point(independent.cells[4].outPoint)].map(async point=>{
      const row=await rpc('get_live_cell',[point,true]);assert.equal(row.status,'live');
      return {outPoint:{txHash:point.tx_hash,index:point.index},capacity:BigInt(row.cell.output.capacity),lock:cccA.JsonRpcTransformers.scriptTo(row.cell.output.lock),type:row.cell.output.type?cccA.JsonRpcTransformers.scriptTo(row.cell.output.type):undefined,data:row.cell.data.content};
    }));
    const exit=buildWithdrawal(liveInputs,1n,independentProof.new_root,independentProof.witness,fundingFee,independent.plan.projected.purchase.cellDeps,genesis,owner);
    const exited=await commit('independent-chain-only-withdrawal',sign(legacy(exit.transaction),liveInputs,[0]));
    const independentReceipt=await canonicalReceipt(rpc,exited[0].outPoint.txHash);
    await waitForIndexer(rpc);await application.restart();
    const independentRecovered=await application.request('/api/markets/'+independent.plan.scope.market);
    assert.equal(independentRecovered.custody,'7');assert.equal(independentRecovered.inventory,'1991');assert.equal(independentRecovered.custodyRoot,independentProof.new_root);
    writeFileSync(join(out,'independent-exit.json'),JSON.stringify({applicationOfflineDuringExit:true,proofSource:'canonical CKB RPC plus native collector/verifier; no hosted proof request',receipt:independentReceipt,custody:independentRecovered.custody,root:independentRecovered.custodyRoot},null,2));
    writeFileSync(join(out,'application-processes.json'),JSON.stringify(application.processes,null,2));
    writeFileSync(join(out,'application-timings.json'),JSON.stringify(application.timings,null,2));
    writeFileSync(join(out,'integrated-native-lifecycle.json'),JSON.stringify({genesis,trader,lifecycle},null,2));
    assert.notEqual(results[0].scope.market, results[1].scope.market);
    assert.notEqual(results[0].token, results[1].token);
    assert.notEqual(results[0].custodyLock, results[1].custodyLock);
    assert.notEqual(results[0].root, results[1].root);
    writeFileSync(join(out,'shared-launch-summary.json'), JSON.stringify({genesis,fixture,results},
      (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    console.log('Shared launch evidence', out);
  } catch (error) {
    restart.errors.push(error.stack, ...(error.cause ? [String(error.cause)] : []));
    throw error;
  } finally {
    globalThis.fetch=originalFetch;
    if(application)await application.stop();
    writeFileSync(join(out, 'shared-launch-restart.json'), JSON.stringify(restart, null, 2));
    store.close();
  }
}
