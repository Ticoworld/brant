export function localRequest(req:Request) {
  const host=req.headers.get('host');
  if(!host)return false;
  let target:URL;try{target=new URL('http://'+host);}catch{return false;}
  if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/')return false;
  const origin=req.headers.get('origin');
  return !origin||origin===target.origin;
}
