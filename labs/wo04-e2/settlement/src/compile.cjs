const fs=require('fs'),path=require('path'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1'),solc=require(E1+'/node_modules/solc');
if(!solc.version().startsWith('0.8.30+commit.73712a01'))throw Error('unpinned compiler');
const input={language:'Solidity',sources:{'Outcome.sol':{content:fs.readFileSync(E1+'/contracts/Outcome.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','storageLayout']}}}};
const out=JSON.parse(solc.compile(JSON.stringify(input)));if(out.errors?.some(e=>e.severity==='error'))throw Error(JSON.stringify(out.errors));
fs.writeFileSync(R+'/build/evm.json',JSON.stringify({compiler:solc.version(),input,contracts:out.contracts['Outcome.sol']},null,2)+'\n');
fs.writeFileSync(R+'/evidence/solidity.json',JSON.stringify({compiler:solc.version(),sourceSHA256:crypto.createHash('sha256').update(input.sources['Outcome.sol'].content).digest('hex'),input,contracts:out.contracts['Outcome.sol']},null,2)+'\n');
