import Deployment from './review';
export const dynamic='force-dynamic';
export default function Page(){return process.env.PUDGE_R7_DEPLOY_REVIEW==='1'?<Deployment/>:<main>Deployment review disabled.</main>}
