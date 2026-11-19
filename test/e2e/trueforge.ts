// CI helper: starts a local TrueForge (npx @truefoundry/trueforge) on a free port and stops its whole process tree.
// Only the e2e suite imports this file. Unit and integration tests never start TrueForge.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkHealth } from '../../src/trueforge/client';

const HEALTH_TIMEOUT_MS = 150_000;
const POLL_MS = 1000;
const LOG_TAIL = 80;
const LOG_KEEP = 500;

export interface TrueForgeProcess {
  baseUrl: string;
  port: number;
  logs(): string;
  stop(): Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Asks the OS for a free loopback port, then releases it for TrueForge to bind.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function signalGroup(pid: number, sig: NodeJS.Signals): void {
  try {
    process.kill(-pid, sig); // negative pid: the whole process group (the child is spawned detached)
  } catch {
    // already gone
  }
}

// SIGTERM the group, escalate to SIGKILL after 3 s, resolve once the child has exited.
function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return resolve();
    const pid = child.pid;
    const escalate = setTimeout(() => signalGroup(pid, 'SIGKILL'), 3000);
    const finish = setTimeout(resolve, 5000);
    child.once('exit', () => {
      clearTimeout(escalate);
      clearTimeout(finish);
      resolve();
    });
    signalGroup(pid, 'SIGTERM');
  });
}

// Starts TrueForge and resolves once GET /healthz answers 200. On failure, stops it and throws with the last log lines.
export async function startTrueForge(): Promise<TrueForgeProcess> {
  const port = await freePort();
  const dir = await mkdtemp(join(tmpdir(), 'anvil-trueforge-'));
  const lines: string[] = [];
  const keep = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim() !== '') lines.push(line);
    }
    if (lines.length > LOG_KEEP) lines.splice(0, lines.length - LOG_KEEP);
  };
  const child = spawn('npx', ['-y', '@truefoundry/trueforge@latest', '--port', String(port)], {
    env: { ...process.env, SQLITE_PATH: join(dir, 'db.sqlite') },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = (): string => lines.slice(-LOG_TAIL).join('\n');
  const stop = async (): Promise<void> => {
    await killTree(child);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  };
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (!(await checkHealth(baseUrl))) {
    if (exited || Date.now() > deadline) {
      const why = exited ? 'the process exited' : `no answer within ${HEALTH_TIMEOUT_MS} ms`;
      const tail = logs();
      await stop();
      throw new Error(`TrueForge at ${baseUrl} is not healthy (${why}). Last log lines:\n${tail}`);
    }
    await sleep(POLL_MS);
  }
  return { baseUrl, port, logs, stop };
}
