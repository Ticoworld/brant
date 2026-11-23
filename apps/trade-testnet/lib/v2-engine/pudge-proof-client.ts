import {deriveMarketIdentity} from './initialization.ts';
const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const codes={market:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',marker:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',owner:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53',custody:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custodyMarker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
export class InitialProofOriginError extends Error {}
/** Ask the proof service to generate and independently verify the fixed
 * initialization proof, then check its returned domain against this anchor. */
export async function verifyPudgeInitialProof(anchor:{txHash:string;index:string},owner:string){
 if(!/^0x[0-9a-f]{64}$/i.test(owner))throw Error('Invalid proof owner');
 const id=deriveMarketIdentity({anchor,genesis,base:1000000000n,step:100000000n,supply:2000n,codes});
 const response=await fetch('/api/v2/pudge-init-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({anchor,owner}),signal:AbortSignal.timeout(15000)});
 if(response.status===403)throw new InitialProofOriginError('Launch proof origin unavailable');
 if(!response.ok)throw Error('Initial proof verification unavailable');const p=await response.json();
 if(p.genesis!==genesis||p.owner?.toLowerCase()!==owner.toLowerCase()||p.market!==id.market.hash()||p.custody!==id.custody.hash()||!/^0x[0-9a-f]{64}$/i.test(p.newRoot||'')||!/^0x(?:[0-9a-f]{2})+$/i.test(p.witness||''))throw Error('Initial proof identity mismatch');
 return {owner:p.owner as string,newRoot:p.newRoot as string,witness:p.witness as string};
}
