// Runs shell commands for the run_command tool: capped output, timeout with process-group kill, killAll on cancel.
import { spawn, type ChildProcess } from 'node:child_process';
import * as vscode from 'vscode';
import { CappedOutput } from './cappedOutput';

export interface CommandResult {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
}

function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    /* already gone */
  }
}

function terminate(child: ChildProcess): void {
  killTree(child, 'SIGTERM');
  setTimeout(() => killTree(child, 'SIGKILL'), 2000).unref();
}

export class CommandRunner implements vscode.Disposable {
  private readonly running = new Set<ChildProcess>();
  private readonly channel = vscode.window.createOutputChannel('Anvil: Commands');

  run(command: string, opts: { cwd: string; timeoutMs: number }): Promise<CommandResult> {
    this.channel.appendLine(`$ ${command}   (cwd: ${opts.cwd})`);
    return new Promise((resolve) => {
      const out = new CappedOutput();
      let timedOut = false;
      const child = spawn(command, {
        shell: true,
        cwd: opts.cwd,
        detached: process.platform !== 'win32',
        env: process.env,
      });
      this.running.add(child);
      const onData = (d: Buffer): void => {
        const s = d.toString('utf8');
        out.push(s);
        this.channel.append(s);
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      const timer = setTimeout(() => {
        timedOut = true;
        terminate(child);
      }, opts.timeoutMs);
      const done = (exitCode: number | null): void => {
        clearTimeout(timer);
        this.running.delete(child);
        this.channel.appendLine(`[exit ${exitCode}${timedOut ? ', timed out' : ''}]`);
        resolve({ exitCode, output: out.toString(), timedOut });
      };
      child.on('error', (e) => {
        out.push(`spawn error: ${e.message}`);
        done(null);
      });
      child.on('close', (code) => done(code));
    });
  }

  killAll(): void {
    for (const c of this.running) terminate(c);
  }

  dispose(): void {
    this.killAll();
    this.channel.dispose();
  }
}
