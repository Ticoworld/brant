const fs=require('fs'),path=require('path'),Module=require('module');
const batch=process.argv.includes('--batch');
const source=path.resolve(__dirname,'../src/'+(batch?'run-batch.cjs':'run.cjs'));
let text=fs.readFileSync(source,'utf8').replace("'../build/merkle_intent'","'../r7-size/build/merkle_intent'").replaceAll("'../evidence/r5", "'../r7-size/evidence/size");
const m=new Module(source,module);m.filename=source;m.paths=Module._nodeModulePaths(path.dirname(source));m._compile(text,source);
