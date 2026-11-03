const C=require('../../rebuild/native/src/lib.cjs');const ZERO='0x'+'00'.repeat(32),empty=()=>({owner:ZERO,p:0n,b:0n});
const encodeLeaf=r=>Buffer.concat([C.b(r.owner),C.le(r.p),C.le(r.b)]);
const decodeLeaf=b=>({owner:C.hx(b.subarray(0,32)),p:b.readBigUInt64LE(32),b:b.readBigUInt64LE(40)});
const branch=(a,b)=>C.hash(Buffer.concat([Buffer.from([2]),C.b(a),C.b(b)]));
function leaf(id,i,r){return r.p===0n?ZERO:C.hash(Buffer.concat([Buffer.from([1]),C.b(id),C.le(i),encodeLeaf(r)]));}
class Tree{
 constructor(n,id){this.n=n;this.id=id;this.depth=Math.ceil(Math.log2(n));this.records=Array.from({length:n},empty);this.levels=[Array(2**this.depth).fill(ZERO)];for(let d=0;d<this.depth;d++)this.levels.push(Array(this.levels[d].length/2).fill(branch(this.levels[d][0],this.levels[d][0])));}
 clone(){const t=Object.create(Tree.prototype);Object.assign(t,this);t.records=this.records.map(r=>({...r}));t.levels=this.levels.map(a=>[...a]);return t;}
 get root(){return this.levels.at(-1)[0];}
 proof(i){let j=i;return this.levels.slice(0,-1).map(a=>{const s=a[j^1];j>>=1;return s;});}
 set(i,r){this.records[i]={...r};let j=i;this.levels[0][j]=leaf(this.id,i,r);for(let d=0;d<this.depth;d++){j>>=1;this.levels[d+1][j]=branch(this.levels[d][2*j],this.levels[d][2*j+1]);}}
}
function metadata(m){return {P:m.tree.records.reduce((s,r)=>s+r.p,0n),B:m.tree.records.reduce((s,r)=>s+r.b,0n),count:m.tree.records.filter(r=>m.phase?r.b>0n:r.p>0n).length};}
function data(m){const t=metadata(m);return C.hx(Buffer.concat([Buffer.from('TCM0001\0'),C.b(m.funder),C.b(m.creator),C.le(m.k),C.le(m.phase),C.le(m.maturity),C.le(t.P),C.le(t.B),C.le(t.count),C.le(m.tree.n),C.b(m.tree.root)]));}
function capacity(m){const t=metadata(m);return m.k+(m.phase?t.B:t.P);}
function update(m,op,changes=[],phase=m.phase){const next={...m,tree:m.tree.clone(),phase};const parts=[C.le(op),C.le(changes.length)];for(const {i,r}of changes){parts.push(C.le(i),encodeLeaf(next.tree.records[i]),encodeLeaf(r),...next.tree.proof(i).map(C.b));next.tree.set(i,r);}return {next,witness:C.hx(Buffer.concat(parts))};}
function proofRoot(id,i,r,proof){let h=leaf(id,i,r),j=i;for(const p of proof){h=(j&1)?branch(p,h):branch(h,p);j>>=1;}return h;}
function chunks(hex){const b=C.b(hex),out=[];for(let i=0;i<b.length;i+=16384)out.push(C.hx(b.subarray(i,i+16384)));return out;}
module.exports={chunks,C,ZERO,empty,Tree,metadata,data,capacity,update,encodeLeaf,decodeLeaf,branch,proofRoot};
