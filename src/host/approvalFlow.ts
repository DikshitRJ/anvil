// Approval flow: agent edit approvals (per-hunk review, ledger), command approvals, and the WriteGate fallbacks.
import * as vscode from 'vscode';
import type { ResolvedToolCall } from '../core/agent/toolCalls';
import { simulateEdit, EditError, type EditOp } from '../core/edits/applyEdit';
import { ApprovalLedger, scopedKey } from '../core/ledger';
import { PathError, resolveInWorkspace, toRelative } from '../core/paths';
import type { WriteGate } from '../mcp/server';
import type { HostToWebview } from '../panel/protocol';
import type { ApprovalDecision } from '../trueforge/session';
import { reviewOutcome, summarizeTool } from './panelEvents';
import { ReviewCancelledError, type ReviewController } from './reviewController';

export interface ApprovalDeps {
  root: string;
  review: ReviewController;
  readFile(rel: string): Promise<string | null>;
  post(msg: HostToWebview): void;
  runId(): string | undefined;
}

const deny = (reason: string): ApprovalDecision => ({ allow: false, reason });

export class ApprovalFlow {
  readonly ledger = new ApprovalLedger();
  private readonly originals = new Map<string, string | null>();
  private readonly approvedCommands = new Set<string>();
  private cmdSeq = 0;
  private readonly pending = new Map<string, (allow: boolean) => void>();

  constructor(private readonly d: ApprovalDeps) {}

  async onApproval(call: ResolvedToolCall): Promise<ApprovalDecision> {
    try {
      if (call.tool === 'edit_file' || call.tool === 'write_file') return await this.approveEdit(call);
      if (call.tool === 'run_command') return await this.approveCommand(call);
      return { allow: true };
    } catch (e) {
      return deny(e instanceof ReviewCancelledError ? 'cancelled' : e instanceof Error ? e.message : String(e));
    }
  }

  private async approveEdit(call: ResolvedToolCall): Promise<ApprovalDecision> {
    let rel: string;
    try {
      rel = toRelative(this.d.root, resolveInWorkspace(this.d.root, String(call.input.path ?? '')));
    } catch (e) {
      if (e instanceof PathError) return deny(e.message);
      throw e;
    }
    const current = await this.d.readFile(rel);
    let proposed: string;
    try {
      proposed = simulateEdit(current, toEditOp(call, rel));
    } catch (e) {
      if (e instanceof EditError) return deny(`${e.code}: ${e.message}`);
      throw e;
    }
    const runId = this.d.runId() ?? '';
    this.d.post({
      type: 'approval',
      runId,
      id: call.callId,
      kind: 'edit',
      title: rel,
      detail: summarizeTool(call.tool, call.input),
    });
    const r = await this.d.review.review({ path: rel, original: current ?? '', proposed, source: 'agent' });
    const ok = r.content !== null;
    this.d.post({ type: 'approvalResolved', runId, id: call.callId, outcome: reviewOutcome(r.accepted, r.total, ok) });
    if (!ok) return deny(r.feedback || 'The user rejected this change.');
    const key = scopedKey(runId, call.tool, call.input);
    this.ledger.put(key, { finalContent: r.content, totalHunks: r.total, feedback: r.feedback });
    this.originals.set(key, current);
    return { allow: true };
  }

  private async approveCommand(call: ResolvedToolCall): Promise<ApprovalDecision> {
    const allowed = await this.askCommand(call.callId, call.input);
    if (!allowed) return deny('The user denied running this command.');
    this.approvedCommands.add(scopedKey(this.d.runId(), 'run_command', call.input));
    return { allow: true };
  }

  private askCommand(id: string, input: Record<string, unknown>): Promise<boolean> {
    const command = String(input.command ?? '');
    const detail = input.cwd ? `${command}\n(cwd: ${String(input.cwd)})` : command;
    const runId = this.d.runId() ?? '';
    this.d.post({ type: 'approval', runId, id, kind: 'command', title: 'Run command', detail });
    return new Promise<boolean>((resolve) => {
      this.pending.set(id, (allow) => {
        this.d.post({ type: 'approvalResolved', runId, id, outcome: allow ? 'allowed' : 'denied' });
        resolve(allow);
      });
      void vscode.window
        .showInformationMessage(`Anvil wants to run: ${command.slice(0, 120)}`, 'Allow', 'Deny')
        .then((c) => {
          if (c) this.answer(id, c === 'Allow');
        });
    });
  }

  /** Resolve a pending command approval (panel button or notification). Ignored when already answered. */
  answer(id: string, allow: boolean): void {
    const resolve = this.pending.get(id);
    this.pending.delete(id);
    resolve?.(allow);
  }

  rejectAllPending(): void {
    for (const id of [...this.pending.keys()]) this.answer(id, false);
  }

  clear(): void {
    this.ledger.clear();
    this.originals.clear();
    this.approvedCommands.clear();
  }

  // ---- WriteGate fallbacks (no silent writes) ----

  readonly gate: Pick<WriteGate, 'resolveWrite' | 'authorizeCommand'> = {
    resolveWrite: async (tool, args, current, proposed) => {
      const key = scopedKey(this.d.runId(), tool, args);
      const entry = this.ledger.take(key);
      const original = this.originals.get(key);
      this.originals.delete(key);
      if (entry && original === current) return { content: entry.finalContent, feedback: entry.feedback };
      const r = await this.d.review.review({
        path: String(args.path ?? ''),
        original: current ?? '',
        proposed,
        source: 'agent',
      });
      return { content: r.content, feedback: r.feedback };
    },
    authorizeCommand: async (args) => {
      if (this.approvedCommands.delete(scopedKey(this.d.runId(), 'run_command', args))) return true;
      return this.askCommand(`cmd-${++this.cmdSeq}`, args);
    },
  };
}

function toEditOp(call: ResolvedToolCall, rel: string): EditOp {
  const i = call.input;
  if (call.tool === 'write_file') return { kind: 'write', path: rel, content: String(i.content ?? '') };
  return {
    kind: 'replace',
    path: rel,
    oldString: String(i.old_string ?? ''),
    newString: String(i.new_string ?? ''),
    replaceAll: i.replace_all === true,
  };
}
