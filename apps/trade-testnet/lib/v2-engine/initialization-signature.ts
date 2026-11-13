import {ccc} from '@ckb-ccc/core';
type Input={lock:ccc.ScriptLike};
/** Verify a standard-secp wallet signature and preserve every reviewed witness
 * outside that wallet's first witness. Does not attest live state or finality. */
export function verifyInitializationSignature(reviewed:ccc.Transaction,signed:ccc.Transaction,inputs:Input[],signerIndex:number,ownerLockHash:string){
 if(inputs.length!==reviewed.inputs.length||!Number.isSafeInteger(signerIndex)||signerIndex<0||signerIndex>=inputs.length||!/^0x[0-9a-f]{64}$/i.test(ownerLockHash)||signed.hash()!==reviewed.hash()||signed.witnesses.length!==reviewed.witnesses.length)throw Error('Wallet changed reviewed transaction');
 const owner=ccc.Script.from(inputs[signerIndex].lock);
 if(owner.hash().toLowerCase()!==ownerLockHash.toLowerCase()||owner.codeHash.toLowerCase()!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||owner.hashType!=='type'||owner.args.length!==42)throw Error('Unsupported or changed wallet');
 const group=inputs.map((c,i)=>ccc.Script.from(c.lock).hash().toLowerCase()===ownerLockHash.toLowerCase()?i:-1).filter(i=>i>=0);
 if(group[0]!==signerIndex||signed.witnesses.some((w,i)=>i!==signerIndex&&w.toLowerCase()!==reviewed.witnesses[i].toLowerCase()))throw Error('Wallet changed reviewed witnesses');
 const witness=signed.getWitnessArgs(signerIndex);
 if(!witness?.lock||ccc.bytesFrom(witness.lock).length!==65||witness.inputType||witness.outputType)throw Error('Invalid standard-secp signature witness');
 const hasher=new ccc.HasherCkb();hasher.update(reviewed.hash());
 ccc.Transaction.hashWitnessToHasher(ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex(),hasher);
 for(const i of group.slice(1))ccc.Transaction.hashWitnessToHasher(signed.witnesses[i]||'0x',hasher);
 for(const witness of signed.witnesses.slice(inputs.length))ccc.Transaction.hashWitnessToHasher(witness,hasher);
 const digest=hasher.digest(),pub=ccc.recoverMessageSecp256k1(digest,witness.lock);
 if(ccc.hashCkbShort(pub).toLowerCase()!==owner.args.toLowerCase()||!ccc.verifyMessageSecp256k1(digest,witness.lock,pub))throw Error('Signature does not match reviewed wallet');
 return true;
}
