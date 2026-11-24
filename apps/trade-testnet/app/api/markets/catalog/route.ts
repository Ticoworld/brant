import {listCatalog, marketHash} from '../../../../lib/v2-engine/shared-market-catalog';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const after = new URL(request.url).searchParams.get('after') ?? '';
  if (after && !marketHash.test(after)) return Response.json({error: 'Invalid cursor'}, {status: 400});
  try {
    return Response.json(await listCatalog(after), {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return Response.json({error: 'Market catalog unavailable'}, {status: 503});
  }
}
