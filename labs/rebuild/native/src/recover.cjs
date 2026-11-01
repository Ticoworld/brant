// Fixture-only signing worker for trusted self-created packages.
// No ancestry, live-cell, intended-payout or arbitrary-order authentication.
// Successful private-chain recovery is not forged-lineage security (upstream LO-01 unresolved).
const C=require('./lib.cjs');const pkg=JSON.parse(C.fs.readFileSync(process.argv[2]));
const signGroup=require(C.path.join(C.path.dirname(require.resolve('@nervosnetwork/ckb-sdk-core')),'signWitnessGroup.js')).default;
const t=pkg.tx,indices=pkg.inputs.map((c,i)=>C.U.scriptToHash(c.lock)===C.U.scriptToHash(C.locks[pkg.role])?i:-1).filter(i=>i>=0);
if(!indices.length)throw Error('No owner input');
const group=[{lock:'',inputType:'',outputType:''},...indices.slice(1).map(i=>t.witnesses[i]),...t.witnesses.slice(pkg.inputs.length)];
t.witnesses[indices[0]]=signGroup(C.keys[pkg.role],C.U.rawTransactionToHash(t),group)[0];
process.stdout.write(JSON.stringify(t));
