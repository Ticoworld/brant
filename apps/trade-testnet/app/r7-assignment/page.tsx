import Assignment from './review';
export const dynamic='force-dynamic';
export default function Page(){return process.env.R7_LOCAL_ENABLED==='1'?<Assignment/>:<main>Private assignment disabled.</main>;}
