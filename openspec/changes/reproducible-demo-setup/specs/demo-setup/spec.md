## ADDED Requirements

### Requirement: Compatible Flask verification environment
The demo setup SHALL install dependencies compatible with the pinned Flask 3.1.3 CLI test suite.

#### Scenario: Fresh setup on Python 3.14
- **WHEN** the demo setup prepares a fresh checkout
- **THEN** `python -m pytest tests/test_cli.py -q` collects and passes the baseline CLI tests
- **AND** dotenv-dependent CLI behavior is available
