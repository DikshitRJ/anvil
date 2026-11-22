import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TrueForgeTransport } from '../../src/trueforge/transport';

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.write('data: started\n\n');
  const timer = setTimeout(() => res.end('data: finished\n\n'), 1400);
  res.on('close', () => clearTimeout(timer));
});
const transport = new TrueForgeTransport();
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await transport.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('SDK transport during quiet compaction', () => {
  it('overrides a shorter per-request idle timeout and preserves all stream bytes', async () => {
    const response = await transport.request({ origin, path: '/', method: 'GET', bodyTimeout: 1 });
    expect(await response.body.text()).toBe('data: started\n\ndata: finished\n\n');
  });
  it('still aborts promptly while the response body is idle', async () => {
    const controller = new AbortController();
    const response = await transport.request({ origin, path: '/', method: 'GET', signal: controller.signal });
    const result = response.body.text();
    controller.abort();
    await expect(result).rejects.toThrow();
  });
});
