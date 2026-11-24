import {ccc} from '@ckb-ccc/core';
import {openAtomicLaunchDelivery} from '../../../../../lib/v2-engine/atomic-launch-delivery';
import {marketNetwork} from '../../../../../lib/v2-engine/market-network-server';
import {openConfiguredSharedLaunchStore} from '../../../../../lib/v2-engine/shared-launch-store';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const market = new URL(request.url).searchParams.get('market');
  if (!market || !/^0x[0-9a-f]{64}$/.test(market)) return new Response(null, {status: 404});
  try {
    const store = openConfiguredSharedLaunchStore();
    try {
      let logo = store.readLogo(marketNetwork().genesis, market);
      if(!logo&&process.env.BRANT_LAUNCH_SQLITE_PATH){
        const atomic=openAtomicLaunchDelivery(process.env.BRANT_LAUNCH_SQLITE_PATH,async()=>{throw Error('Image reads cannot query chain');});
        try{const snapshot=atomic.candidate(market);if(snapshot?.genesis===marketNetwork().genesis&&snapshot.logo&&snapshot.logo.length<=100000){
          const bytes=Buffer.from(snapshot.logo,'base64');
          const signed=snapshot.signed as {witnesses?:string[]};const raw=signed?.witnesses?.at(-1);
          const metadata=raw?JSON.parse(new TextDecoder().decode(ccc.bytesFrom(raw))).metadata:undefined;
          if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&ccc.hashCkb(bytes)===metadata?.logoHash)logo=bytes;
        }}finally{atomic.close();}
      }
      if (!logo) return new Response(null, {status: 404});
      return new Response(new Uint8Array(logo), {headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(logo.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=300',
      }});
    } finally {
      store.close();
    }
  } catch {
    return new Response(null, {status: 503});
  }
}
