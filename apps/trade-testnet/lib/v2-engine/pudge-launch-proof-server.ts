import {execFile} from 'node:child_process';
import {deriveMarketIdentity} from './initialization.ts';
import {resolveGate2NativeTools} from './native-tools.ts';
import {PUDGE_GATE2_CODES, PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';
import {marketNetwork} from './market-network-server.ts';
const hash = /^0x[0-9a-f]{64}$/i;
function runNative(binary: string, args: string[], payload: object) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(binary, args, {
      encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024, killSignal: 'SIGKILL', windowsHide: true,
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdin?.on('error', () => {});
    child.stdin?.end(JSON.stringify(payload));
  });
}


let activeProofs = 0;
export async function generatePudgeLaunchProof(anchor: {txHash: string; index: string}, owner: string) {
  if (!hash.test(anchor.txHash) || !/^0x[0-9a-f]{1,8}$/i.test(anchor.index) || !hash.test(owner)) throw Error('Invalid proof identity');
  if (activeProofs >= 2) throw Error('Launch proof service busy');
  activeProofs++;
  try { return await generateProof(anchor, owner); }
  finally { activeProofs--; }
}

async function generateProof(anchor: {txHash: string; index: string}, owner: string) {
    const {smt, recovery} = await resolveGate2NativeTools();
    if (!smt || !recovery) throw Error('Proof tools unavailable');

    const network=marketNetwork(),genesis = network.genesis;
    const codes=network.fixture?Object.fromEntries(Object.entries(network.fixture).map(([name,dep])=>[name,dep.dataHash])):PUDGE_GATE2_CODES;
    const id = deriveMarketIdentity({
      anchor, genesis, base: 1_000_000_000n, step: 100_000_000n, supply: 2000n,
      codes: {market:codes.market,marker:codes.marker,owner:codes.ownerLock,custody:codes.custody,custodyMarker:codes.custodyMarker,xudt:codes.xudt},
    });
    const market = id.market.hash();
    const custody = id.custody.hash();
    const domain = {market_script_hash: market, xudt_type_script_hash: id.token.hash(),
      genesis_hash: genesis, custody_marker_type_hash: id.custodyMarker.hash()};
    const quantity = '7';
    const price = 9_100_000_000n;
    const proof = JSON.parse(await runNative(smt, ['proof', '-', '-'], {
      domain, op: 0, owners: [], updates: [{owner_lock_hash: owner, balance: quantity, revision: '0', active: true}],
    }));
    const limit = Buffer.alloc(8);
    limit.writeBigUInt64LE(price);
    const newRoot = proof.new_root;
    const proofWitness = proof.contract_witness?.hex;
    if (typeof newRoot !== 'string' || !hash.test(newRoot) ||
        typeof proofWitness !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(proofWitness)) {
      throw Error('Invalid generated proof');
    }
    const witness = proofWitness + limit.toString('hex');
    const check = JSON.parse(await runNative(recovery, ['verify-init', '-'], {
      domain: id.custody.args, owner, new_root: newRoot, witness, quantity, price: price.toString(),
    }));
    if (check.verified !== true || check.new_root !== newRoot) throw Error('Proof verification failed');

    return {owner, newRoot, witness, genesis, market, custody};

}

/** Same bounded native proof infrastructure, using the atomic planner's domain. */
export async function generateAtomicLaunchProof(domain:{genesis_hash:string;market_script_hash:string;xudt_type_script_hash:string;custody_marker_type_hash:string},owner:string,quantity:bigint,price:bigint){
 if(Object.values(domain).some(v=>!hash.test(v))||!hash.test(owner)||domain.genesis_hash!==marketNetwork().genesis||quantity<=0n||price<=0n||activeProofs>=2)throw Error('Invalid or busy atomic proof request');
 activeProofs++;
 try{
  const {smt,recovery}=await resolveGate2NativeTools();if(!smt||!recovery)throw Error('Proof tools unavailable');
  const proof=JSON.parse(await runNative(smt,['proof','-','-'],{domain,op:0,owners:[],updates:[{owner_lock_hash:owner,balance:String(quantity),revision:'0',active:true}]}));
  if(!hash.test(proof.new_root)||typeof proof.contract_witness?.hex!=='string'||!/^0x(?:[0-9a-f]{2})+$/.test(proof.contract_witness.hex))throw Error('Invalid atomic proof');
  const limit=Buffer.alloc(8);limit.writeBigUInt64LE(price);const witness=proof.contract_witness.hex+limit.toString('hex');
  const args='0x'+[domain.market_script_hash,domain.xudt_type_script_hash,domain.genesis_hash,domain.custody_marker_type_hash].map(v=>v.slice(2)).join('');
  const check=JSON.parse(await runNative(recovery,['verify-init','-'],{domain:args,owner,new_root:proof.new_root,witness,quantity:String(quantity),price:String(price)}));
  if(check.verified!==true||check.new_root!==proof.new_root)throw Error('Atomic proof verification failed');
  return {newRoot:proof.new_root,witness};
 }finally{activeProofs--;}
}
