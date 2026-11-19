const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, 'suite/index.js');
  // Open a workspace so activation exercises the full boot path (index, bridge, panel).
  const workspace = path.resolve(__dirname, '../fixtures/mini-flask');
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspace, '--disable-extensions', '--skip-welcome', '--skip-release-notes'],
  });
}

main().catch((err) => {
  console.error('Failed to run VS Code tests', err);
  process.exit(1);
});
