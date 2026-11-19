# `src/core/config.ts`

**Purpose**
This file defines the configuration structure and default values for the application. It provides a function to merge user settings with default values.

**Exports**
- AnvilConfig(interface): None.
- DEFAULT_CONFIG(constant): Returns the default configuration object.
- mergeConfig(partial): Returns a new AnvilConfig object. It combines user input with default values and clamps numeric values to specific ranges.

**Collaborators**
- Imports: None.
- Users: Other modules in the project.

**Key behaviour and invariants**
- The `mergeConfig` function returns a new object. It does not modify the `DEFAULT_CONFIG` object.
- The `clamp` function ensures numeric values stay within defined minimum and maximum limits.
- `retriesPerModel` must be between 0 and 5.
- `stallTimeoutSec` must be between 5 and 600.
- `contextBudget` must be between 1000 and 200000.
- `mcpPort` must be between 1024 and 65535.
- `commandTimeoutSec` must be between 5 and 1800.
- The function rounds all numeric inputs to the nearest integer.

**Notes**
- If a user provides an undefined or non-finite number, the function uses the default value.
