const assert = require('node:assert');
const vscode = require('vscode');

suite('Anvil extension', () => {
  test('extension is present', () => {
    assert.ok(vscode.extensions.getExtension('anvil-dev.anvil'));
  });
});
