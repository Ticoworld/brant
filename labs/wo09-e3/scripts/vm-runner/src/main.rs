use ckb_testtool::{context::Context, ckb_jsonrpc_types as j, ckb_types::{prelude::*, packed, bytes::Bytes}};
fn main() {
 let arg=std::env::args().nth(1).unwrap();
 let v:serde_json::Value=serde_json::from_slice(&std::fs::read(arg).unwrap()).unwrap();
 let mut ctx=Context::default();
 for c in v["cells"].as_array().unwrap() {
  let op:j::OutPoint=serde_json::from_value(c["out_point"].clone()).unwrap();
  let output:j::CellOutput=serde_json::from_value(c["output"].clone()).unwrap();
  let data:j::JsonBytes=serde_json::from_value(c["data"].clone()).unwrap();
  ctx.create_cell_with_out_point(op.into(),output.into(),Bytes::from(data.into_bytes()));
 }
 let tx:j::Transaction=serde_json::from_value(v["transaction"].clone()).unwrap();
 let tx:packed::Transaction=tx.into(); let tx=tx.into_view();
 let mut input=0u128; for i in tx.inputs() {
  match ctx.cells.get(&i.previous_output()) {Some((o,_))=> {let n:u64=o.capacity().unpack();input+=n as u128;},None=>{println!("{{\"accepted\":false,\"error\":\"UNKNOWN_INPUT\"}}");return;}}
 }
 let output:u128=tx.outputs().into_iter().map(|o|{let n:u64=o.capacity().unpack();n as u128}).sum();
 if output>input {println!("{{\"accepted\":false,\"error\":\"CAPACITY_CONSERVATION\"}}");return;}
 match ctx.verify_tx(&tx, 500_000_000) {
  Ok(cycles)=>println!("{}",serde_json::json!({"accepted":true,"cycles":cycles,"fee_shannons":(input-output).to_string()})),
  Err(e)=>println!("{}",serde_json::json!({"accepted":false,"error":format!("{:?}",e)})),
 }
}
