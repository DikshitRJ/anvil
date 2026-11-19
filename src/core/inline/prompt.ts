export interface InlineRequest {
  path: string;
  languageId: string;
  before: string;
  selection: string;
  after: string;
  instruction: string;
  context?: string;
}

export function buildInlinePrompt(_r: InlineRequest): string {
  throw new Error('not implemented');
}

// last complete fenced block, else whole text trimmed of fences
export function extractReplacement(_text: string): string {
  throw new Error('not implemented');
}

// streaming-safe (inside an unterminated fence)
export function extractPartialReplacement(_text: string): string {
  throw new Error('not implemented');
}

export function matchIndentation(_replacement: string, _selection: string): string {
  throw new Error('not implemented');
}
