export interface AnvilConfig {
  trueforgeUrl: string;
  models: string[];
  retriesPerModel: number;
  stallTimeoutSec: number;
  contextBudget: number;
  mcpPort: number;
  cancelBehavior: 'revert' | 'keep';
  commandTimeoutSec: number;
}

export const DEFAULT_CONFIG: AnvilConfig = {
  trueforgeUrl: 'http://localhost:8790',
  models: [],
  retriesPerModel: 1,
  stallTimeoutSec: 120,
  contextBudget: 12000,
  mcpPort: 7801,
  cancelBehavior: 'revert',
  commandTimeoutSec: 120,
};

function clamp(v: number | undefined, lo: number, hi: number, dflt: number): number {
  if (v === undefined || !Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

// Overlay user settings on DEFAULT_CONFIG, ignoring undefined and clamping numbers to sane ranges.
export function mergeConfig(partial: Partial<AnvilConfig>): AnvilConfig {
  const d = DEFAULT_CONFIG;
  return {
    trueforgeUrl: partial.trueforgeUrl ?? d.trueforgeUrl,
    models: partial.models ? [...partial.models] : [...d.models],
    retriesPerModel: clamp(partial.retriesPerModel, 0, 5, d.retriesPerModel),
    stallTimeoutSec: clamp(partial.stallTimeoutSec, 5, 600, d.stallTimeoutSec),
    contextBudget: clamp(partial.contextBudget, 1000, 200000, d.contextBudget),
    mcpPort: clamp(partial.mcpPort, 1024, 65535, d.mcpPort),
    cancelBehavior: partial.cancelBehavior ?? d.cancelBehavior,
    commandTimeoutSec: clamp(partial.commandTimeoutSec, 5, 1800, d.commandTimeoutSec),
  };
}
