# Make the pinned Flask demo reproducible

## Why
The demo setup installs unconstrained pytest. With pytest 9.2.0, Flask 3.1.3 cannot collect its CLI tests because `_pytest.monkeypatch.notset` was removed. The optional dotenv dependency is also missing.

## What Changes
Use pytest 9.0.2, the version in Flask 3.1.3's lockfile for Python 3.10+, and install Flask's dotenv extra for the CLI verification.

## Impact
Only the isolated demo setup changes. No extension runtime dependency changes.
