import { describe, expect, it } from 'vitest';
import { extractSymbols } from '../../src/core/context/symbols';

const find = (syms: ReturnType<typeof extractSymbols>, name: string) => syms.find((s) => s.name === name);

describe('extractSymbols: python', () => {
  const src = [
    'import os', // 1
    '', // 2
    '@click.command("routes")', // 3
    'async def top(', // 4
    '    a,', // 5
    ') -> int:', // 6
    '    return 1', // 7
    '', // 8
    'class Group(Base):', // 9
    '    """Doc."""', // 10
    '', // 11
    '    def method(self):', // 12
    '        def inner():', // 13
    '            pass', // 14
    '        return inner', // 15
    '', // 16
    '    # trailing comment', // 17
    'x = 1', // 18
  ].join('\n');
  const syms = extractSymbols('m.py', src);

  it('finds classes, functions, methods and skips nested functions', () => {
    expect(syms.map((s) => s.name)).toEqual(['top', 'Group', 'method']);
    expect(find(syms, 'method')).toMatchObject({ kind: 'method', container: 'Group' });
    expect(find(syms, 'Group')?.kind).toBe('class');
  });

  it('joins multi-line signatures and starts at decorators', () => {
    const top = find(syms, 'top');
    expect(top?.signature).toBe('async def top( a, ) -> int:');
    expect(top?.line).toBe(3);
    expect(top?.endLine).toBe(7);
  });

  it('computes indentation based end lines', () => {
    expect(find(syms, 'Group')?.endLine).toBe(15);
    expect(find(syms, 'method')?.endLine).toBe(15);
  });
});

describe('extractSymbols: other languages', () => {
  it('typescript', () => {
    const src = [
      'export interface Opts {', // 1
      '  a: number;', // 2
      '}', // 3
      'export class Svc {', // 4
      '  private x = 1;', // 5
      '  async run(a: string): Promise<void> {', // 6
      '    if (a) {', // 7
      '    }', // 8
      '  }', // 9
      '}', // 10
      'export const make = async (n: number) => {', // 11
      '  return n;', // 12
      '};', // 13
      'export type Id = string;', // 14
    ].join('\n');
    const s = extractSymbols('a.ts', src);
    expect(s.map((x) => `${x.kind}:${x.container ? x.container + '.' : ''}${x.name}`)).toEqual([
      'interface:Opts',
      'class:Svc',
      'method:Svc.run',
      'function:make',
      'type:Id',
    ]);
    expect(find(s, 'Svc')).toMatchObject({ line: 4, endLine: 10 });
    expect(find(s, 'run')).toMatchObject({ line: 6, endLine: 9 });
    expect(find(s, 'Id')?.endLine).toBe(14);
  });

  it('go and rust', () => {
    const go = extractSymbols('a.go', 'package a\n\nfunc (s *Server) Start() {\n}\n\ntype Server struct {\n}\n');
    expect(go.map((x) => x.name)).toEqual(['Start', 'Server']);
    expect(go[0]?.container).toBe('Server');
    const rs = extractSymbols('a.rs', 'pub struct A {\n}\n\nimpl A {\n    pub fn go(&self) {\n    }\n}\n');
    expect(rs.map((x) => `${x.kind}:${x.name}`)).toEqual(['class:A', 'class:A', 'method:go']);
  });

  it('java, ruby and c', () => {
    const java = extractSymbols(
      'A.java',
      'public class A {\n  public static int add(int a, int b) {\n    return a + b;\n  }\n}\n',
    );
    expect(java.map((x) => x.name)).toEqual(['A', 'add']);
    const rb = extractSymbols('a.rb', 'class A\n  def go\n    1\n  end\nend\n');
    expect(rb.map((x) => `${x.name}:${x.line}-${x.endLine}`)).toEqual(['A:1-5', 'go:2-4']);
    const c = extractSymbols(
      'a.c',
      '#include <x.h>\nint main(int argc, char **argv) {\n  if (argc) {\n  }\n  return 0;\n}\n',
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ name: 'main', line: 2, endLine: 6 });
  });
});

describe('extractSymbols: docs', () => {
  it('markdown headings with fences and levels', () => {
    const md = '# Title\n\n```\n# not a heading\n```\n\n## Sub\ntext\n\n# Next\n';
    const s = extractSymbols('a.md', md);
    expect(s.map((x) => `${x.name}:${x.line}-${x.endLine}`)).toEqual(['Title:1-9', 'Sub:7-9', 'Next:10-10']);
    expect(s[0]?.kind).toBe('heading');
  });

  it('rst titles by underline order', () => {
    const rst = 'Title\n=====\n\nIntro\n\nSection\n-------\n\nbody\n\nOther\n=====\n\nx\n';
    const s = extractSymbols('a.rst', rst);
    expect(s.map((x) => `${x.name}:${x.line}-${x.endLine}`)).toEqual(['Title:1-10', 'Section:6-10', 'Other:11-14']);
  });
});
