// TrueForge SDK client factory and a cheap health probe.
import { TrueForge } from '@truefoundry/trueforge-sdk';
import { TrueForgeTransport } from './transport';

const transport = new TrueForgeTransport();

export function createClient(baseUrl: string): TrueForge {
  return new TrueForge({
    baseUrl,
    timeoutInSeconds: 600,
    maxRetries: 0,
    fetch: (input, init) => fetch(input, { ...init, dispatcher: transport } as RequestInit),
  });
}

// GET {baseUrl}/healthz; never throws
export async function checkHealth(baseUrl: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}
