# Reject inconsistent fuzzy edit indentation

## Why
The live Flask task exposed a whitespace-tolerant match spanning a function body and a global declaration with inconsistent indentation offsets. Applying the first-line offset to the whole replacement introduced invalid Python.

## What Changes
Require one consistent indentation transformation across every nonblank line of a fuzzy match. Reject inconsistent matches with guidance to read the exact region. Preserve exact replacements and uniform reindentation.

## Impact
Edit simulation, regression tests, and mirrored documentation. No settings or protocol changes.
