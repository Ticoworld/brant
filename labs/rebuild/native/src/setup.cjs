const C=require('./lib.cjs'),{execFileSync}=require('child_process');
const dir=process.argv[2];if(C.fs.existsSync(dir))throw Error('Fresh chain directory required');
const bin=process.env.CKB_BIN||C.path.resolve(C.ROOT,'../../wo04-e1/tools/ckb/ckb');
execFileSync(bin,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);
let spec=C.fs.readFileSync(dir+'/specs/dev.toml','utf8'),extra='';
for(const name of ['limit_order','xudt','ickb_logic','owned_owner']){C.fs.copyFileSync(C.ROOT+'/vendor/ickb/build/release/'+name,dir+'/'+name);extra+=`[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n`;}
spec=spec.replace('[genesis.system_cells_lock]',extra+'\n[genesis.system_cells_lock]');
for(const lock of C.locks)spec=spec.replace('# Burn',`[[genesis.issued_cells]]\ncapacity = 100_000_000_00000000\nlock.code_hash = "${lock.codeHash}"\nlock.hash_type = "type"\nlock.args = "${lock.args}"\n\n# Burn`);
spec=spec.replace(/genesis_epoch_length = \d+/,'genesis_epoch_length = 10').replace(/epoch_duration_target = \d+/,'epoch_duration_target = 80').replace(/permanent_difficulty_in_dummy = \w+/,'permanent_difficulty_in_dummy = true');
C.fs.writeFileSync(dir+'/specs/dev.toml',spec);
let conf=C.fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replace('/ip4/0.0.0.0/tcp/19225','/ip4/127.0.0.1/tcp/19225');
conf+=`\n[block_assembler]\ncode_hash = "${C.locks[0].codeHash}"\nargs = "${C.locks[0].args}"\nhash_type = "type"\nmessage = "0x"\n`;
C.fs.writeFileSync(dir+'/ckb.toml',conf);
