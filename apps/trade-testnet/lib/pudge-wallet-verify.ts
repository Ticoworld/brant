import {ccc} from '@ckb-ccc/core';
const owner='0x36ef38ed06300fa0f357f1f360b897c476c5c4f9';
export function verifyPudgeWitness(tx:ccc.Transaction,rawHash:string,expectedOwner=owner){
 if(tx.hash()!==rawHash||tx.witnesses.length!==1)throw Error('Wallet changed the reviewed transaction');
 const witness=tx.getWitnessArgs(0);if(!witness?.lock||ccc.bytesFrom(witness.lock).length!==65||witness.inputType||witness.outputType)throw Error('Invalid standard-lock witness');
 const signature=witness.lock;const blank=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
 const h=new ccc.HasherCkb();h.update(rawHash);ccc.Transaction.hashWitnessToHasher(blank,h);const digest=h.digest();
 const pub=ccc.recoverMessageSecp256k1(digest,signature);
 if(ccc.hashCkbShort(pub)!==expectedOwner||!ccc.verifyMessageSecp256k1(digest,signature,pub))throw Error('Witness signature does not match the connected lock');
 return true;
}
