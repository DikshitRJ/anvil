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


### Requirement: Session retry state isolation
Each attempt SHALL reset transient compaction state, synchronize its configured model before starting a turn, and honor cancellation received during session creation.

#### Scenario: Cancel during compaction
- **WHEN** a compacting run is cancelled and a later run stalls
- **THEN** the later run still triggers its stall timeout

#### Scenario: Model update fails
- **WHEN** updating a session model fails
- **THEN** no turn is started under an unintended model and the failure follows the retry policy

#### Scenario: Cancel while creating a session
- **WHEN** cancellation arrives before session creation finishes
- **THEN** no turn starts after creation completes
