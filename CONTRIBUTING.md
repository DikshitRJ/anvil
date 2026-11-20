# Contributing to Anvil

Thank you for helping. This guide covers the development setup, the scripts, the testing strategy, the coding standards, and the commit, pull request, release and reporting process. If you use an AI coding assistant, also read [docs/AGENTS.md](docs/AGENTS.md). [docs/CODEBASE.md](docs/CODEBASE.md) explains where the code lives.

## Development setup

- Node.js 22 (see `.nvmrc`). `package.json` lists `node >=20`, but CI and TrueForge both need 22.
- VS Code 1.95 or newer, for manual testing.
- TrueForge, for any change that touches the agent loop: `npx @truefoundry/trueforge@latest` (Node 22.14 or newer).

```bash
git clone https://github.com/DikshitRJ/anvil.git
cd anvil
npm ci
npm run build
```

To try the extension, start an Extension Development Host from VS Code, the standard way to run an extension under development, and open a folder in it. Anvil registers its bridge and agents in TrueForge once it can reach TrueForge. Run **Anvil: Run Doctor** to check the setup.

## Scripts

- `npm run build` bundles the extension and the webview with esbuild. `npm run watch` rebuilds on change.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run lint` runs ESLint.
- `npm run format` writes Prettier formatting, and `npm run format:check` verifies it.
- `npm test` runs the unit and integration suites. `npm run test:unit` and `npm run test:integration` run one each.
- `npm run test:e2e` runs the real-TrueForge suite. See Testing below.
- `npm run test:vscode` runs the VS Code smoke suite. On Linux, use `xvfb-run -a npm run test:vscode`.
- `npm run package` builds `anvil.vsix`.
- `npm run setup:trueforge` registers providers and agents in a running TrueForge, using `config/trueforge.local.json`.

## Before you open a pull request

Run these, in this order:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
```

Also run `npm run test:vscode` if you changed activation, commands, views or settings, and `npm run package` if you changed `package.json`. CI runs all of these and must be green.

## Testing

- Every change ships with a test. Logic that does not need VS Code belongs in `src/core`, with unit tests in `test/unit`.
- Code that crosses a boundary, such as the MCP bridge over HTTP, the session runner, or retrieval on a Flask-shaped repository, gets an integration test in `test/integration`.
- Tests must not call a model provider. Models sit behind TrueForge, and tests should not depend on a network or an API key.
- `test/e2e` is for the real-TrueForge suite, which runs in CI. It has no tests yet. When you add one, it must start TrueForge, register the bridge and agents, and drive a real session.
- `test/vscode` holds the VS Code smoke suite, which checks activation and command registration. It needs a display, so use xvfb on Linux.

## Coding standards

- TypeScript in strict mode. The code under `src/core` is pure: it must not import `vscode`. ESLint enforces this.
- Prefer plain data and pure functions. Keep functions short, about 40 lines or fewer, and avoid clever abstractions.
- Module contracts in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (sections 7 and 8) are authoritative. If a contract is wrong, fix the document in the same pull request and explain why.
- Do not add a dependency without a reason in the pull request. Dependencies cost bundle size and review time.
- Keep what the model sees small. Tool results should be windowed and capped, as the read and search tools already are.
- MCP tool handlers pass their arguments through unchanged. The approval ledger hashes those arguments, so changing them breaks the approval match.
- Never log or commit secrets. The bridge token lives in SecretStorage, and API keys live in the environment.
- Formatting follows `.prettierrc`: single quotes, 120 columns, trailing commas, and semicolons.

## Commits, branches and pull requests

- Create a feature branch from `main`: `feat/...`, `fix/...`, `test/...` or `docs/...`.
- Use Conventional Commits: `feat(core): ...`, `fix(host): ...`, `test(context): ...`, `docs: ...`. Keep each commit to one logical change.
- Commits in this repository are unsigned. You do not need GPG to contribute.
- Open a pull request into `main`. The `CI passed` check (job `ci-ok`) must be green before merging. It turns green only when both the quality phase and the integration phase pass.
- Describe what changed, why, and how you checked it. Link the OpenSpec change or the DECISIONS entry if there is one.
- Merge with `gh pr merge`. Changes under `.github/workflows/` are merged locally with git instead, because the GitHub token used by `gh` lacks the `workflow` scope.

## Specs, decisions and the work log

- Propose a behaviour change under `openspec/changes/<name>/` before you write code for it.
- Record every design decision in [docs/DECISIONS.md](docs/DECISIONS.md) as a new `D-0nn` entry. Do not rewrite existing entries. Supersede them with a new entry.
- Add a dated entry to [docs/LOG.md](docs/LOG.md) for major actions.
- When you add or change a source file, update its mirror doc under `docs/src/`. The mirror is still being built out, so ask in the pull request if the directory does not yet have the file.

## Releases

1. Merge the release changes into `main`, with CI green.
2. Tag the commit on `main` and push the tag, for example `git tag -a v0.1.0 -m "Anvil v0.1.0"` and `git push origin v0.1.0`.
3. The build workflow checks that the tag is on `main`, builds the production bundle, packages `anvil-<tag>.vsix`, and publishes a GitHub Release with that file attached.

Do not bump the version in `package.json` by hand for a release. The build workflow stamps it from the tag.

## Reporting issues

- File bugs and feature requests as GitHub Issues. Include your VS Code version, your operating system, the TrueForge version, the output from the **Anvil** output channel, and the report from **Anvil: Run Doctor**.
- Do not put API keys or other secrets in an issue. Redact them first.

## Reporting security problems

Do not open a public issue for a security problem. This includes problems with the bridge's token handling, its path confinement, or the write gate. Use GitHub's private vulnerability reporting for this repository if it is enabled, or contact the maintainer, [DikshitRJ](https://github.com/DikshitRJ), directly. Share the details privately first, and wait for a fix before you disclose them.
