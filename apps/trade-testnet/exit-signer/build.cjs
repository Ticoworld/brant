const fs = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {webpack} = require('next/dist/compiled/webpack/webpack');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../exit-signer-dist'));
webpack({
  mode: 'production',
  context: path.join(__dirname, '..'),
  entry: path.join(__dirname, 'browser.ts'),
  output: {path: out, filename: 'signer.js'},
  module: {rules: [{test: /\.ts$/, use: path.join(__dirname, 'transpile.cjs')}]},
  optimization: {minimize: false},
}, (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({all: false, errors: true}));
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(out, 'index.html'));
  const hashes = ['index.html', 'signer.js'].map(file =>
    createHash('sha256').update(fs.readFileSync(path.join(out, file))).digest('hex') + '  ' + file);
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), hashes.join('\n') + '\n');
  console.log(out);
});
