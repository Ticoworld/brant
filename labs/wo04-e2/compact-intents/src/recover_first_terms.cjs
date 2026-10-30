// Bounded reconstruction of the early development attempt's preimage from its
// known immutable deployment and creation-time block metadata, verified by SHA256.
// This does not recover arbitrary lost commitments and sends no EVM transaction.
const fs=require('fs'),path=require('path'),cp=require('child_process'),ethers=require('../../../wo04-e1/node_modules/ethers'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),j=JSON.parse(fs.readFileSync(R+'/evidence/chain-live-01.json')),a=JSON.parse(fs.readFileSync(R+'/build/evm.json'));
const ip=JSON.parse(cp.execFileSync('docker',['inspect','e2c-el']))[0].NetworkSettings.Networks['e2c-private'].IPAddress;if(!ip.startsWith('172.18.'))throw Error('private network');const provider=new ethers.JsonRpcProvider('http://'+ip+':8545');
const H=b=>crypto.createHash('sha256').update(b).digest(),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},normal=k=>({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey('0x'+'0'.repeat(63)+k),'hex')});
(async()=>{
 const dep=j.evm.find(e=>e.name==='deploy-OutcomesV3'),token=j.evm.find(e=>e.name==='deploy-ControlledUSDC').receipt.contractAddress,c=new ethers.Contract(dep.receipt.contractAddress,a.contracts.OutcomesV3.abi,provider),fund=j.transactions.find(r=>r.name==='USER-FUND-filled-A-identical-B'),target=fund.tx.outputs[0].lock.args;
 const mnemonic='sleep moment list remain like wall lake industry canvas wonder ecology elite duck salad naive syrup frame brass utility club odor country obey pudding',address=i=>ethers.HDNodeWallet.fromPhrase(mnemonic,undefined,"m/44'/60'/0'/0/"+i).address;
 const gen=await c.ETH_GENESIS(),registry=await c.REGISTRY(),ckb=await c.CKB_GENESIS(),code=ethers.keccak256(await provider.getCode(c.target));
 const approval=j.evm.find(e=>e.name==='maker-amortizable-approval').receipt.blockNumber;
 for(let block=approval;block<approval+16;block++){
  const b=await provider.send('eth_getBlockByNumber',['0x'+block.toString(16),false]);if(!b)break;
  const order={ethGenesis:gen,registry,ckbGenesis:ckb,fundingId:ethers.ZeroHash,ckbMaker:U.scriptToHash(normal('5')),ckbRefund:U.scriptToHash(normal('4')),asset:token,amount:'100000000',recipient:address(7),maker:address(1),deadline:Number(BigInt(b.timestamp))+120,ckbAmount:'10000000000'};
  const encoded=ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256','address','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','address','uint256','address','address','uint64','uint64'],[ethers.sha256(ethers.toUtf8Bytes('CKB-E2D-P1-ORDER-V1')),1337,c.target,...Object.values(order)]);
  const terms=Buffer.concat([Buffer.from(encoded.slice(2),'hex'),Buffer.from(code.slice(2),'hex'),le(1),le(block),le(1000000)]);
  if('0x'+H(terms).toString('hex')===target){fs.writeFileSync(R+'/evidence/first-attempt-recovered-terms.json',JSON.stringify({order,terms:'0x'+terms.toString('hex'),commitment:target,actualFundedOutPoints:[{txHash:fund.hash,index:'0x0'},{txHash:fund.hash,index:'0x1'}],matchedExactOnChainCommitment:true,source:'Bounded search of16 known creation-time block candidates; not a general recovery method; later driver persists before broadcast'},null,2)+'\n');console.log('Early attempt preimage recovered and verified');return;}
 }throw Error('not recovered; do not fabricate terms');
})().catch(e=>{console.error(e);process.exitCode=1;});
