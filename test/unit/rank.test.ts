import { describe, expect, it } from 'vitest';
import { pathPrior } from '../../src/core/context/rank';

describe('pathPrior (#51)', () => {
  it('downweights examples/samples directories', () => {
    expect(pathPrior('examples/celery/app.py')).toBe(0.6);
    expect(pathPrior('docs/example/x.py')).toBe(0.6);
    expect(pathPrior('samples/a.py')).toBe(0.6);
    expect(pathPrior('src/examples_util.py')).toBe(1);
  });

  it('downweights root dotfile configs only', () => {
    expect(pathPrior('.pre-commit-config.yaml')).toBe(0.5);
    expect(pathPrior('.editorconfig')).toBe(0.5);
    expect(pathPrior('src/.editorconfig')).toBe(1);
    expect(pathPrior('src/flask/config.py')).toBe(1);
  });
});
