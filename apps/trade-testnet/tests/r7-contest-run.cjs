const fs=require('fs'),path=require('path'),Module=require('module');
const source=path.resolve(__dirname,'r7-browser.cjs');
const text=fs.readFileSync(source,'utf8').replace('r7-browser-journey.cjs','r7-browser-contest.cjs').replace("'../r7/evidence/browser-'","'../r7/evidence/contest-'");
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
