// Runs against a real pallets/flask 3.1.3 checkout; set FLASK_REPO to enable (CI provides it).
import { describe, expect, it } from 'vitest';
import { assembleContext } from '../../src/core/context/assemble';
import { CodeIndex } from '../../src/core/context/codeIndex';

const TASK_B =
  'Add a new built-in CLI command flask config that prints the loaded application\'s configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.';

describe.skipIf(!process.env.FLASK_REPO)('retrieval on a real Flask checkout', () => {
  it('Task B finds cli.py, test_cli.py and docs/cli.rst; index builds quickly', async () => {
    const index = new CodeIndex(process.env.FLASK_REPO as string);
    const t0 = Date.now();
    await index.build();
    const buildMs = Date.now() - t0;
    const pack = assembleContext(index, { query: TASK_B, mentions: [], openFiles: [], recentFiles: [] }, 12000);

    console.log(`index: ${index.files().length} files in ${buildMs} ms; pack used ${pack.used}/${pack.budget}`);
    for (const i of pack.items)
      console.log(`  ${i.path}:${i.startLine ?? '-'}-${i.endLine ?? '-'} ${i.tokens}t  ${i.reason}`);

    const files = new Set(pack.items.map((i) => i.path));
    for (const f of ['src/flask/cli.py', 'tests/test_cli.py', 'docs/cli.rst']) expect(files).toContain(f);
    expect(pack.used).toBeLessThanOrEqual(12000);
    expect(buildMs).toBeLessThan(5000);
  });
});
