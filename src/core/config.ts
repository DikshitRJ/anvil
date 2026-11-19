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
  stallTimeoutSec: 45,
  contextBudget: 12000,
  mcpPort: 7801,
  cancelBehavior: 'revert',
  commandTimeoutSec: 120,
};
