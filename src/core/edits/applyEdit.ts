export type EditOp =
  | { kind: 'write'; path: string; content: string }
  | { kind: 'replace'; path: string; oldString: string; newString: string; replaceAll?: boolean };

export type EditErrorCode = 'FILE_NOT_FOUND' | 'NOT_FOUND' | 'AMBIGUOUS' | 'NO_CHANGE' | 'INVALID';

export class EditError extends Error {
  constructor(
    public code: EditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

// exact match first; then a whitespace-tolerant line match (trimmed lines) if it is unique.
export function simulateEdit(_current: string | null, _op: EditOp): string {
  throw new Error('not implemented');
}
