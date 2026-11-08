import {localRequest} from '../../../../lib/r7-local-request';
import {pudgeDeploymentService} from '../../../../lib/pudge-deployment-service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try{const {hash}=await req.json();if(typeof hash!=='string')throw Error('Invalid hash');return Response.json(await pudgeDeploymentService.verify(hash))}catch(e){return Response.json({error:e instanceof Error?e.message:'Verification failed'},{status:400})}
}
