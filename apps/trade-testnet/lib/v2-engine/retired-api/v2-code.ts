import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const pinned:Record<string,string>={custody_smt:'7db957901242d6c9243f585b393c55d42faad3c7ddd16f1672c1a19ad14d4601',market_smt:'b33d7396778340c3d6e66c62897a1dbd1561b32848715106a94d8a077bb7cd1f',custody_marker:'cca4552516f372d97377b4e27ebffe1655d4bdeea3535544f36da44ff15aba07',marker_candidate:'5941ccbc5ebd47e59811c4c8d8c8ae8d8f19431770fe771cf12b0e88d7bb5f4f',owner_lineage_candidate:'661820b1d9ce5b384762e5e67389335c04bb2c34aac7bbcb7cb684e9ea13671b'};
export async function GET(){
  const dir=process.env.ROVEKO_GATE2_BINARIES;
  if(!dir) return NextResponse.json({error:'Pinned Gate 2 binary directory not configured'}, {status:503});
  try {
    const codes=await Promise.all(Object.entries(pinned).map(async ([name,sha256])=>{
      const data=await readFile(path.join(dir,name));
      if(createHash('sha256').update(data).digest('hex')!==sha256) throw Error(`Pinned binary mismatch: ${name}`);
      return {name,sha256,data:'0x'+data.toString('hex')};
    }));
    return NextResponse.json({codes},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'Pinned Gate 2 binaries unavailable or mismatched'}, {status:503});}
}
