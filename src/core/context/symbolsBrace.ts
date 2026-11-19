// Regex symbol extraction for brace languages (TS/JS, Go, Java/Kotlin/C#, Rust, C/C++).
import type { SymbolInfo } from './types';

type Kind = SymbolInfo['kind'];
interface Decl {
  re: RegExp;
  kind: Kind;
  name: number; // capture group holding the name
  receiver?: number; // capture group holding the container (Go receivers)
  holds?: boolean; // may contain methods
}
interface Spec {
  decls: Decl[];
  method?: RegExp; // indented member declaration inside a container; group 1 = name
}

const NOT_METHOD = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'else', 'throw', 'function']);
const TS_MODS = '(?:(?:public|private|protected|static|async|readonly|override|abstract|get|set)\\s+)*';
const JVM_MODS =
  '(?:(?:public|private|protected|internal|static|final|abstract|override|virtual|async|synchronized|open|suspend)\\s+)*';
const EXP = '(?:export\\s+)?(?:default\\s+)?(?:declare\\s+)?';

const TS: Spec = {
  decls: [
    { re: new RegExp(`^${EXP}(?:abstract\\s+)?class\\s+(\\w+)`), kind: 'class', name: 1, holds: true },
    { re: new RegExp(`^${EXP}interface\\s+(\\w+)`), kind: 'interface', name: 1 },
    { re: new RegExp(`^${EXP}type\\s+(\\w+)`), kind: 'type', name: 1 },
    { re: new RegExp(`^${EXP}(?:const\\s+)?enum\\s+(\\w+)`), kind: 'type', name: 1 },
    { re: new RegExp(`^${EXP}(?:async\\s+)?function\\*?\\s+(\\w+)`), kind: 'function', name: 1 },
    {
      re: new RegExp(`^${EXP}const\\s+(\\w+)\\s*(?::[^=]+)?=\\s*(?:async\\s*)?(?:\\(|function|\\w+\\s*=>)`),
      kind: 'function',
      name: 1,
    },
  ],
  method: new RegExp(`^\\s+${TS_MODS}#?(\\w+)\\s*(?:<[^>]*>)?\\(.*\\)[^;=]*\\{\\s*$`),
};

const GO: Spec = {
  decls: [
    { re: /^func\s+\(\s*\w+\s+\*?(\w+)(?:\[[^\]]*\])?\s*\)\s*(\w+)/, kind: 'method', name: 2, receiver: 1 },
    { re: /^func\s+(\w+)/, kind: 'function', name: 1 },
    { re: /^type\s+(\w+)\s+interface/, kind: 'interface', name: 1 },
    { re: /^type\s+(\w+)\s+struct/, kind: 'class', name: 1 },
    { re: /^type\s+(\w+)/, kind: 'type', name: 1 },
  ],
};

const JVM: Spec = {
  decls: [
    {
      re: new RegExp(`^\\s*${JVM_MODS}(?:data\\s+|sealed\\s+|partial\\s+)*(class|record|object|struct)\\s+(\\w+)`),
      kind: 'class',
      name: 2,
      holds: true,
    },
    { re: new RegExp(`^\\s*${JVM_MODS}interface\\s+(\\w+)`), kind: 'interface', name: 1, holds: true },
    { re: new RegExp(`^\\s*${JVM_MODS}enum\\s+(?:class\\s+)?(\\w+)`), kind: 'type', name: 1, holds: true },
    { re: new RegExp(`^${JVM_MODS}fun\\s+(?:<[^>]*>\\s*)?(?:[\\w.]+\\.)?(\\w+)\\s*\\(`), kind: 'function', name: 1 },
  ],
  method: new RegExp(`^\\s+${JVM_MODS}(?:fun\\s+(?:<[^>]*>\\s*)?|(?:[\\w<>\\[\\],.?]+\\s+)+)(\\w+)\\s*\\([^;]*$`),
};

const RS_VIS = '(?:pub(?:\\([^)]*\\))?\\s+)?';
const RUST: Spec = {
  decls: [
    { re: new RegExp(`^${RS_VIS}(?:async\\s+)?(?:unsafe\\s+)?fn\\s+(\\w+)`), kind: 'function', name: 1 },
    { re: new RegExp(`^${RS_VIS}struct\\s+(\\w+)`), kind: 'class', name: 1 },
    { re: new RegExp(`^${RS_VIS}enum\\s+(\\w+)`), kind: 'type', name: 1 },
    { re: new RegExp(`^${RS_VIS}trait\\s+(\\w+)`), kind: 'interface', name: 1, holds: true },
    { re: /^impl(?:<[^>]*>)?\s+(?:[\w:<>,\s]+\s+for\s+)?(\w+)/, kind: 'class', name: 1, holds: true },
  ],
  method: new RegExp(`^\\s+${RS_VIS}(?:async\\s+)?(?:unsafe\\s+)?fn\\s+(\\w+)`),
};

const C_KW = '(?!(?:if|for|while|switch|return|else|typedef|sizeof|do|case)\\b)';
const C: Spec = {
  decls: [
    { re: /^(?:typedef\s+)?(?:class|struct)\s+(\w+)\s*(?:[:{]|$)/, kind: 'class', name: 1 },
    {
      re: new RegExp(`^${C_KW}[A-Za-z_][\\w\\s\\*&:<>,~]*?[\\s\\*&]+(\\w+(?:::\\w+)?)\\s*\\([^;]*$`),
      kind: 'function',
      name: 1,
    },
  ],
};

const BY_EXT: Record<string, Spec> = {};
for (const e of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) BY_EXT[e] = TS;
for (const e of ['.java', '.kt', '.cs']) BY_EXT[e] = JVM;
for (const e of ['.c', '.h', '.cpp', '.hpp', '.cc']) BY_EXT[e] = C;
BY_EXT['.go'] = GO;
BY_EXT['.rs'] = RUST;

export function isBraceLanguage(ext: string): boolean {
  return ext in BY_EXT;
}

function indentOf(l: string): number {
  return l.length - l.trimStart().length;
}

// Brace matching from the declaration line; returns the 0-based end index.
export function braceEnd(lines: string[], start: number): number {
  let depth = 0;
  let seen = false;
  const limit = Math.min(lines.length, start + 400);
  for (let i = start; i < limit; i++) {
    for (const ch of lines[i]!) {
      if (ch === '{') {
        depth++;
        seen = true;
      } else if (ch === '}') depth--;
    }
    if (seen && depth <= 0) return i;
    if (!seen && (/;\s*$/.test(lines[i]!) || i - start >= 4)) return i;
  }
  return limit - 1;
}

function matchDecl(line: string, spec: Spec): { d: Decl; m: RegExpMatchArray } | undefined {
  for (const d of spec.decls) {
    const m = line.match(d.re);
    if (m && !NOT_METHOD.has(m[d.name]!)) return { d, m };
  }
  return undefined;
}

function members(lines: string[], from: number, to: number, spec: Spec, c: SymbolInfo): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  let memberIndent = -1;
  for (let i = from + 1; i <= to && spec.method; i++) {
    const m = lines[i]!.match(spec.method);
    if (!m || NOT_METHOD.has(m[1]!)) continue;
    if (memberIndent < 0) memberIndent = indentOf(lines[i]!);
    if (indentOf(lines[i]!) !== memberIndent) continue;
    out.push({
      name: m[1]!,
      kind: 'method',
      path: c.path,
      line: i + 1,
      endLine: Math.min(braceEnd(lines, i), to) + 1,
      container: c.name,
      signature: lines[i]!.trim(),
    });
  }
  return out;
}

export function extractBrace(path: string, ext: string, lines: string[]): SymbolInfo[] {
  const spec = BY_EXT[ext];
  const out: SymbolInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const hit = matchDecl(lines[i]!, spec as Spec);
    if (!hit) continue;
    const { d, m } = hit;
    const end = braceEnd(lines, i);
    const sym: SymbolInfo = {
      name: m[d.name]!,
      kind: d.kind,
      path,
      line: i + 1,
      endLine: end + 1,
      signature: lines[i]!.trim(),
    };
    if (d.receiver) sym.container = m[d.receiver]!;
    out.push(sym);
    if (d.holds) out.push(...members(lines, i, end, spec as Spec, sym));
    if (d.holds) i = end; // skip the body: members were handled above
  }
  return out.sort((a, b) => a.line - b.line);
}
