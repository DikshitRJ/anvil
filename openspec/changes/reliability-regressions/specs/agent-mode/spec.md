## ADDED Requirements

### Requirement: Reliable command output
Command execution SHALL decode stdout and stderr as independent UTF-8 streams and finalize each result once.

#### Scenario: Split character
- **WHEN** a multibyte character spans data chunks
- **THEN** the command output and live channel preserve the character

#### Scenario: Spawn failure followed by close
- **WHEN** a child emits an error and subsequently closes
- **THEN** command completion is reported once
