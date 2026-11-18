import {createHmac,timingSafeEqual} from 'node:crypto';

function signature(scope:string,payload:string){
  const key=process.env.ROVEKO_PUDGE_SNAPSHOT_KEY;
  if(!key||!/^[a-f0-9]{64}$/i.test(key))return null;
  return createHmac('sha256',Buffer.from(key,'hex')).update(scope).update('\0').update(payload).digest();
}

export function sealPudgeSnapshot(scope:string,value:unknown){
  const payload=JSON.stringify(value),mac=signature(scope,payload);
  return mac?JSON.stringify({payload,mac:mac.toString('hex')}):null;
}

export function openPudgeSnapshot<T>(scope:string,raw:string):T|null{
  try{
    const {payload,mac}=JSON.parse(raw);
    if(typeof payload!=='string'||typeof mac!=='string'||!/^[a-f0-9]{64}$/.test(mac))return null;
    const expected=signature(scope,payload);
    if(!expected||!timingSafeEqual(expected,Buffer.from(mac,'hex')))return null;
    return JSON.parse(payload) as T;
  }catch{return null;}
}
