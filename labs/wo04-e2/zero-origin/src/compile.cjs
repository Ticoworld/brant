const fs=require('fs'),path=require('path'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),solc=require('../../../wo04-e1/node_modules/solc');
if(!solc.version().startsWith('0.8.30+commit.73712a01'))throw Error('unpinned solc');
const input={language:'Solidity',sources:{'OutcomesV2.sol':{content:fs.readFileSync(R+'/contracts/OutcomesV2.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','storageLayout']}}}};
const out=JSON.parse(solc.compile(JSON.stringify(input)));if(out.errors?.some(x=>x.severity==='error'))throw Error(JSON.stringify(out.errors));
fs.mkdirSync(R+'/build',{recursive:true});const record={compiler:solc.version(),input,contracts:out.contracts['OutcomesV2.sol']};fs.writeFileSync(R+'/build/evm.json',JSON.stringify(record,null,2)+'\n');fs.writeFileSync(R+'/evidence/solidity.json',JSON.stringify(record,null,2)+'\n');
