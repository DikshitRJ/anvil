const path = require('node:path');
const Mocha = require('mocha');
const { glob } = require('node:fs/promises');

async function run() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30000 });
  const dir = __dirname;
  for await (const file of glob('**/*.test.js', { cwd: dir })) {
    mocha.addFile(path.resolve(dir, file));
  }
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve()));
  });
}

module.exports = { run };
