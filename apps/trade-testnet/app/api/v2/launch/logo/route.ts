import {PUDGE_GATE2_GENESIS} from '../../../../../lib/v2-engine/pudge-public-registry';
import {openConfiguredSharedLaunchStore} from '../../../../../lib/v2-engine/shared-launch-store';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const market = new URL(request.url).searchParams.get('market');
  if (!market || !/^0x[0-9a-f]{64}$/.test(market)) return new Response(null, {status: 404});
  try {
    const store = openConfiguredSharedLaunchStore();
    try {
      const logo = store.readLogo(PUDGE_GATE2_GENESIS, market);
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
