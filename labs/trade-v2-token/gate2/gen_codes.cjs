const fs = require('node:fs');
const path = require('node:path');
const build = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, 'build');
const C = require((process.env.TRADE_NATIVE_ROOT || path.resolve(__dirname, '../../rebuild/native')) + '/src/lib.cjs');
for (const [name, file] of [['custody_code', 'custody_smt'], ['marker_code', 'custody_marker']]) {
  const code = C.b(C.hash(fs.readFileSync(path.join(build, file))));
  process.stdout.write(`static const uint8_t ${name}[32]={${[...code].map(v => `0x${v.toString(16).padStart(2, '0')}`).join(',')}};\n`);
}
