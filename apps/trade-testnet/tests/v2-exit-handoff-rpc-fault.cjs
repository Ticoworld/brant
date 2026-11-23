const http=require('node:http');
const upstream=async body=>await (await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).text();
http.createServer(async (req,res)=>{
  try {
    let wire='';
    for await(const chunk of req) wire+=chunk;
    const body=JSON.parse(wire);
    const result=await upstream(body);
    if(body.method==='send_transaction' && JSON.parse(result).result){
      req.socket.destroy();
      for(let i=0;i<4;i++) await upstream({jsonrpc:'2.0',id:1,method:'generate_block',params:[]});
      return;
    }
    res.end(result);
  } catch { if(!res.destroyed) res.destroy(); }
}).listen(19226,'127.0.0.1');
