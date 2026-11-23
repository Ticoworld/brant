const fs = require('node:fs');
const path = require('node:path');
const {webpack} = require('next/dist/compiled/webpack/webpack');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../.next/exit-signer'));
webpack({
  mode: 'production',
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
  console.log(out);
});
