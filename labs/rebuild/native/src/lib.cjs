const fs=require('fs'),path=require('path'),crypto=require('crypto'),U=require('@nervosnetwork/ckb-sdk-utils');
const ROOT=path.resolve(__dirname,'..'), UNIT=100000000n, fee=1000000n;
const hex=n=>'0x'+BigInt(n).toString(16), b=s=>Buffer.from(s.slice(2),'hex'), hx=b=>'0x'+b.toString('hex');
const le=(n,size=8)=>{let x=BigInt(n),a=Buffer.alloc(size);for(let i=0;i<size;i++){a[i]=Number(x&255n);x>>=8n;}return a;};
const hash=d=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(d).digest('hex');
const normal=k=>({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(k),'hex')});
const keys=[1,2,3].map(n=>'0x'+n.toString(16).padStart(64,'0')); // PUBLIC disposable isolated-chain fixtures
const locks=keys.map(normal);
const snake=x=>x==='depGroup'?'dep_group':Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const camel=x=>Array.isArray(x)?x.map(camel):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camel(v)])):x;
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2));
function orderData(amount,master=null,ratio=[1n,UNIT],reverse=false){return hx(Buffer.concat([le(amount,16),le(master?1:0,4),master?b(master.txHash):Buffer.alloc(32),master?le(master.index,4):le(1,4),...(!reverse?[...ratio,0,0]:[0,0,...ratio]).map(x=>le(x)),Buffer.from([0])]));}
const occupied=c=>BigInt(8+33+(c.lock.args.length-2)/2+(c.type?33+(c.type.args.length-2)/2:0)+(c.data.length-2)/2)*UNIT;
module.exports={occupied,fs,path,crypto,U,ROOT,UNIT,fee,hex,b,hx,le,hash,keys,locks,snake,camel,write,orderData};
