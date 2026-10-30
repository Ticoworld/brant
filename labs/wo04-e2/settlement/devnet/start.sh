#!/usr/bin/env bash
set -euo pipefail
# Isolated, disposable, deliberately public devnet fixtures. NEVER public chains.
cd "$(dirname "$0")"
mkdir -p runtime/config runtime/data runtime/keys
GEN=ethpandaops/ethereum-genesis-generator@sha256:b65d64732d3d7e9ba42313522b882033fab0ac75fe4a385671de3acfa4d09915
EL=ethereum/client-go@sha256:f7923f04a33f23e6be427ec527912ff9b7cc49ba9e2290885e3bb83f0c142dba
CL=sigp/lighthouse@sha256:7954b6c3bb0b2e1ec2ba57897c977af8e640c54e648a21e200b70a85d9a88f2f
# Refuse to clobber an existing network/runtime.
[ ! -f runtime/data/custom_config_data/genesis.ssz ]
docker run --rm --network none --entrypoint cat "$GEN" /config/values.env > runtime/config/values.env
python - <<'PY'
from pathlib import Path
import time
p=Path('runtime/config/values.env');s=p.read_text()
s+='\nexport NUMBER_OF_VALIDATORS=64\nexport SLOT_DURATION_IN_SECONDS=3\nexport GENESIS_TIMESTAMP='+str(int(time.time())+180)+'\nexport GENESIS_DELAY=0\nexport CAPELLA_FORK_VERSION=0x03000000\nexport DENEB_FORK_EPOCH=1000000000\n'
p.write_text(s)
PY
docker run --rm --user 1000:1000 --network none -v "$PWD/runtime/config/values.env:/config/values.env:ro" -v "$PWD/runtime/data:/data" "$GEN" all > ../evidence/devnet-genesis.log 2>&1
# Insecure keystores only in ignored isolated runtime, never committed.
docker run --rm --user 1000:1000 --network none -v "$PWD/runtime/config/values.env:/config/values.env:ro" -v "$PWD/runtime/keys:/keys" --entrypoint bash "$GEN" -c 'source /config/values.env; eth2-val-tools keystores --insecure --source-mnemonic "$EL_AND_CL_MNEMONIC" --source-min 0 --source-max 64 --out-loc /keys/assigned' > ../evidence/devnet-keys.log 2>&1
rm -f runtime/data/custom_config_data/bootstrap_nodes.txt runtime/data/custom_config_data/boot_enr.txt
# No external peers or routing. Only local HTTP ports exposed.
docker network create --internal e2c-private >/dev/null
docker run --rm --user 1000:1000 --network none -v "$PWD/runtime/data:/data" "$EL" --datadir /data/geth init /data/custom_config_data/genesis.json > ../evidence/devnet-el-init.log 2>&1
docker run -d --name e2c-el --network e2c-private -p 127.0.0.1:18545:8545 -v "$PWD/runtime/data:/data" "$EL" --datadir /data/geth --networkid 1337 --nodiscover --maxpeers 0 --http --http.addr 0.0.0.0 --http.api eth,net,web3 --http.vhosts '*' --authrpc.addr 0.0.0.0 --authrpc.vhosts '*' --authrpc.jwtsecret /data/jwt/jwtsecret --syncmode full --gcmode archive > ../evidence/devnet-el-container.txt
docker run -d --name e2c-cl --network e2c-private --env NO_PROXY=e2c-el,e2c-cl,localhost,127.0.0.1 -p 127.0.0.1:15052:5052 -v "$PWD/runtime/data:/data" --entrypoint lighthouse "$CL" --testnet-dir /data/custom_config_data bn --datadir /data/lighthouse --disable-discovery --disable-upnp --listen-address 127.0.0.1 --execution-endpoint http://e2c-el:8551 --execution-jwt /data/jwt/jwtsecret --http --http-address 0.0.0.0 --http-allow-sync-stalled --light-client-server --subscribe-all-subnets --import-all-attestations --eth1 --suggested-fee-recipient 0x0000000000000000000000000000000000000001 > ../evidence/devnet-cl-container.txt
printf 'Genesis and clients started. Inspect runtime/keys for validator layout.\n'

docker run -d --name e2c-vc --network e2c-private --env NO_PROXY=e2c-el,e2c-cl,localhost,127.0.0.1 -v "$PWD/runtime/data:/data" -v "$PWD/runtime/keys/assigned:/keys" --entrypoint lighthouse "$CL" --testnet-dir /data/custom_config_data vc --validators-dir /keys/keys --secrets-dir /keys/secrets --init-slashing-protection --beacon-nodes http://e2c-cl:5052 --suggested-fee-recipient 0x0000000000000000000000000000000000000001 > ../evidence/devnet-vc-container.txt
