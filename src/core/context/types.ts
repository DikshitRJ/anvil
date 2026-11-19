export interface SymbolInfo {
  name: string;
  kind: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type' | 'heading' | 'module';
  path: string;
  line: number;
  endLine: number;
  container?: string;
  signature: string;
}

export interface Chunk {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  symbol?: string;
}

export interface SearchHit {
  chunk: Chunk;
  score: number;
  matched: string[];
}

export interface Mention {
  kind: 'file' | 'symbol';
  value: string;
  raw: string;
}

export interface ContextSignals {
  query: string;
  mentions: Mention[];
  activeFile?: string;
  selection?: { path: string; startLine: number; endLine: number; text: string };
  openFiles: string[];
  recentFiles: string[];
}

export interface ContextItem {
  path: string;
  startLine?: number;
  endLine?: number;
  kind: 'pinned' | 'selection' | 'symbol' | 'chunk' | 'repo-map';
  reason: string;
  score: number;
  tokens: number;
  text: string;
}

export interface ContextPack {
  items: ContextItem[];
  budget: number;
  used: number;
  dropped: { path: string; reason: string }[];
}
