// Run preserved R5 harness against R6 without modifying R5 source or evidence.
const fs=require('fs'),path=require('path'),Module=require('module');
const batch=process.argv.includes('--batch');
const source=path.resolve(__dirname,'../src/'+(batch?'run-batch.cjs':'run.cjs'));
let text=fs.readFileSync(source,'utf8').replace("'../build/merkle_intent'","'../r6/build/merkle_intent'").replaceAll("'../evidence/r5", "'../r6/evidence/r6");
const m=new Module(source,module);m.filename=source;m.paths=Module._nodeModulePaths(path.dirname(source));m._compile(text,source);
