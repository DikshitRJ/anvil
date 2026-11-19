import type { TrueForge } from '@truefoundry/trueforge-sdk';

export function createClient(_baseUrl: string): TrueForge {
  throw new Error('not implemented');
}

export async function checkHealth(_baseUrl: string, _timeoutMs?: number): Promise<boolean> {
  throw new Error('not implemented');
}
