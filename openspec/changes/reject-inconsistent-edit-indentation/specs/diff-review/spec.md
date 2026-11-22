## ADDED Requirements

### Requirement: Consistent fuzzy indentation
Whitespace-tolerant edit matching SHALL require the same indentation transformation on every nonblank matched line before proposing replacement text.

#### Scenario: Inconsistent global anchor
- **WHEN** an old string matches trimmed lines but one global anchor has an extra space while the preceding function body matches exactly
- **THEN** the edit is rejected without changing content and tells the agent to read the exact region

#### Scenario: Uniform indentation difference
- **WHEN** every nonblank matched line has the same indentation transformation
- **THEN** the replacement remains eligible for review using that transformation
