import {ccc} from "@ckb-ccc/core";
import type {readLiveSingletons} from "./live.ts";
import type {loadPudgeManifest} from "./pudge-manifest.ts";
export function validatePublicJourney(live:Awaited<ReturnType<typeof readLiveSingletons>>,manifest:Awaited<ReturnType<typeof loadPudgeManifest>>,root:string){
 const hash=(v:unknown)=>{const s=v as {code_hash:string;hash_type:ccc.HashType;args:string};return ccc.Script.from({codeHash:s.code_hash,hashType:s.hash_type,args:s.args}).hash();};
 const locks=[manifest.scripts.market,manifest.scripts.market,manifest.scripts.custody,manifest.scripts.custody],types=[manifest.scripts.token,manifest.scripts.marker,manifest.scripts.token,manifest.scripts.custodyMarker];
 if(live.cells.some((cell,i)=>hash(cell.output.lock)!==locks[i].hash()||!cell.output.type||hash(cell.output.type)!==types[i].hash()))throw Error("Market identity changed");
 if(typeof root!=="string"||live.custodyRoot.toLowerCase()!==root.toLowerCase())throw Error("Recovered history is stale");
}
