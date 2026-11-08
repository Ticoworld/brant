import {localRequest} from '../../../lib/r7-local-request';
import {pudgeDeploymentService} from '../../../lib/pudge-deployment-service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try{return Response.json(await pudgeDeploymentService.review())}catch(e){return Response.json({error:e instanceof Error?e.message:'Review unavailable'},{status:503})}
}
export async function POST(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||process.env.PUDGE_R7_BROADCAST_ENABLED!=='1'||!localRequest(req)||!req.headers.get('origin')||req.headers.get('content-type')!=='application/json')return new Response('Disabled',{status:403});
 try{return Response.json(await pudgeDeploymentService.broadcast(await req.text()))}catch(e){return Response.json({error:e instanceof Error?e.message:'Submission outcome unknown'},{status:400})}
}
