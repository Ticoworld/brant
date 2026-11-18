import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

export function startPudgeProofWorker(binary:string,file:string){
  const child=spawn(binary,['snapshot-worker',file],{stdio:['pipe','pipe','ignore'],windowsHide:true});
  const lines=createInterface({input:child.stdout});
  const replies=lines[Symbol.asyncIterator]();
  const stop=()=>{child.kill();};
  child.on('error',()=>lines.close());
  child.stdin.on('error',stop);
  let timer:ReturnType<typeof setTimeout>;
  async function receive(){
    timer=setTimeout(stop,10_000);
    try{
      const reply=await replies.next();
      if(reply.done)throw Error('Native proof worker exited');
      return reply.value;
    }finally{clearTimeout(timer);}
  }
  const ready=receive().then(line=>{
    if(line!=='ready')throw Error('Native proof worker failed initialization');
  });
  let queue:Promise<unknown>=ready;
  return {
    ready,stop,exited:once(child,'close').catch(()=>{}),
    proof(owner:string,side:string,quantity:string){
      const result=queue.then(async()=>{
        child.stdin.write(JSON.stringify([owner,side,quantity])+'\n');
        const reply=JSON.parse(await receive());
        if(!reply.proof)throw Error('Native proof rejected the transition');
        return reply.proof;
      });
      queue=result.catch(()=>{});
      return result;
    },
  };
}
