## ADDED Requirements

### Requirement: Reliable command output
Command execution SHALL decode stdout and stderr as independent UTF-8 streams and finalize each result once.

#### Scenario: Split character
- **WHEN** a multibyte character spans data chunks
- **THEN** the command output and live channel preserve the character

#### Scenario: Spawn failure followed by close
- **WHEN** a child emits an error and subsequently closes
- **THEN** command completion is reported once


### Requirement: Consistent undo checkpoints
Undo SHALL update retained run snapshots so later cancellation compares against the current expected file state.

#### Scenario: Cancel after undo
- **WHEN** the latest change is undone and the run is subsequently reverted
- **THEN** already restored files do not produce false conflicts and evicted earlier changes still restore their original base
