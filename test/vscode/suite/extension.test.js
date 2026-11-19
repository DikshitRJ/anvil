const assert = require('node:assert');
const vscode = require('vscode');

const COMMANDS = [
  'anvil.inlineEdit',
  'anvil.cancel',
  'anvil.newChat',
  'anvil.setup',
  'anvil.doctor',
  'anvil.undoLast',
  'anvil.openSession',
  'anvil.focusPanel',
];

suite('Anvil extension', () => {
  test('extension is present and activates', async () => {
    const ext = vscode.extensions.getExtension('anvil-dev.anvil');
    assert.ok(ext);
    await ext.activate();
    assert.ok(ext.isActive);
  });

  test('all contributed commands are registered', async () => {
    const have = await vscode.commands.getCommands(true);
    for (const id of COMMANDS) assert.ok(have.includes(id), `missing command ${id}`);
  });

  test('cancel with nothing running does not throw', async () => {
    await vscode.commands.executeCommand('anvil.cancel');
  });
});
