import { ccc } from '@ckb-ccc/core';
import { cat, le, ZERO } from './market.ts';

export type Position = { owner:ccc.Hex; p:bigint; b:bigint; revision:bigint };
const branch=(a:ccc.Hex,b:ccc.Hex)=>ccc.hashCkb(cat(new Uint8Array([2]),ccc.bytesFrom(a),ccc.bytesFrom(b)));
export const encodePosition=(r:Position)=>cat(ccc.bytesFrom(r.owner),le(r.p),le(r.b),le(r.revision));
export function decodePosition(b:Uint8Array):Position {
  if(b.length!==56) throw Error('Invalid position length');
  const d=new DataView(b.buffer,b.byteOffset,b.byteLength);
  return {owner:ccc.hexFrom(b.slice(0,32)),p:d.getBigUint64(32,true),b:d.getBigUint64(40,true),revision:d.getBigUint64(48,true)};
}
export class PositionTree {
  readonly records:Position[];
  readonly levels:ccc.Hex[][];
  readonly depth:number;
  readonly n:number;
  readonly id:ccc.Hex;
  constructor(n:number,id:ccc.Hex) {
    if(!Number.isSafeInteger(n)||n<1||n>1024||ccc.bytesFrom(id).length!==32) throw Error('Invalid vault tree');
    this.n=n;this.id=id;
    this.depth=Math.ceil(Math.log2(n));
    this.records=Array.from({length:n},()=>({owner:ZERO,p:0n,b:0n,revision:0n}));
    this.levels=[Array(2**this.depth).fill(ZERO)];
    for(let d=0;d<this.depth;d++) this.levels.push(Array(this.levels[d].length/2).fill(branch(this.levels[d][0],this.levels[d][0])));
  }
  get root(){return this.levels[this.depth][0];}
  proof(i:number){if(!Number.isInteger(i)||i<0||i>=this.n)throw Error('Position out of bounds');let j=i;return this.levels.slice(0,-1).map(level=>{const s=level[j^1];j>>=1;return s;});}
  set(i:number,r:Position){this.proof(i);const enc=encodePosition(r);if(enc.length!==56||r.p===0n&&(r.owner!==ZERO||r.b!==0n))throw Error('Invalid position');this.records[i]={...r};let j=i;this.levels[0][j]=r.p===0n&&r.revision===0n?ZERO:ccc.hashCkb(cat(new Uint8Array([1]),ccc.bytesFrom(this.id),le(BigInt(i)),enc));for(let d=0;d<this.depth;d++){j>>=1;this.levels[d+1][j]=branch(this.levels[d][j*2],this.levels[d][j*2+1]);}}
}
