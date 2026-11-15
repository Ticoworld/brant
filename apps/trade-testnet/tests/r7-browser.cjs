const fs=require('fs'),path=require('path'),Module=require('module');
const source=path.resolve(__dirname,'../../../labs/wo15-merkle-intent/src/run.cjs');
let text=fs.readFileSync(source,'utf8').replace("'../build/merkle_intent'","'../r7/build/merkle_intent'").replace("'../evidence/r5-'","'../r7/evidence/browser-'");
const marker=' const alice=intent(0,0,80n*C.UNIT),before=m.tree.root,old=m.tree.records[2];';
if(!text.includes(marker))throw Error('Fixture source changed');
text=text.slice(0,text.indexOf(marker))+` await require('../../../apps/trade-testnet/tests/r7-browser-journey.cjs')({e,m,C,regular,send});e.close();\n}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();\n`;
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
